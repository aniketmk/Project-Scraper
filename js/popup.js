// Initialize a BroadcastChannel named 'scraper_data' to facilitate message communication.
const broadcastChannel = new BroadcastChannel("scraper_data");

// Declare a variable to hold the URL of the current page.
let currentPage;

// Get the DOM elements to apply the typewriter effect and to attach the event listeners.
const submitButton = document.getElementById("submit-button");
const buttonTitle = document.getElementById("button-title");

// Get the DOM  elements to control persistent saving options
const excludeImages = document.getElementById("exclude-images-checkbox");
const focusMode = document.getElementById("focus-mode-checkbox");
const restrictDomain = document.getElementById("restrict-domain-checkbox");

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
  openWindow();
});

// Event listener that triggers when the window is about to unload (close).
// It prevents the unload event and alerts the user with a message.
document.addEventListener("unload", (event) => {
  event.preventDefault();
  alert(
    "The popup window was closed. Please reopen the extension to get it back."
  );
});

/**
 * This function creates a typewriter effect on a given element.
 * @param {HTMLElement} element - The DOM element where the typewriter effect displays the text.
 * @param {string} text - The text to be displayed with the typewriter effect.
 * @param {number} [delay=50] - The delay between each character typing in milliseconds (default is 50ms).
 * @returns An object containing start and stop methods to control the typewriter effect.
 */
const TypeWriter = (element, text, delay = 50) => {
  let intervalId = null;

  function type() {
    // Adds one character at a time to the element's innerHTML until the whole text is typed.
    if (globalState.position < text.length) {
      element.innerHTML += text.charAt(globalState.position);
      // console.log(text.charAt(globalState.position));
      globalState.position++;
    } else {
      stop(); // Stops the typing once the end of the text is reached.
    }
  }

  function start() {
    // Starts the typewriter effect with a set interval if it's not already running.
    if (!intervalId) {
      intervalId = setInterval(type, delay);
    }
  }

  function stop() {
    // Stops the typewriter effect by clearing the interval and resetting the interval ID.
    clearInterval(intervalId);
    intervalId = null;
  }

  // Exposes the start and stop methods to control the typewriter effect externally.
  return {
    start: start,
    stop: stop,
  };
};

// Create a typewriter instance with the target element and text.
const writer = TypeWriter(buttonTitle, "Click To Download");

// Adds event listeners to the submit button to start the typewriter effect on mouse enter respectively.
submitButton.addEventListener("mouseenter", () => {
  writer.start();
});

// Adds event listeners to the submit button to stop the typewriter effect on mouse leave respectively.
submitButton.addEventListener("mouseleave", () => {
  writer.stop();
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
      sendToWindowInstance();
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
 * Sends a message containing the form data from the extension popup window through the broadcast channel.
 * This function seems to be referencing undefined variables and
 * make sure to define or import all necessary variables before using this function.
 */
function sendToWindowInstance() {
  // Send the form data as an array through the broadcast channel.
  broadcastChannel.postMessage([
    currentPage,
    isExcludeImages,
    isFocusMode,
    isRestrictDomain,
  ]);
}

/**
 * Retrieves options values from the Chrome storage and fills the form inputs with those values.
 * This function is responsible for populating the initial state of options in the popup window.
 */
function fillOptions() {
  chrome.storage.sync.get((items) => {
    console.log(items);
    isExcludeImages = items.isExcludeImages;
    isFocusMode = items.isFocusMode;
    isRestrictDomain = items.isRestrictDomain;
  });
}

/**
 * Opens a new popup window to run the scraping script found in window.js. This function also sets up listeners
 * to prevent users from accidentally closing the window and to instruct them on how to reopen it if closed.
 */
function openWindow() {
  // Define the parameters for the new popup window.
  let params = `
    scrollbars=no,
    resizable=no,
    status=no,
    location=no,
    toolbar=no,
    menubar=no,
    width=355,
    height=275,
    left=100,
    top=100,
    dependent=yes
  `;

  // Opens a new window and assign the WindowProxy object to popupWindow to execute the scraping code from window.js
  let popupWindow = window.open(
    "../html/window.html",
    "scraper_window",
    params
  );

  if (
    !popupWindow ||
    popupWindow.closed ||
    typeof popupWindow.closed == "undefined"
  ) {
    // Ask user to allow pop-ups for the specific website
    alert("Please allow pop-ups for this website in order to download it.");
  }

  // Setup event listeners once the window is loaded.
  popupWindow.onload = function () {
    // Adds an event listener to prevent the user from unintentionally closing the window by prompting a confirmation message
    popupWindow.addEventListener("beforeunload", (event) => {
      event.preventDefault();
      event.returnValue =
        "Are you sure? Closing the progress window will prevent the extension from working.";
    });

    // Adds an event listener to alert the user with steps to reopen the popup window if they choose to close it
    popupWindow.addEventListener("unload", (event) => {
      event.preventDefault();
      alert(
        "The progress window  was closed. Please reopen the extension to get it back."
      );
    });
  };
}
