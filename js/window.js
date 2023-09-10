// Initial user settings which are set via messages from the BroadcastChannel
let startingURLInput = "";
let isExcludeImages = false;
let isFocusMode = false;
let isRestrictDomain = false;

// Lists to keep track of different types of URLs and avoid duplicates
let urlList = [];
let urlCSS = [];
let urlImage = [];
let urlVideo = [];
let urlJS = [];

// Flag to track if the scraping is completed
let scrapingDone = false;

// Used to show/hide user feedback form section
let feedbackFormSection = document.getElementById("feedback-form-section");
feedbackFormSection.style.display = "none";

/**
 * Updates the 'flagDownload' in the chrome storage with the given boolean value.
 * This function acts as a way to set a flag that indicates whether a download operation is ongoing.
 * @param {boolean} isDownloading - A boolean value indicating the download status.
 */
const setDownloadFlag = (isDownloading) => {
  chrome.storage.sync.set({ flagDownload: isDownloading });
};

// Creating a new BroadcastChannel instance to communicate between different contexts
const broadcastChannel = new BroadcastChannel("scraper_data");

/**
 * Event listener to handle messages from the broadcast channel.
 * These messages contain user settings for the scraping process.
 * Once the message is received, it initiates the download process.
 */
broadcastChannel.addEventListener("message", (event) => {
  // Destructuring the event data array to extract individual settings
  [startingURLInput, isExcludeImages, isFocusMode, isRestrictDomain] =
    event.data;

  // Calling function to set download flag
  setDownloadFlag(true);

  // Initiating the save process
  startScrapingProcess();
});

// Initialize a variable with the extension's ID
let extId = chrome.runtime.id;

// Initialize a variable to track the depth of the crawl, set to zero by default
let depth = 0;

// Create a new JSZip instance to hold the zipped contents
let zip = new JSZip();

/**
 * A function to simulate asynchronous work with a given delay.
 * This function resets the progress bar and progress text if the current progress is 100%.
 *
 * @param {number} delay - The delay in milliseconds before the function executes.
 * @returns {Promise} - A promise that resolves if the current progress is 100%.
 */
function performLoadingProcess(delay) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Checking if the current progress is at 100%
      if (document.getElementById("current-progress").innerText === "100%") {
        // Resetting the progress text and bar to 0%
        document.getElementById("current-progress").innerText = "0%";
        document.getElementById("progress-bar").style.width = "0%";

        // Resolve the promise indicating the async work is done
        resolve();
      }
    }, delay);
  });
}

/**
 * This is main function that iterates through the list of all pages and starts scrapping process.
 */
async function startScrapingProcess() {
  // Initialize the first URL and set its depth to 0
  urlList[0] = { url: startingURLInput, depth: depth };

  // Loop through each URL in the urlList to scrape their HTML content
  for (let i = 0; i < urlList.length; i++) {
    // Calculate the progress percentage and update the progress bar and text
    let progressPercentage =
      Math.ceil(((i + 1) / urlList.length) * 100).toString() + "%";
    document.getElementById("current-progress").innerText = progressPercentage;
    document.getElementById("progress-bar").style.width = progressPercentage;

    // Attempt to scrape the HTML content from the current URL
    htmlResponse = await scrapeHtml(urlList[i].url, urlList[i].depth);

    // Save the scraped HTML content to the zip file
    let filePath = i === 0 ? "" : "html/";
    zip.file(filePath + getTitle(urlList[i].url) + ".html", htmlResponse);
  }

  // Wait for 3 seconds before continuing
  await performLoadingProcess(3000);

  // Generate the zip file name from the hostname of the starting URL
  let zipName = new URL(startingURLInput).hostname;

  // Generate the zip file and initiate the download process
  zip.generateAsync({ type: "blob" }).then((content) => {
    let urlBlob = URL.createObjectURL(content);

    // Initiate the download process and catch any errors that occur
    chrome.downloads
      .download({
        url: urlBlob,
        filename: zipName + ".zip",
        saveAs: true,
      })
      .catch((error) => {
        document.getElementById("current-progress").innerText =
          "Error - " + error;
      });
  });

  // Add a listener to track the download progress and display the feedback form upon completion
  chrome.downloads.onChanged.addListener(function (downloadFile) {
    if (downloadFile.state && downloadFile.state.current === "complete") {
      feedbackFormSection.style.display = "block";
    }
  });

  // Reset the download flag and clear the zip variable for future use
  setDownloadFlag(false);
  zip = new JSZip();
}

