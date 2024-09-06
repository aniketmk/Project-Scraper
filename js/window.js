// Initial user settings which are set via messages from the BroadcastChannel
let startingURLInput = "";
let currentPage = "";
let isExcludeImages = false;
let isFocusMode = false;
let isRestrictDomain = false;
let maxDepthValue = 0;

// Lists to keep track of different types of URLs and avoid duplicates
let urlList = [];
let urlCSSs = [];
let urlImages = [];
let urlVideos = [];
let urlJSs = [];

// Keep track of base count for when links are at 0 depth
let zeroDepthCounter = 0;
let totalZeroDepthCounter = 0;

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
  chrome.storage.sync.set({ downloadFlag: isDownloading });
};


/**
 * Sets the maximum depth for our search
 */
const setMaxDepth = (newMaxDepthValue) => {
  maxDepthValue = newMaxDepthValue;
};

/**
 * Sets the current page for our search
 */
const setCurrentPage = (newCurrentPage) => {
  currentPage = newCurrentPage;
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
  [startingURLInput, isFocusMode, isRestrictDomain, newMaxDepthValue] = event.data;

  // Calling function to set download flag
  setDownloadFlag(true);

  // Set Max Depth Value
  setMaxDepth(newMaxDepthValue);
  
  // Set the current page
  setCurrentPage(startingURLInput);

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

        // Resetting the progress bar to be not displayed
        document.getElementById("current-progress").style.display = "none";
        document.getElementById("progress-bar").style.display = "none";

        // Resolve the promise indicating the async work is done
        resolve();
      }
    }, delay);
  });
}

/**
 * Calculates the download progress percentage.
 *
 * @param {number} currentCount - The current count of processed items.
 * @param {number} totalCount - The total number of items to process.
 * @returns {string} - The progress percentage as a string.
 */
function calculateProgressPercentage(currentCount, totalCount) {
  if (totalCount === 0) {
    return "0%";
  }

  let percentage = Math.ceil((currentCount / totalCount) * 100);
  if (percentage > 100) {
    percentage = 100;
  }

  return percentage.toString() + "%";
}

/**
 * This function basically keeps track of count of an estimate for
 * the page when things are at zero depth.
 *
 * ToDo: This function should probably be a standard for all calculations
 *
 * @param {*} inputUrl - The url which
 */
async function zeroDepthCounterEstimator(inputUrl) {
  // Note that we are estimating length
  console.log("Estimating the length of urls to be processed");

  // Setup some basic stuff for getting information out of the page
  let html = await getData(inputUrl);
  let parser = new DOMParser();
  let parsed = parser.parseFromString(html, "text/html");

  // Get the total number of links for css, pdf and javascript for an estimate
  let cssTotal = parsed.querySelectorAll("link[rel='stylesheet']").length;
  let pdfTotal = Array.from(parsed.getElementsByTagName("a")).filter(
    (element) => element.href.includes(".pdf")
  ).length;
  let javascriptTotal = Array.from(
    parsed.getElementsByTagName("script")
  ).filter((element) => element.hasAttribute("src")).length;
  let imagesTotal = Array.from(parsed.getElementsByTagName("img")).length;
  let videoTotal = Array.from(parsed.getElementsByTagName("iframe")).filter(
    (element) => element.hasAttribute("src")
  ).length;

  // Set the total amount for zero depth
  totalZeroDepthCounter =
    cssTotal + pdfTotal + javascriptTotal + videoTotal + imagesTotal;

  return new Promise((resolve, reject) => {
    resolve();
  });
}

/**
 * Updates the progress bar for zero depths
 */
function zeroDepthCounterUpdate() {
  // Use requestAnimationFrame to ensure the DOM updates
  // await new Promise((resolve) => requestAnimationFrame(resolve));

  if (maxDepthValue == 0) {
    // Update the progress
    console.log("Progress Update");
    zeroDepthCounter++;

    const progressPercentage = calculateProgressPercentage(
      zeroDepthCounter,
      totalZeroDepthCounter
    );
    document.getElementById("current-progress").innerText = progressPercentage;
    document.getElementById("progress-bar").style.width = progressPercentage;
  }
}

