/**
 * Asynchronous function to fetch data (like HTML, CSS, or image blobs) from a specified URL.
 * @param {string} url - The URL to fetch the data from.
 * @returns {Promise<string>} - A promise that resolves to the fetched data or error if the fetch operation fails.
 */
let getData = async (url) => {
  let result = "";
  try {
    result = await $.get(url);
  } catch (error) {
    console.error("Error:", error);
  }
  return result;
};

/**
 * Asynchronous function to check if a URL is accessible.
 * @param {string} url - The URL to be checked.
 * @returns {Promise<boolean>} - A promise that resolves to true if the URL is accessible and false otherwise.
 */
let checkUrl = async (url) => {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
};

/**
 * This function receives a URL and formats it to comply with file system naming conventions.
 * It is utilized for naming HTML files, CSS files, and image files.
 * @param {string} url - The URL to be formatted.
 * @returns {string} - The formatted URL string.
 */
function getTitle(url) {
  url = url.toString().substring(8);
  // If the URL is longer than 70 characters, only the last 70 characters are used.
  if (url.length >= 70) url = url.substring(url.length - 70);
  // Replacing all non-alphanumeric characters with underscores to prevent file naming issues.
  url = url.replace(/[^a-zA-Z0-9 ]/g, "_");
  return url;
}

/**
 * Retrieves binary data from the specified URL.
 *
 * @param {string} url - The URL to retrieve data from.
 * @returns {Promise<BinaryType|string>} - A promise that resolves with the binary data or a failure message.
 */
function urlToPromise(url) {
  return new Promise((resolve) => {
    JSZipUtils.getBinaryContent(url, (err, data) => {
      if (err) {
        resolve("Failed To Find Content");
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * This function combines a relative path with a base URL to get the absolute URL.
 * @param {string} relPath - The relative path.
 * @param {string} baseUrl - The base URL.
 * @returns {URL} - The concatenated URL object.
 */
function getAbsolutePath(relPath, baseUrl) {
  // Creating a new URL object by concatenating the relative path with the base URL.
  return new URL(relPath, baseUrl);
}

/**
 * This function checks if a URL is a duplicate within a given list.
 * @param {string} e - The URL to be checked.
 * @param {Array} list - The list of URLs to check against.
 * @returns {boolean} - Returns true if the URL is found in the list, false otherwise.
 */
function checkDuplicate(url, listUrl) {
  return listUrl.some((item) => item.url === url);
}
