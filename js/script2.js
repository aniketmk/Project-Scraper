// NOTES:
// Document is the webpage html.

// This is the list of pages we have actually crawled through.
const crawledList = new Set();
let queue;
// This is for the domain name so that we can check that links are in the same domain
let domain;

let initialDepth;

// parseURLS takes a string representation of a html document and returns all of the a tags on the page
function parseURLS(htmlString) {
	let parser = new DOMParser();
	let parsedHtml = parser.parseFromString(htmlString, 'text/html');

	let atags = parsedHtml.getElementsByTagName("a");
	return atags;
}

// This listens for the user pressing the
chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
        // check that the message says to begin crawling
        if (request[3] === "beginCrawl") {
            // get url from message
            let urlSubmission = request[0];
            //get domain from url
            domain = new URL(urlSubmission);
            domain = domain.hostname;

            // depth is 1 by default, if the user entered a depth get that instead
            let depth = 0;
                if (request[1] === '') {
                } else {
                    depth = request[1];
                }
            initialDepth = depth;
            // get user's ZIP checkbox selection. Currently, we do nothing with this information.
            let zipSubmission = request[2];

            getURLS(); // all urls on the first page.
            //console.log(queue);

            //crawl2(queue, depth); // pass url and depth to crawl function to run recursively
            //console.log("List of all urls crawled:");
            //console.log(crawledList);
            
            sendResponse({message: "received"});
            //console.log("Done");
        } //end if

        if(request[3]=="print_message"){
            console.log(request[4])
        }

}); // end of listener block

// grabs all the urls on first page, put them in a set, return set
function getURLS() {
	console.log("Getting urls at starting page");
	queue = new Set(); // "queue", no duplicates
    let links =  document.links; // all links on the page
    for (var i = 0; i <= 100; i++) {
    	try { 
    		queue.add(links[i].href.toString()); //one would add checks for a link
            
    	} catch {
    		console.log("Oops");
    	}
    }
    let crawlerData = ["crawler", "crawledList", Array.from(queue)];
        chrome.runtime.sendMessage({
        crawlerData
     });

    return queue; // return the set of all the urls on the page.
}

async function crawl2(currentQueue, depth) {

    // Exit once we have reached the end of our depth
    if (depth >= 0) {
        let localQueue = await queueForEach(currentQueue, depth);
        console.log("Depth is:");
        console.log(depth);
    }

} // end of the crawl2

async function queueForEach(currentQueue, currentDepth) {

    let localQueue = new Set();

	const p = new Promise(function (resolve, reject) {
        var i = 0;
        currentQueue.forEach(function(url) {
            
    		fetch(url, {credentials: "same-origin"})
    			.then(response => {
    			    if (response.ok) {
    			        return response.text();
    			    }
    			    throw new Error('Fetch went wrong');
    			})
    			.then(data => {
    			    // If we are able to make the fetch on the url, add it to the crawled list
    			    crawledList.add(url);
    			    // Get the a tags from the html of the requested page
    				let links = parseURLS(data);

                    // Add every a tag to our queue
    				for (var i = 0; i <= links.length; i++) {
    	    			try {
    	    				localQueue.add(links[i].href);
    	    			} catch {
    	    				console.log("Oopsy");
    	    			}
    	    		}
    	    		// Uncomment to view each URL being worked on
    	    		/*console.log("Finished working on: ");
    	    		console.log(url);*/
    			})
    			// if we get an error, see if our list reached the "done" entry in our set
    			// then, resolve our promise so that we can continue with the next depth
    			.catch((error) => {
    			    console.log(url);
    			    if (url == "done") {
                        console.log("done");
    			        resolve(localQueue);
    			    }
                    console.log(error)
                });	// end of the fetch!
            //document.getElementById("progressChecker").innerHTML = crawledList.size+" out of "+queue.size;
            let progress = ["progress", i, currentQueue.size,"Crawling depth "+(initialDepth-currentDepth)+"..."];
            chrome.runtime.sendMessage({
                progress
            });
            i++;
    	}); // end of the queue loop
        i=0;
    }); // end of promise
    p.then(() => {
        localQueue.add("done");
        console.log(domain);
        console.log("Local Queue:");
        console.log(localQueue);

        // add all URLS with the same domain from our local queue to our crawled list
        localQueue.forEach(function(url) {
            var i = 0;
            try {
                let tempURL = new URL(url);
                if (tempURL.hostname === domain) {
                    crawledList.add(url);
                }
            }
            catch {}
        }); // end forEach

        // check for depth dropping below 0, once it does we can return our crawled list to the
        // extension so that we can download the list of website our crawler found
        let depthChecker = currentDepth - 1;
        console.log("depthChecker is:" + depthChecker);
        if (depthChecker < 0) {
            console.log("List of all urls crawled:");
            console.log(crawledList);
            console.log("Done");
            let crawledArray = Array.from(crawledList);
            console.log("This is the array we send:")
            console.log(crawledArray);
            let crawlerData = ["crawler", "crawledList", crawledArray];
            chrome.runtime.sendMessage({
                crawlerData
            });
        }

        // recursive call subtracting the depth
        crawl2(localQueue, --currentDepth);
    }); // end of p.then
} // end of queueForEach