/**
 * This is main function that iterates through the list of all pages and starts scrapping process.
 */
async function startScrapingProcess() {
  // Start to process the links we want to scrape.
  await processLinks();

  // Wait for 3 seconds before continuing
  await performLoadingProcess(3000);

  // Generate the zip file name from the hostname of the starting URL
  let zipName = new URL(startingURLInput).hostname;

  // Generate the zip file and initiate the download process
  zip.generateAsync({ type: "blob" }).then((content) => {
    console.log("ZIP Download Process");
    let urlBlob = URL.createObjectURL(content);

    // Initiate the download process and catch any errors that occur
    chrome.downloads
      .download({
        url: urlBlob,
        filename: zipName + ".zip",
        saveAs: true,
      })
      .catch((error) => {
        // Log any errors that occur in the download process.
        console.error("Error in Download Process: " + error);
      });
  });

  // Add a listener to track the download progress and display the feedback form upon completion
  chrome.downloads.onChanged.addListener(function (downloadFile) {
    if (downloadFile.state && downloadFile.state.current === "complete") {
      feedbackFormSection.style.display = "block";
    }
  });

  // // Reset the download flag and clear the zip variable for future use
  setDownloadFlag(false);
  zip = new JSZip();
}

/**
 *
 * @param {*} inputUrl - The URL to be processed
 * @param {*} html - The HTML to be processed
 * @returns
 */
