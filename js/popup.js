// Declare a variable to hold the URL of the current page.
let currentPage;

// Get the DOM elements to attach the event listeners.
const submitButton = document.getElementById("submit-button");

// Get the DOM  elements to control persistent saving options
const excludeImages = document.getElementById("exclude-images-checkbox");
const focusMode = document.getElementById("focus-mode-checkbox");
const restrictDomain = document.getElementById("restrict-domain-checkbox");
const depthMode = document.getElementById("choose-depth-input");

// This object serves as a container to store the global state.
const globalState = {
  position: 0,
};

// Get the state of various checkboxes from the DOM to set the initial settings.
let isExcludeImages = false;
let isFocusMode = false;
let isRestrictDomain = false;

excludeImages.addEventListener("change", () => {
  isExcludeImages = true;
  fillOptions();
});
focusMode.addEventListener("change", () => {
  isFocusMode = true;
  fillOptions();
});
restrictDomain.addEventListener("check", () => {
  isRestrictDomain = true;
  fillOptions();
});

/**
 * Set the current page URL as the starting URL.
 * The chrome.tabs.query method retrieves the details of the current active tab in the current window
 * and sets the URL of that tab as the 'currentPage'.
 */
chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
  currentPage = tabs[0].url;
});

/**
 * Updates the 'flagDownload' in the chrome storage with the given boolean value.
 * This function acts as a way to set a flag that indicates whether a download operation is ongoing.
 * @param {boolean} isDownloading - A boolean value indicating the download status.
 */
const setDownloadFlag = (isDownloading) => {
  chrome.storage.sync.set({ downloadFlag: isDownloading });
};

// Event listener that triggers when the DOM is fully loaded.
// It fills the options form, opens a new window, and resets the download flag.
document.addEventListener("DOMContentLoaded", () => {
  setDownloadFlag(false);
  fillOptions();
});

// Event listener that triggers when the window is about to unload (close).
// It prevents the unload event and alerts the user with a message.
document.addEventListener("unload", (event) => {
  event.preventDefault();
  alert(
    "The popup window was closed. Please reopen the extension to get it back."
  );
});

// Adding an event listener to the submit button to initiate the checkDownloadFlag function when clicked.
submitButton.addEventListener("click", checkDownloadFlag);

/**
 * Checks the flag in the chrome storage to see if a download is currently in progress.
 * If a download is not in progress (flag is "False"), it initiates the sending of form data.
 * Otherwise, it displays a bootstrap toast notification to the user.
 */
function checkDownloadFlag() {
  chrome.storage.sync.get((items) => {
    if (!items.downloadFlag) {
      // The flag is off, indicating that no download is in progress. Proceed to send form data.
      downloadPage();
    } else {
      // A download is currently in progress. Display a toast notification to inform the user.
      // Create a new instance of the Bootstrap toast
      var toast = new bootstrap.Toast($("#toast"));
      // Display the toast notification
      toast.show();
    }
  });
}

/**
 * Start the scraping process and download the current page.
 */
function downloadPage() {
  [startingURLInput, isExcludeImages, isFocusMode, isRestrictDomain] = [
    currentPage,
    isExcludeImages,
    isFocusMode,
    isRestrictDomain,
  ];

  // Calling function to set download flag
  setDownloadFlag(true);

  // Initiating the save process
  startScrapingProcess();
}

/**
 * Retrieves options values from the Chrome storage and fills the form inputs with those values.
 * This function is responsible for populating the initial state of options in the popup window.
 */
function fillOptions() {
  chrome.storage.sync.get((items) => {
    // console.log(items);
    isExcludeImages = items.isExcludeImages;
    isFocusMode = items.isFocusMode;
    isRestrictDomain = items.isRestrictDomain;
  });
}

// Initial user settings which are set via messages from the BroadcastChannel
let startingURLInput = "";

