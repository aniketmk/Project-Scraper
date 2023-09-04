// Saves options to chrome.storage
const saveOptions = () => {
  const depth = document.getElementById('depth').value;
  const omitImages = document.getElementById('omit-imgs').checked;
  const omitVideo = document.getElementById('omit-video').checked;
  const restrictDomain = document.getElementById('restrict-domain').checked;

  chrome.storage.sync.set(
    { depth: depth, omitImages: omitImages, omitVideo: omitVideo, restrictDomain: restrictDomain },
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      // Display success message and after 1500ms, remove it from view
      status.style.opacity = '1';
      setTimeout(() => {
        status.style.opacity = '0';
      }, 1500);
    }
  );
};

// Restores the options using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.sync.get(
    (items) => {
      document.getElementById('depth').value = items.depth;
      document.getElementById('omit-imgs').checked = items.omitImages;
      document.getElementById('omit-video').checked = items.omitVideo;
      document.getElementById('restrict-domain').checked = items.restrictDomain;
    }
  );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);