async function processHTML(inputUrl, html = "") {
  // Get the HTML data for each page
  if (html == "") htmlData = await getData(inputUrl);
  else htmlData = html;

  // Parse the html string into a Dom Object
  let parser = new DOMParser();
  let parsed = parser.parseFromString(htmlData, "text/html");

  // Note that one is processing PDFs has started
  console.log("Processing PDFs");

  // Regular Expression for Processing PDfs
  const pdfAnchorsRegex = /<a[^>]+href="([^">]+)"/g;

  // Process PDFs
  htmlData = htmlData.replace( pdfAnchorsRegex, (match, p1) => {
    try {
      // Absolute URL href
      let absoluteUrl = p1;

      // Update the progress bar for depths
      if (maxDepthValue == 0) zeroDepthCounterUpdate();

      // Exclude an non-PDFs
      if (!absoluteUrl.includes(".pdf")) return;

      // Add the pdf to the zip folder
      zip.file("pdf/" + getTitle(absoluteUrl), urlToPromise(absoluteUrl), {
        binary: true,
      });

      let pdfFolderLocation = maxDepthValue === 0 ? "pdf/" : "../pdf/";

      // Set the href with the new local file location
      return match.replace(p1, pdfFolderLocation + getTitle(absoluteUrl));

      // Store the PDF
    } catch (error) {
      console.error(error);
      return match
    }
  });

  // Note that the Process for Images has Started
  console.log("Processing Images");

  // Regular expression to find all img tags
  const imgTagRegex = /<img[^>]+src="([^">]+)"/g;

  // Process Images
  htmlData = htmlData.replace( imgTagRegex, (match, p1) => {
    try {
      // Get the 'src' attribute from img
      let imgSrc = p1;

      // Update the progress bar for depths
      if (maxDepthValue === 0) zeroDepthCounterUpdate();

      // If src attribute is null or a base64 encoded image, skip this iteration
      if (imgSrc === null || imgSrc.includes("base64")) return;

      // Extract the image name from the src URL and sanitize it
      let imageName = imgSrc
        .substring(imgSrc.lastIndexOf("/") + 1)
        .replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");

      // Check if the image is a duplicate if not storage that image name
      if (!urlImages.includes(imageName)) {
        // Store the image into the urlImages
        urlImages.push(imageName);

        // Adjust the srcUrl to ensure it's an absolute URL
        if (imgSrc.includes("//"))
          imgSrc = "https:" + imgSrc.substring(imgSrc.indexOf("//"));
        else imgSrc = getAbsolutePath(imgSrc, inputUrl);

        // Add the img file to the zip
        zip.file("img/" + imageName, urlToPromise(imgSrc), { binary: true });
      }

      // Image Location 
      let imageFolderLocation = maxDepthValue === 0 ? "img/" : "../img/";

      // Return the modified img tag with the new src
      return match.replace(p1, imageFolderLocation + imageName);
      
    } catch (error) {
      console.error(error);
      return match;
    }
  });

  // Note that CSS is now being Processed
  console.log("Processing CSS Files");

  // Regular expression to match <link> tags with rel="stylesheet"
  const cssLinkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g;

  // Process CSSs
  htmlData = htmlData.replace(cssLinkRegex, (match, p1) => {
      try {
        let cssHref = p1;

        // Update the progress bar for depths
        if (maxDepthValue == 0) zeroDepthCounterUpdate();

        // Check if the path includes https and set the correct absoluteUrl
        if (!cssHref.includes("https://") || 
          cssHref.includes("chrome-extension://" + extId) ||
          cssHref.toString().startsWith("chrome-extension://"))
            cssHref = getAbsolutePath(cssHref, inputUrl);

        // Check for duplicates
        if (urlCSSs.includes(cssHref)) return match;

        // Add to the urlCSSs array
        urlCSSs.push(cssHref);

        // Fetch the CSs data and add it to the zip
        getData(cssHref).then( (data) => {
          if (data !== "Failed") 
            zip.file("css/" + getTitle(cssHref) + ".css", data);
        });

        // Set the CSS folder location for different depths
        let cssFolderLocation = maxDepthValue === 0 ? "css/" : "../css/";

        return match.replace(p1, cssFolderLocation + getTitle(cssHref) + ".css");

      } catch (error) {
        console.error(error);
        return match;
      }
    }
  );

  // // Update the htmlData with new parsed data
  // parsed = parser.parseFromString(htmlData, "text/html");

  // // Note that one is now Processing Javascript
  // console.log("Processing Javascript Files");

  // // Get all of the script elements from the parsed HTML
  // Array.from(parsed.getElementsByTagName("script")).forEach((script) => {
  //   try {
  //     // Get the "src" attribute vaue of the current script element
  //     let scriptSrc = script.getAttribute("src");

  //     // If the "src" attribute is null skip that iteration
  //     if (scriptSrc === null) return;

  //     // Update the progress bar for zero depths
  //     if (maxDepthValue == 0) zeroDepthCounterUpdate();

  //     // Convert relative URLs to absolute URLs
  //     if (scriptSrc.toString().search("https://") === -1)
  //       scriptSrc = getAbsolutePath(scriptSrc, inputUrl);

  //     // Get the file name of the script and the last part of its URL
  //     let scriptFileName = getTitle(scriptSrc);
  //     let scriptString = scriptSrc.toString();
  //     let lastPart = scriptString.substring(scriptString.lastIndexOf("/") + 1);

  //     // Update the "src" attribute in the HTML based on the URL depth
  //     script.setAttribute("src", "../js/" + scriptFileName + ".js");

  //     // Update the HTML string with the modified script element
  //     htmlData = parsed.documentElement.innerHTML;

  //     // Check for duplicate script URLs and skip them
  //     if (urlJSs.includes(lastPart)) return;

  //     // Add the script URL to the tracking array
  //     urlJSs.push(lastPart);

  //     // Store the data in script text
  //     getData(scriptSrc).then((data) => {
  //       if (data === "Failed") return;

  //       // Add the script content to the zip file
  //       zip.file("js/" + scriptFileName + ".js", data);
  //     });
      
      
  //   } catch (err) {
  //     // Log errors that occur during the fetching and zipping process
  //     console.error(err);
  //   }
  // });

  // parsed = parser.parseFromString(htmlData, "text/html");

  // // Note the Processing Videos has started
  // console.log("Processing Video Files");

  // // Convert the HTMLCollection to an array and iterate over each iframe elment
  // Array.from(parsed.getElementsByTagName("iframe")).forEach( (video) => {
  //   try {
  //     // Get the 'src' attribute of the iframe element
  //     let src = video.getAttribute("src");

  //     // If src attribute is null, exit early from this iteration
  //     if (src === null) return;

  //     // Update the progress bar for zero depths
  //     if (maxDepthValue == 0) zeroDepthCounterUpdate();
  //     // Extract the video name from the src URL and sanitize it
  //     let videoName = src
  //       .substring(src.lastIndexOf("/") + 1)
  //       .replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");

  //     // Check if the video is a duplicate and if not, add it to the list and prepare for download
  //     if (!urlVideos.includes(videoName)) {
  //       urlVideos.push(videoName);

  //       // Adjust the src URL to ensure it's an absolute URL
  //       if (src.includes("//")) {
  //         src = "https:" + src.substring(src.indexOf("//"));
  //       } else {
  //         src = getAbsolutePath(src, url);
  //       }
  //       // Add the video file to the zip
  //       zip.file("video/" + videoName, urlToPromise(src), { binary: true });
  //     }
  //     // Update the HTML string to reflect the changes made
  //     htmlData = parsed.documentElement.innerHTML;

  //     // Set the src attribute of the iframe to point to the local video file
  //     video.setAttribute("src", "../video/" + videoName);
  //   } catch (error) {
  //     console.error(error);
  //   }
  // });

  return new Promise((resolve, reject) => {
    resolve(htmlData);
  });
}

