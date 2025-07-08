// Copyright (C) 2025 Evelyn O'Dell
//
// This file is part of a browser extension licensed under the GNU General Public License v3.0.
// You may redistribute and/or modify it under the terms of the GPL as published by the Free Software Foundation.
//
// This extension is distributed WITHOUT ANY WARRANTY; see the LICENSE file for details.
// Full license text: https://www.gnu.org/licenses/gpl-3.0.txt

/**
 * Listen for 'Set-Cookie' response headers from worker.mturk.com
 * that contain "Hit-" and attempt to block them.
 * @param {object} details - Network request stuff
 */
function blockMturkHitCookies(details) {
    const modifiedHeaders = details.responseHeaders.map(header => {
        if (header.name.toLowerCase() !== 'set-cookie') {
        return header;
        }

        // The 'Hit-*' headers seem to come "bundled" with 'worker_goal=*' headers,
        // so using header.value.startsWith('Hit-') to find them wasn't enough.
        const hitIndex = header.value.search(/\bHit-/);
    
        // Keep header if 'Hit-' wasn't found
        if (hitIndex === -1) {
        return header;
        }

        // If header starts with 'Hit-', just set to null and strip out later
        if (hitIndex === 0) {
        return null;
        }

        // If the header starts with something other than 'Hit-*', like when it's
        // "bundled" with 'worker_goal=*', attempt to strip out the 'Hit-*' stuff
        // (as that's all we're interested in) and leave the rest intact.
        const fixed = header.value.substring(0, hitIndex).trim();

        //console.log("Bundled header: " + header.value);
        //console.log("Fixed header: " + fixed);
        
        header.value = fixed;
        return header;
    });

    const newHeaders = modifiedHeaders.filter(header => header !== null);
    return { responseHeaders: newHeaders };
}

browser.webRequest.onHeadersReceived.addListener(
    blockMturkHitCookies, {
        urls: ["*://worker.mturk.com/*"],
        types: ["main_frame", "sub_frame", "xmlhttprequest", "other"]
    },
    ["blocking", "responseHeaders"]
);