//GIVEN THE URL AND URL_DEPTH, updates the zip files and adds more urls to the list
async function scrapeHtml(url, urlDepth) {
  let html = ""; //starts the
  // Asynchronous function to retrieve CSS from links
  async function getCSS(html) {
    let dp = new DOMParser();
    let PARSEDHTML = dp.parseFromString(html, "text/html");
    // Need to work on this
    let linkElements = PARSEDHTML.getElementsByTagName("link");

    for (const elementRef of linkElements) {
      // Create a dummy element to transfer <link> tag href to an <a> tag
      // so that JQuery can identify its protocol, hostname, and pathname etc.
      if (elementRef.getAttribute("rel") !== "stylesheet") continue;
      // The important of getAttribute is that the return is relative path.
      let relativePath = elementRef.getAttribute("href");
      let element = elementRef.href;
      if (relativePath.search("https://") === -1) {
        //Change path to absolute path if it's relative
        element = getAbsolutePath(relativePath, url);
      }

      console.log("url of css : " + element);
      let cssFile = getTitle(element);
      console.log("fileName of css : " + cssFile);

      if (urlDepth >= 1) {
        elementRef.setAttribute("href", "../css/" + cssFile + ".css");
      } else {
        elementRef.setAttribute("href", "css/" + cssFile + ".css");
      }
      html = PARSEDHTML.documentElement.innerHTML; //updates the current html
      if (checkDuplicate(element, urlCSS)) continue;
      try {
        urlCSS.push({ url: element });

        let cssText = await getData(element);
        if (cssText === "Failed") continue;

        cssText = await getCSSImg(cssText, "css", element);
        zip.file("css/" + cssFile + ".css", cssText);
        console.log("fileName of css is zipped: " + cssFile);
      } catch (err) {
        console.error(err);
      }
    }
    return html;
  }

  // Asynchronous function to retrieve Javascript files from script tags
  async function getJavascript(html) {
    let dp = new DOMParser();
    let PARSEDHTML = dp.parseFromString(html, "text/html");
    let scriptElements = PARSEDHTML.getElementsByTagName("script"); // this contains all script elements
    for (const elementRef of scriptElements) {
      // iterate through script elements
      let elementSrc = elementRef.getAttribute("src");
      if (elementSrc === null) continue; // only attempt to download if the script tag has a src, otherwise do nothing
      if (elementSrc.toString().search("https://") === -1) {
        //Change path to absolute path if it's relative
        elementSrc = getAbsolutePath(elementSrc, url);
      }
      let scriptFile = getTitle(elementSrc);
      let eString = elementSrc.toString(); // This line is used to check duplicate js file
      let lastPart = eString.toString().substring(eString.lastIndexOf("/") + 1); //

      // update html with proper path, if the depth is 0 we do not want ../
      if (urlDepth >= 1) {
        elementRef.setAttribute("src", "../js/" + scriptFile + ".js");
      } else {
        elementRef.setAttribute("src", "js/" + scriptFile + ".js");
      }
      html = PARSEDHTML.documentElement.innerHTML; //updates the current html

      if (checkDuplicate(lastPart, urlJS)) continue;
      try {
        urlJS.push({ url: lastPart });
        let scriptText = await getData(elementSrc); // get the js data
        if (scriptText === "Failed") continue;
        zip.file("js/" + scriptFile + ".js", scriptText); // add to the zip file
      } catch (err) {
        console.error(err);
      }
    }
    return html;
  }

  const getCSSImg = async (data, place, urlFile) => {
    try {
      // Waits for the function to fulfill promise then set data to cssText
      // Wrap data into <sytle> tags to append to html
      //This block of code essentially takes background images and downloads them
      //Note, svgs are not a part of this
      const regex = /url\s*\(\s*/;
      let bg = data.substring(data.search(regex));
      let count = 0;
      while (bg.search(regex) !== -1 && count <= 100) {
        //limit the loop because some url cannot handle
        //Replaces Bg Images and Downloads them
        try {
          bg = data.substring(data.search(regex));
          let bgIni = bg.substring(bg.indexOf("url") + 4, bg.indexOf(")")); // take a string from url to )
          // Trim url with some case in each if statement. These if statement need to be in order.
          let path;
          if (bgIni.search("xmlns") !== -1) break; // handle url contain xmlns, svgs
          if (bgIni.search("'") !== -1) {
            bgIni = bgIni.substring(
              bgIni.indexOf("'") + 1,
              bgIni.lastIndexOf("'")
            );
          }
          if (bgIni.search('"') !== -1) {
            bgIni = bgIni.substring(
              bgIni.indexOf('"') + 1,
              bgIni.lastIndexOf('"')
            );
          }
          if (bgIni.search("//") !== -1 && bgIni.indexOf("//") === 0) {
            bgIni = bgIni.replace("//", "https://");
          }
          bgIni = bgIni.replace("\\", "");
          //Get path
          // Depends on absolute path or relative path
          if (bgIni.search("http") !== -1) {
            path = bgIni;
          } else {
            path = getAbsolutePath(bgIni, urlFile);
          }
          //Get image name by get the part after /
          let imageName = "";
          if (bgIni.lastIndexOf("?") !== -1) {
            imageName = bgIni.substring(
              bgIni.lastIndexOf("/") + 1,
              bgIni.lastIndexOf("?")
            );
          } else {
            imageName = bgIni.substring(bgIni.lastIndexOf("/") + 1);
          }
          imageName = imageName.substring(imageName.length - 50);
          // replace the file with the appropriate path
          if (place === "css")
            // if file data is css, path go back to main folder and go into img folder
            data = data.replace(bgIni, "../img/" + imageName);
          else {
            // else if file data is html, it depends on the depth of html to giving the href
            if (urlDepth >= 1)
              data = data.replace(bgIni, "../img/" + imageName);
            else data = data.replace(bgIni, "img/" + imageName);
          }

          //Zip file
          if (!checkDuplicate(imageName, urlImage)) {
            // check Duplicate file before zipping file
            urlImage.push({ url: imageName });
            zip.file("img/" + imageName, urlToPromise(path), { binary: true });
          } // end replace and download image
          count++;
          bg = data.substring(data.search(regex) + 20);
        } catch (err) {
          console.error(err);
        }
      }
      return data;
    } catch (err) {
      console.error(err);
    }
    return data;
  };

  const getLinks = async (html) => {
    if (urlDepth < depth) {
      //if the max depth is higher than our current depth
      //Crawls html for all links
      // Parsing html text to  DOM object
      let parser = new DOMParser();
      let parsed = parser.parseFromString(html, "text/html");
      let links = parsed.getElementsByTagName("a");
      for (let j = 0; j < links.length; j++) {
        let relative = links[j].getAttribute("href"); // Given a relative path
        let link = links[j].href; //Given a link
        // if link does not contains any string belongs to "mailto", "tel", and "#", then scrape file.
        // if the resulting link is not one that is currently in the list
        if (
          link.toString().search("mailto") !== -1 ||
          link.toString().search("tel") !== -1 ||
          link.toString().search("#") !== -1 ||
          checkDuplicate(link, urlList) ||
          link.length === 0
        )
          continue;

        //checks if the link is in the correct format
        if (link.search("chrome-extension://" + extId) !== -1)
          link = getAbsolutePath(relative, url);

        console.log("adding to list:" + link);
        urlList.push({ url: link, depth: urlDepth + 1 }); //push it to the list. thus setting it up for more scraping
        // ----- get PDF file --------\

        if (link.toString().search(".pdf") === -1) {
          let linkTitle = getTitle(link);
          if (urlDepth >= 1) {
            links[j].setAttribute("href", linkTitle + ".html"); // when the depth >=1, we have already set the html/ part, so this avoids linking to /html/html...
          } else {
            links[j].setAttribute("href", "html/" + linkTitle + ".html"); //This line of code essentially makes it so the user can navigate all the pages they scraped when they are offline
          }
          html = parsed.documentElement.innerHTML; // update the html to reflect our changes
          continue;
        }

        try {
          pdfName = getTitle(link) + ".pdf";
          zip.file("pdf/" + pdfName, urlToPromise(link), { binary: true });
          if (urlDepth >= 1) {
            // Set the proper href values if they are pdf file
            links[j].setAttribute("href", "../pdf/" + pdfName);
          } else {
            links[j].setAttribute("href", "pdf/" + pdfName);
          }
        } catch (error) {
          console.error(error);
        }
        html = parsed.documentElement.innerHTML; // update the html to reflect our changes
      }
    }
    return html;
  };

  // Function to download image and replace their links with our own
  const getImgs = async (html) => {
    try {
      // Wait for function to fulfill promise then set HTML data to
      // variable
      let dp = new DOMParser();
      let parsed = dp.parseFromString(html, "text/html");
      let testImageElements = parsed.getElementsByTagName("img");
      Array.from(testImageElements).forEach(async (img) => {
        let src = img.getAttribute("src");

        // let lastPart = srcString.toString().substring(srcString.lastIndexOf('/')+1); //
        // skip a loop in ForEach loop  // return is instead of continue;
        if (src === null) return;
        if (src.search("base64") !== -1) return;

        // These code is used to check duplicate css file
        let imageName = src.substring(src.lastIndexOf("/") + 1);
        imageName = imageName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");
        if (!checkDuplicate(imageName, urlImage)) {
          urlImage.push({ url: imageName });
          if (src.search("//") !== -1) {
            src = src.substring(src.indexOf("//"));
            src = "https:" + src;
          } else {
            src = getAbsolutePath(src, url);
          }
          zip.file("img/" + imageName, urlToPromise(src), { binary: true });
        }
        if (urlDepth >= 1) img.setAttribute("src", "../img/" + imageName);
        else img.setAttribute("src", "img/" + imageName);
      });
      html = parsed.documentElement.innerHTML;
      return html;
    } catch (err) {
      console.error(err);
    }
    return html;
  };

  const getVideos = async (html) => {
    try {
      let dp = new DOMParser();
      let parsed = dp.parseFromString(html, "text/html");
      let testVideoElements = parsed.getElementsByTagName("iframe");
      Array.from(testVideoElements).forEach(async (video) => {
        let src = video.getAttribute("src");

        if (src === null) return;

        let videoName = src.substring(src.lastIndexOf("/") + 1);
        videoName = videoName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");
        if (!checkDuplicate(videoName, urlVideo)) {
          urlVideo.push({ url: videoName });
          if (src.search("//") !== -1) {
            src = src.substring(src.indexOf("//"));
            src = "https:" + src;
          } else {
            src = getAbsolutePath(src, url);
          }
          zip.file("video/" + videoName, urlToPromise(src), { binary: true });
        }
        if (urlDepth >= 1) video.setAttribute("src", "../video/" + videoName);
        else video.setAttribute("src", "video/" + videoName);
      });
      html = parsed.documentElement.innerHTML;
      return html;
    } catch (err) {
      console.error(err);
    }
    return html;
  };

  //Used for getting image data, used in getCSS and getImgs
  function urlToPromise(url) {
    return new Promise(function (resolve, reject) {
      JSZipUtils.getBinaryContent(url, function (err, data) {
        if (err) {
          resolve("Failed To Find Content");
        } else {
          resolve(data);
        }
      });
    });
  }

  // Main Asynchronous function that initiates the scraping process
  const scrape = async (url) => {
    try {
      console.log(url);
      html = await getData(url); //gets html of the url
      try {
        html = await getJavascript(html); // download external Javascript files
        html = await getCSS(html); //downloads css
        if (!isExcludeImages) {
          // checks if the user wants to omit images or not
          html = await getImgs(html); //downloads images
        }
        html = await getCSSImg(html, "html", url); // gets back-ground:image in the html text
        html = await getVideos(html);
        html = await getLinks(html);
      } catch (err) {
        console.error(err);
      }
      return html;
    } catch (err) {
      console.error(err);
    }
  };

  return await scrape(url); //returns the result of crawl/scrape
}