/**
 * Process the links for each website we intend to download.
 */
async function processLinks() {
  /* We have used a BFS approach
   * considering the structure as
   * a tree. It uses a queue based
   * approach to traverse
   * links upto a particular depth
   */

  if (maxDepthValue == 0) {
    // Get the total estimate of links to go through
    await zeroDepthCounterEstimator(currentPage);

    // ProcessHTML
    html = await processHTML(currentPage);

    zip.file(getTitle(currentPage) + ".html", html);

    // Reset the zero depth information
    zeroDepthCounter = 0;
    totalZeroDepthCounter = 0;
  } else if (maxDepthValue == 1) {
    await getLinks();

    // Start for the html
    let html = "";

    // Link counters
    let currentCount = 0;
    let totalCount = urlList.length;

    for (let url of urlList) {
      // Set the html value
      if (html === "") {
        html = getData(currentPage);
        html = await processHTML(currentPage, html);
      } else {
        html = getData(url);
        html = await processHTML(url, html);
      }

      // Update the progress
      currentCount++;

      // Update the Percentage
      const progressPercentage = calculateProgressPercentage(
        currentCount,
        totalCount
      );
      document.getElementById("current-progress").innerText =
        progressPercentage;
      document.getElementById("progress-bar").style.width = progressPercentage;

      // Use requestAnimationFrame to ensure the DOM updates
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Store the HTML in the zip object
      zip.file("html/" + getTitle(url) + ".html", html);
    }
  } else {
    // Set a bunch of default values
    let html = "";
    let queue = [];
    queue.push(currentPage);

    for (let i of [...Array(maxDepthValue).keys()]) {
      while (queue.length) {
        let url = queue.shift();
        let urls = await getLinks(url);

        // Link counters
        let currentCount = 0;
        let totalCount = urlList.length;

        for (let j of urls) {
          // Set the html value
          if (html === "") {
            html = getData(currentPage);
            html = await processHTML(currentPage, html);
          } else {
            html = getData(j);
            html = await processHTML(j, html);
          }

          // Update the progress
          currentCount++;

          // Update the Percentage
          const progressPercentage = calculateProgressPercentage(
            currentCount,
            totalCount
          );
          document.getElementById("current-progress").innerText =
            progressPercentage;
          document.getElementById("progress-bar").style.width =
            progressPercentage;

          // Store the HTML in the zip object
          zip.file("html/" + getTitle(j) + ".html", html);

          // Store j in the queue for future use
          queue.push(j);
        }
      }
    }
  }
}

/**
 * Asynchronously processes HTML data to find and modify links to point to local files,
 * nd downloads linked PDF files to include in a zip file. The function is recursive
 * and will scrape links up to a specified maximum depth.
 *
 * @param {string} inputUrl - The input or current page within the tab also works for multiple links.
 * @returns {Promis<Array>} - The list of all the Urls for the page
 */