// Lists to keep track of different types of URLs and avoid duplicates
let urlList = [];
let urlCSS = [];
let urlImage = [];
let urlVideo = [];
let urlJS = [];

// Flag to track if the scraping is completed
let scrapingDone = false;

// Initialize a variable with the extension's ID
let extId = chrome.runtime.id;

// Initialize a variable to track the depth of the crawl, set to zero by default
let maxDepthValue = 0;

depthMode.addEventListener("change", () => {
   maxDepthValue = depthMode.value;
});

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
  // Start to process the links we want to scrape.
  await processLinks();

  // Initialize the first URL and set its depth to 0
  // urlList[0] = { url: startingURLInput, depth: 0 };

  // // Loop through each URL in the urlList to scrape their HTML content
  // for (let i = 0; i < urlList.length; i++) {
  //   // Calculate the progress percentage and update the progress bar and text
  //   let progressPercentage =
  //     Math.ceil(((i + 1) / urlList.length) * 100).toString() + "%";
  //   document.getElementById("current-progress").innerText = progressPercentage;
  //   document.getElementById("progress-bar").style.width = progressPercentage;

  //   // Attempt to scrape the HTML content from the current URL
  //   htmlResponse = await scrapeHtml(urlList[i].url, urlList[i].depth);

  //   // Save the scraped HTML content to the zip file
  //   let filePath = i === 0 ? "" : "html/";
  //   zip.file(filePath + getTitle(urlList[i].url) + ".html", htmlResponse);
  // }

  // Wait for 3 seconds before continuing
  // await performLoadingProcess(3000);

  // Generate the zip file name from the hostname of the starting URL
  // let zipName = new URL(startingURLInput).hostname;

  // Generate the zip file and initiate the download process
  // zip.generateAsync({ type: "blob" }).then((content) => {
  //   let urlBlob = URL.createObjectURL(content);

  //   // Initiate the download process and catch any errors that occur
  //   chrome.downloads
  //     .download({
  //       url: urlBlob,
  //       filename: zipName + ".zip",
  //       saveAs: true,
  //     })
  //     .catch((error) => {
  //       // Log any errors that occur in the download process.
  //       console.error("Error in Download Process: " + error);
  //     });
  // });

  // Add a listener to track the download progress and display the feedback form upon completion
  // chrome.downloads.onChanged.addListener(function (downloadFile) {
  //   if (downloadFile.state && downloadFile.state.current === "complete") {
  //     feedbackFormSection.style.display = "block";
  //   }
  // });

  // // Reset the download flag and clear the zip variable for future use
  // setDownloadFlag(false);
  // zip = new JSZip();
}

/******************************************************SCRAPING FUNCTIONS - START***********************************************************/
/*
 * This script parses a given HTML string to find all <link> elements with rel="stylesheet"
 * and prints the absolute URL and filename of the stylesheet link.
 *
 * @param {string} html - The HTML content as a string.
 * @param {number} urlDepth - The depth of the page that needs to be downloaded.
 * @returns {string} - The updated HTML content as a string.
 */
