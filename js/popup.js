// Create BroadcastChannel for sending messages, called scraper_data
const bcb = new BroadcastChannel("scraper_data");

let currentPage;
let isExcludeImages = document.getElementById(
  "exclude-images-checkbox"
).checked;
let isFocusMode = document.getElementById("focus-mode-checkbox").checked;
let isRestrictDomain = document.getElementById(
  "restrict-domain-checkbox"
).checked;

//This fills the starting url with the current tabs url, and starts the getLinks() method
chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
  currentPage = tabs[0].url;
  // getLinks();
});

// Use a flag to let user know the extension is downloading
function setFlagDownload(bool) {
  chrome.storage.sync.set({ flagDownload: bool });
}

// When extension opens, fill the values from options, and open the popup window
document.addEventListener("DOMContentLoaded", () => {
  fillOptions();
  openWindow();
  setFlagDownload("False");
});

document.addEventListener("unload", function (event) {
  event.preventDefault();
  alert(
    "The popup window was closed. Please reopen the extension to get it back."
  );
});

// When user submits, send the form data
document
  .getElementById("submit-button")
  .addEventListener("click", checkFlagDownload);

// Global state
const globalState = {
  position: 0,
};

function TypeWriter(element, text, delay = 50) {
  let intervalId = null;

  function type() {
    if (globalState.position < text.length) {
      element.innerHTML += text.charAt(globalState.position);
      console.log(text.charAt(globalState.position));
      globalState.position++;
    } else {
      stop(); // Stop when the end of the text is reached
    }
  }

  function start() {
    if (!intervalId) {
      intervalId = setInterval(type, delay);
    }
  }

  function stop() {
    clearInterval(intervalId);
    intervalId = null;
  }

  return {
    start: start,
    stop: stop,
  };
}
const outputDiv = document.getElementById("button-title");
const writer = TypeWriter(outputDiv, "Click To Download");
const submitt = document.getElementById("submit-button");
submitt.addEventListener("mouseenter", function () {
  writer.start();
});

submitt.addEventListener("mouseleave", function () {
  writer.stop();
});

// Function to turn on the flag to check if it is downloading
function checkFlagDownload() {
  chrome.storage.sync.get((items) => {
    if (items.flagDownload === "False") {
      // Flag is off. It means the page is not downloaded
      send();
      //   setTimeout(() => {
      //     let feedbackForm = document.getElementById('feedback-form');
      //     feedbackForm.classList.toggle('feedback-form-show')
      // }, downloadTime);
    } else {
      // Create a new instance of the Bootstrap toast
      var toast = new bootstrap.Toast($("#toast"));
      // Show the toast
      toast.show();
    }
  });
}

//Sends a message containing the form data from the extension popup window
function send() {
  // popupWindow.focus(); // keep the popupWindow appear above the parent window.
  bcb.postMessage([
    currentPage,
    isImageExcluded,
    isMultipleURLs,
    depthInput,
    downloadTime,
  ]);
}

// This to alert when user input high depth
// const depthInput = document.getElementById('depth-input');
// depthInput.addEventListener('change', (event) => {
//     const depthValue = event.target.value;
//     const alert = document.getElementById('alert-depth')
//     // Check value of depth is high
//     if (depthValue >1) {
//       alert.hidden=false;
//     }else {
//       alert.hidden=true;
//     }
//   });

// Set the appropriate options values from chrome.storage
function fillOptions() {
  chrome.storage.sync.get((items) => {
    document.getElementById("depth-input").value = items.depth;
    document.getElementById("omit-imgs").checked = items.omitImages;
    // The following is commented out since we do not have these options implemented
    // document.getElementById('omit-video').checked = items.omitVideo;
    // document.getElementById('restrict-domain').checked = items.restrictDomain;
  });
}

function openWindow() {
  // parameters for the window we will open
  let params = `scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no,
width=375,height=275,left=100,top=100,dependent=yes`;

  // Opens a new window which executes the scraping code from window.js
  let popupWindow;

  // open window and assign the WindowProxy object to popupWindow
  popupWindow = window.open("../html/window.html", "scraper_window", params);

  // once the window is loaded, add a listeners
  popupWindow.onload = function () {
    // try to prevent user from closing the window
    popupWindow.addEventListener("beforeunload", function (event) {
      event.preventDefault();
      event.returnValue =
        "Are you sure? Closing the popup window will prevent the extension from working.";
    });
    // if the user closes the window, tell the user how to reopen it
    popupWindow.addEventListener("unload", function (event) {
      event.preventDefault();
      alert(
        "The popup window was closed. Please reopen the extension to get it back."
      );
    });
  };
}