async function getLinks(inputUrl = currentPage) {
  // Temp storage of current urls
  tempUrls = new Set();

  // Get the html data for each page
  html = await getData(inputUrl);

  let parser = new DOMParser();
  let parsed = parser.parseFromString(html, "text/html");

  // Search for all the urls on the first given page
  for (const anchor of parsed.getElementsByTagName("a")) {
    let relative = anchor.getAttribute("href");
    let absoluteUrl = anchor.href;

    // Skip a bunch of unneeded links
    if (
      absoluteUrl.includes("mailto") ||
      absoluteUrl.includes("tel") ||
      absoluteUrl.includes("#") ||
      absoluteUrl.length === 0
    )
      continue;

    // Assure that the chrome-extension Urls are corrected to the absolute urls
    if (
      absoluteUrl.includes("chrome-extension://" + extId) ||
      absoluteUrl.includes("chrome-extension://")
    )
      absoluteUrl = getAbsolutePath(relative, inputUrl);

    // Make sure that there are no instances of URL in our program
    if (absoluteUrl instanceof URL) continue;

    // Make sure that no urls are already in the list
    if (!urlList.includes(absoluteUrl)) {
      // Note that the Url is being added to the list of Urls
      console.log("Adding to list: " + absoluteUrl);

      // Store the URLs
      tempUrls.add(absoluteUrl);
      urlList.push(absoluteUrl);
    }
  }
  return new Promise((resolve, reject) => {
    resolve(tempUrls);
  });
}

/**
 * Asynchronously processes CSS or HTML data to extract image URLs, replace them with local paths,
 * and downloads the images to include in a zip file.
 * @param {string} data - The CSS or HTML data as a string.
 * @param {string} place - Specifies whether the data is 'css' or 'html'.
 * @param {string} urlFile - The base URL to resolve relative paths.
 * @returns {Promise<string>} - A promise that resolves with the modified data.
 */
async function getCSS(data, place, urlFile) {
  // Exit out if this is not a string
  if (typeof data === "object") return;

  try {
    // Regular expression to match URLs in background-image properties or img tags.
    const regex = /url\s*\(\s*/;
    let bg = data.substring(data.match(regex));
    let count = 0;
    while (bg.search(regex) !== -1 && count <= 100) {
      try {
        bg = data.substring(data.match(regex));
        let bgIni = bg.substring(bg.indexOf("url") + 4, bg.indexOf(")"));
        // Modify the URL to get a clean, absolute URL.
        let path;
        if (bgIni.search("xmlns") !== -1) break; // Skip URLs containing "xmlns", which are usually SVG namespaces.
        if (bgIni.includes("'")) {
          bgIni = bgIni.substring(
            bgIni.indexOf("'") + 1,
            bgIni.lastIndexOf("'")
          );
        }
        if (bgIni.includes('"')) {
          bgIni = bgIni.substring(
            bgIni.indexOf('"') + 1,
            bgIni.lastIndexOf('"')
          );
        }
        if (bgIni.startsWith("//")) {
          bgIni = "https:" + bgIni;
        }
        bgIni = bgIni.replace("\\", "");
        if (bgIni.startsWith("http")) {
          path = bgIni;
        } else {
          path = getAbsolutePath(bgIni, urlFile); // Resolve relative URLs to absolute URLs.
        }
        // Extract the image file name from the URL.
        let imageName = bgIni.split("/").pop().split("?")[0];
        imageName = imageName.substring(
          imageName.length - Math.min(50, imageName.length)
        );
        // Replace the URLs in the data with local paths to the images.
        let newImagePath = "../img/" + imageName;
        data = data.replace(bgIni, newImagePath);
        // Download the image and include it in the zip file.
        if (!checkDuplicate(imageName, urlImage)) {
          urlImage.push({ url: imageName });
          zip.file("img/" + imageName, urlToPromise(path), { binary: true });
        }
        count++;
        bg = data.substring(data.match(regex) + 20);
      } catch (err) {
        console.error(err);
      }
    }
    return data;
  } catch (err) {
    console.error(err);
  }
  return data;
}