async function getCSS(html, url, urlDepth) {
  // Initialize a DOMParser instance
  let dp = new DOMParser();
  // Parse the HTML string into a DOM Document object
  let parsedHTML = dp.parseFromString(html, "text/html");
  // Find all <link> elements in the parsed HTML
  let linkElements = parsedHTML.getElementsByTagName("link");
  // Iterate through each <link> element
  for (const elementRef of linkElements) {
    // If the rel attribute is not 'stylesheet', skip this iteration
    if (elementRef.getAttribute("rel") !== "stylesheet") continue;
    // Get the href attribute value (might be relative or absolute)
    let relativePath = elementRef.getAttribute("href");
    // Initialize element with the absolute URL (if href is already absolute)
    let element = elementRef.href;
    // If href does not start with "https://", convert relative path to an absolute path
    if (relativePath.search("https://") === -1) {
      element = getAbsolutePath(relativePath, url);
    }
    // Get and log the filename of the CSS file
    let cssFile = getTitle(element);
    if (urlDepth >= 1) {
      // If the URL depth is 1 or more, set the href attribute to point to the CSS file
      // in the parent directory's "css" folder with the respective css file name
      elementRef.setAttribute("href", "../css/" + cssFile + ".css");
    } else {
      // If the URL depth is less than 1, set the href attribute to point to the CSS file
      // in the "css" folder within the current directory with the respective css file name
      elementRef.setAttribute("href", "css/" + cssFile + ".css");
    }
    // Update the current HTML with the modified href attribute
    html = parsedHTML.documentElement.innerHTML;
    // Check if the URL is a duplicate in the urlCSS array, and if so, skip to the next iteration
    if (checkDuplicate(element, urlCSS)) continue;
    try {
      // Add the current URL to the urlCSS array
      urlCSS.push({ url: element });
      // Fetch the CSS text data asynchronously
      let cssText = await getData(element);
      // If the CSS text data retrieval failed, skip to the next iteration
      if (cssText === "Failed") continue;
      // Fetch CSS image data asynchronously and update the cssText
      cssText = await getCSSImg(cssText, "css", element);
      // Add the CSS text data to the zip file under the "css" directory with the respective css file name
      zip.file("css/" + cssFile + ".css", cssText);
      // Log the filename of the zipped CSS file
      // console.log("File name of zipped CSS: " + cssFile);
    } catch (err) {
      // Log any errors that occur during the try and catch block
      console.error(err);
    }
    // Return the updated HTML
    return html;
  }
}

/**
 * Asynchronous function to retrieve JavaScript files from script tags within the provided HTML string,
 * adjust their paths based on the URL depth, check for duplicates, and add non-duplicate scripts to a zip file.
 *
 * @param {string} html - The HTML content as a string.
 * @param {number} urlDepth - The depth of the page that needs to be downloaded.
 * @returns {string} - The updated HTML content as a string.
 */
async function getJavaScript(html, url, urlDepth) {
  // Initialize a DOMParser instance
  let dp = new DOMParser();
  // Parse the HTML string to a DOM Document object
  let parsedHTML = dp.parseFromString(html, "text/html");
  // Get all script elements from the parsed HTML
  let scriptElements = parsedHTML.getElementsByTagName("script");
  // Iterate through all the script elements
  for (const elementRef of scriptElements) {
    // Get the "src" attribute value of the current script element
    let elementSrc = elementRef.getAttribute("src");
    // If the "src" attribute is null, skip this iteration
    if (elementSrc === null) continue;
    // Convert relative URLs to absolute URLs
    if (elementSrc.toString().search("https://") === -1) {
      elementSrc = getAbsolutePath(elementSrc, url);
    }
    // Get the file name of the script and the last part of its URL
    let scriptFile = getTitle(elementSrc);
    let eString = elementSrc.toString();
    let lastPart = eString.substring(eString.lastIndexOf("/") + 1);
    // Update the "src" attribute in the HTML based on the URL depth
    if (urlDepth >= 1) {
      elementRef.setAttribute("src", "../js/" + scriptFile + ".js");
    } else {
      elementRef.setAttribute("src", "js/" + scriptFile + ".js");
    }
    // Update the HTML string with the modified script element
    html = parsedHTML.documentElement.innerHTML;
    // Check for duplicate script URLs and skip them
    if (checkDuplicate(lastPart, urlJS)) continue;
    try {
      // Add the script URL to the tracking array
      urlJS.push({ url: lastPart });
      // Asynchronously fetch the script content
      let scriptText = await getData(elementSrc);
      if (scriptText === "Failed") continue;
      // Add the script content to the zip file
      zip.file("js/" + scriptFile + ".js", scriptText);
    } catch (err) {
      // Log errors that occur during the fetching and zipping process
      console.error(err);
    }
  }
  // Return the updated HTML string
  return html;
}

/**
 * Asynchronously processes CSS or HTML data to extract image URLs, replace them with local paths,
 * and downloads the images to include in a zip file.
 * @param {string} data - The CSS or HTML data as a string.
 * @param {string} place - Specifies whether the data is 'css' or 'html'.
 * @param {string} urlFile - The base URL to resolve relative paths.
 * @returns {Promise<string>} - A promise that resolves with the modified data.
 */
async function getCSSImg(data, place, urlFile, urlDepth) {
  try {
    // Regular expression to match URLs in background-image properties or img tags.
    const regex = /url\s*\(\s*/;
    let bg = data.substring(data.search(regex));
    let count = 0;
    while (bg.search(regex) !== -1 && count <= 100) {
      try {
        bg = data.substring(data.search(regex));
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
        let newImagePath =
          place === "css"
            ? "../img/" + imageName
            : (urlDepth >= 1 ? "../img/" : "img/") + imageName;
        data = data.replace(bgIni, newImagePath);
        // Download the image and include it in the zip file.
        if (!checkDuplicate(imageName, urlImage)) {
          urlImage.push({ url: imageName });
          zip.file("img/" + imageName, urlToPromise(path), { binary: true });
        }
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
  if (maxDepthValue === 0) {
    console.log(currentPage);
  } else if (maxDepthValue === 1) {
    await getLinks();
  } else {
    let queue = [];
    queue.push(currentPage);

    for (let i of [...Array(maxDepthValue).keys()]) {
      while (queue.length) {
        let url = queue.shift();
        let urls = await getLinks(url);
        for (let j of urls) {
          queue.push(j);
        }
      }
    }
  }
}

/**
 * Asynchronously processes HTML data to find and modify links to point to local files,
 * and downloads linked PDF files to include in a zip file. The function is recursive
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
  for (let anchor of parsed.getElementsByTagName("a")) {
    let relative = anchor.getAttribute("href");
    let absoluteUrl = anchor.href;

    // Skip a bunch of unneeded links
    if (
      absoluteUrl.includes("mailto") ||
      absoluteUrl.includes("tel") ||
      absoluteUrl.includes("#") ||
      checkDuplicate(absoluteUrl, urlList) ||
      absoluteUrl.length === 0
    )
      continue;

    // Assure that the chrome-extension Urls are corrected to the absolute urls
    if (absoluteUrl.includes("chrome-extension://" + extId) ||
      absoluteUrl.includes("chrome-extension://"))
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
  return tempUrls;
}

/**
 * Asynchronously processes HTML data to find and modify <iframe> elements to point to local video files,
 * and downloads video files to include in a zip file.
 *
 * @param {string} html - The HTML data as a string.
 * @returns {Promise<string>} - A promise that resolves with the modified HTML data.
 */
async function getVideos(html, url, urlDepth) {
  try {
    // Initialize a new DOMParser instance
    let dp = new DOMParser();
    // Parse the HTML string into a DOM object
    let parsed = dp.parseFromString(html, "text/html");
    // Get all iframe elements within the parsed HTML
    let testVideoElements = parsed.getElementsByTagName("iframe");
    // Convert the HTMLCollection to an array and iterate over each iframe element
    Array.from(testVideoElements).forEach(async (video) => {
      // Get the 'src' attribute of the iframe element
      let src = video.getAttribute("src");
      // If src attribute is null, exit early from this iteration
      if (src === null) return;
      // Extract the video name from the src URL and sanitize it
      let videoName = src
        .substring(src.lastIndexOf("/") + 1)
        .replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");
      // Check if the video is a duplicate and if not, add it to the list and prepare for download
      if (!checkDuplicate(videoName, urlVideo)) {
        urlVideo.push({ url: videoName });
        // Adjust the src URL to ensure it's an absolute URL
        if (src.includes("//")) {
          src = "https:" + src.substring(src.indexOf("//"));
        } else {
          src = getAbsolutePath(src, url);
        }
        // Add the video file to the zip
        zip.file("video/" + videoName, urlToPromise(src), { binary: true });
      }
      // Set the src attribute of the iframe to point to the local video file
      let newSrcPath = urlDepth >= 1 ? "../video/" : "video/";
      video.setAttribute("src", newSrcPath + videoName);
    });
    // Update the HTML string to reflect the changes made
    html = parsed.documentElement.innerHTML;
    return html;
  } catch (err) {
    // Log any errors encountered during the process
    console.error(err);
  }
  // Return the (potentially unmodified) HTML string
  return html;
}

/**
 * Asynchronously processes HTML data to find and modify <img> elements to point to local image files,
 * and downloads image files to include in a zip file.
 *
 * @param {string} html - The HTML data as a string.
 * @returns {Promise<string>} - A promise that resolves with the modified HTML data.
 */
async function getImgs(html, url, urlDepth) {
  try {
    // Parse the HTML string to a DOM object
    let dp = new DOMParser();
    let parsed = dp.parseFromString(html, "text/html");
    let testImageElements = parsed.getElementsByTagName("img");
    // Iterate over each image element and process it
    Array.from(testImageElements).forEach(async (img) => {
      let src = img.getAttribute("src");
      // If src attribute is null or a base64 encoded image, skip this iteration
      if (src === null || src.includes("base64")) return;
      // Extract the image name from the src URL and sanitize it
      let imageName = src
        .substring(src.lastIndexOf("/") + 1)
        .replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");
      // Check if the image is a duplicate and if not, add it to the list and prepare for download
      if (!checkDuplicate(imageName, urlImage)) {
        urlImage.push({ url: imageName });
        // Adjust the src URL to ensure it's an absolute URL
        if (src.includes("//")) {
          src = "https:" + src.substring(src.indexOf("//"));
        } else {
          src = getAbsolutePath(src, url);
        }
        // Add the image file to the zip
        zip.file("img/" + imageName, urlToPromise(src), { binary: true });
      }
      // Set the src attribute of the img to point to the local image file
      let newSrcPath = urlDepth >= 1 ? "../img/" : "img/";
      img.setAttribute("src", newSrcPath + imageName);
    });
    // Update the HTML string to reflect the changes made
    html = parsed.documentElement.innerHTML;
    return html;
  } catch (err) {
    // Log any errors encountered during the process
    console.error(err);
  }
  // Return the (potentially unmodified) HTML string
  return html;
}

/******************************************************SCRAPING FUNCTIONS - END*************************************************************/

/**
 * Given the URL and URL depth, updates the zip files and adds more URLs to the list.
 *
 * @param {string} url - The URL to scrape.
 * @param {number} urlDepth - The depth of URLs to scrape.
 * @returns {Promise<string>} - A promise that resolves with the scraped HTML content.
 */
// async function scrapeHtml(url, urlDepth) {
//   let html = "";

//   // Nested function to initiate the scraping process
//   const scrape = async (url) => {
//     try {
//       console.log("Scraping URL:", url);
//       html = await getData(url); // Get the HTML of the URL

//       try {
//         // Download various resources from the webpage
//         html = await getJavaScript(html, url, urlDepth); // Download external JavaScript files
//         html = await getCSS(html, url, urlDepth); // Download CSS files
//         // Download images if the user has not opted to exclude them
//         if (!isExcludeImages) {
//           html = await getImgs(html, url, urlDepth);
//         }
//         // Get additional resources like CSS images, videos, and links
//         html = await getCSSImg(html, "html", url, urlDepth);
//         html = await getVideos(html, url, urlDepth);
//         html = await getLinks(html, url);
//       } catch (err) {
//         console.error("Error in resource download:", err);
//       }

//       return html; // Return the modified HTML
//     } catch (err) {
//       console.error("Error in scraping:", err);
//     }
//   };

//   return await scrape(url); // Start the scraping process and return the result
// }
