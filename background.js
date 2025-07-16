// QueueTabber
// Copyright (C) 2025 Evelyn O'Dell
//
// This file is part of a browser extension licensed under the GNU General Public License v3.0.
// You may redistribute and/or modify it under the terms of the GPL as published by the Free Software Foundation.
//
// This extension is distributed WITHOUT ANY WARRANTY; see the LICENSE file for details.
// Full license text: https://www.gnu.org/licenses/gpl-3.0.txt

// Global state object to hold the extension's status and settings.
const state = {
  catcherEnabled: false,
  tabberEnabled: false,
  groupId: '',
  maxHitsInQueue: 10,
  refreshRate: 1,
  maxTabs: 5,
  queueCheck: 15,
  tabs: [],
  queue: [],
  lastHitCompleted: ''
};

const captchaSound = new Audio(browser.runtime.getURL('sounds/captcha.ogg'));

function textToSpeech(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices[0];

    window.speechSynthesis.speak(utterance);
}



// --- INTERVALS ---

// To hold the IDs of the setInterval timers.
let checkingQueue = null;
let catcherRunning = null;
let tabberRunning = null;
let waitingToFocusFirst = null;

function setupQueueCheckInterval() {
    if (checkingQueue) {
        clearInterval(checkingQueue);
    }
    if (state.catcherEnabled || state.tabberEnabled) {
        checkingQueue = setInterval(checkQueue, state.queueCheck * 1000);
    }
}

function setupCatcherInterval() {
    if (catcherRunning) {
        clearInterval(catcherRunning);
    }
    if (state.catcherEnabled) {
        catcherRunning = setInterval(catcher, state.refreshRate * 1000);
    }
}

function setupTabberInterval() {
    if (tabberRunning) {
        clearInterval(tabberRunning);
    }
    if (state.tabberEnabled) {
        tabberRunning = setInterval(tabber, state.refreshRate * 1000);
    }
}

function setupFocusFirstInterval() {
    if (waitingToFocusFirst) return;

    if (state.tabberEnabled && state.tabs.length < 1) {
        waitingToFocusFirst = setInterval(focusFirstTab, state.refreshRate * 1000);
    }
}

async function checkQueue() {
    // getQueueURLs() should return null if queue can't be grabbed for whatever
    // reason. In that case, just keep state.queue as it is.
    state.queue = await getQueueURLs() ?? state.queue;
    cleanUpTabs();
}

//Main function for catching HITs.
async function catcher() {
    if (!state.catcherEnabled) {
        clearInterval(catcherRunning);
    } else {
        await catchHIT(state.groupId);
    }
}

// Main function for managing tabs.
async function tabber() {
    if (!state.tabberEnabled) {
        clearInterval(tabberRunning);
    }
    else if (state.tabs.length < state.queue.length
        && state.tabs.length < state.maxTabs) {
        if (state.tabs.length === 0) {
            setupFocusFirstInterval();
        }
        const newHIT = findHitForNextTab();
        openTab(newHIT);
    }
}

// Focuses the first tab to open when tabber starts opening new HITs.
function focusFirstTab() {
    // This shouldn't be running if the tabber isn't running.
    if (!state.tabberEnabled) {
        clearInterval(waitingToFocusFirst);
        waitingToFocusFirst = null;
    }
    
    if (state.tabs.length > 0) {
        const firstTab = state.tabs[0];
        const tabIdToFocus = firstTab ? firstTab.tabId : null;
        browser.tabs.update(tabIdToFocus, { active: true });

        clearInterval(waitingToFocusFirst);
        waitingToFocusFirst = null;
    }
}



// --- CORE MESS ---

// Function to check logged in status and update queue
// before starting the catcher or tab manager.
async function preStart() {
    const signedIn = await signedInCheck();
    if (!signedIn) return;

    await checkQueue();
    setupQueueCheckInterval();
}

function disableCatcherAndTabber() {
    browser.storage.local.set({ catcherEnabled: false });
    browser.storage.local.set({ tabberEnabled: false });
    state.catcherEnabled = false;
    state.tabberEnabled = false;
}

async function getMturkQueue() {
    try {
        const response = await fetch('https://worker.mturk.com/tasks.json');
        const contentType = response.headers.get('content-type');
        if (response.ok && contentType && contentType.includes('application/json')) {
            const data = await response.json();
            return data;
        } else {
            throw new Error('QueueTabber: Could not get queue.');
        }
    } catch(error) {
        console.error(error);
        return null;
    }
}

let queueUpdating = false;
async function getQueueURLs() {
    if (queueUpdating) {
        return null;
    }
    updatingQueue = true;

    const queue = await getMturkQueue();
    if (!queue) return null;

    let tempQueue = [];
    if (queue.tasks && queue.tasks.length > 0) {
        queue.tasks.forEach(task => {
            const url = 'https://worker.mturk.com' + task.task_url;
            const urlFixed = url.split('&')[0].replace('.json', '');
            tempQueue.push(urlFixed);
        });
    }

    /**
     * Sometimes queue contains a HIT that has just been completed
     * and has not yet been removed from the MTurk queue. This then
     * causes state.queue to contain a HIT that no longer exists.
     * 
     * handleHitSubmission() should record the last HIT to be completed
     * and we can remove it here if it's still lingering.
     */
    tempQueue = removeLastHitCompletedFromQueue(tempQueue);
  
    queueUpdating = false;
    return tempQueue;
}

function removeLastHitCompletedFromQueue(queue) {
    const index = queue.indexOf(state.lastHitCompleted);
    if (index === -1) {
        return queue;
    }

    queue.splice(index, 1);
    return queue;
}

async function openTab(url) {
    const found = state.tabs.find(tab => tab.url === url);
    if (!found && typeof url !== 'undefined') {
        try {
            const lastTabIndex = await findLastTabIndex();
            const newTab = await browser.tabs.create({
                url: url,
                index: lastTabIndex + 1,
                active: false
            });
            state.tabs.push({ tabId: newTab.id, url: url });
        } catch (error) {
            console.error('Error creating tab:', error);
        }
    }
}

async function getTabTitle(tabId) {
    const tab = await browser.tabs.get(tabId);
    if (tab) {
        return tab.title;
    } else {
        return 'Tab not found';
    }
}

async function findLastTabIndex() {
    if (state.tabs.length === 0) {
        const [currentTab] = await browser.tabs.query({ 
            active: true,
            currentWindow: true
        });
        return currentTab ? currentTab.index : 0;
    }

    // To ensure correct order, get fresh info for all tabs.
    const tabPromises = state.tabs.map(
        tab => browser.tabs.get(tab.tabId).catch(() => null)
    );

    // Filter out any tabs that were closed since last check.
    const tabs = (await Promise.all(tabPromises)).filter(Boolean);

    // Find the highest index among the open tabs.
    return tabs.reduce((maxIndex, tab) => Math.max(maxIndex, tab.index), -1);
}

// Removes tabs from tab array that no longer exist 
// in queue and are no longer open in the browser.
async function cleanUpTabs() {
    if (state.tabs.length === 0) return;

    const openTabs = await browser.tabs.query({});
    const openTabIds = openTabs.map(tab => tab.id);
    state.tabs = state.tabs.filter(
        tab => openTabIds.includes(tab.tabId) && state.queue.includes(tab.url)
    );
}

function findHitForNextTab() {
    const tabURLs = [];
    state.tabs.forEach(tab => {
        tabURLs.push(tab.url);
    });
    let nextHit;
    for (let i = 0; i < state.queue.length; i++) {
        if (state.tabs.length < state.maxTabs 
           && !tabURLs.includes(state.queue[i])) {
            nextHit = state.queue[i];
            break;
        }
    }
    return nextHit;
}

function findNextTabToFocus(tabId) {
    const index = state.tabs.findIndex(tab => tab.tabId === tabId);
    const nextTabInLine = state.tabs[index + 1];
    return nextTabInLine ? nextTabInLine.tabId : null;
}

async function handleHitSubmission(details) {
    if (!state.tabberEnabled) return;

    if (details.method !== 'POST' || details.statusCode !== 302) {
        return;
    }
    console.log('All good after POST')

    // Make sure this is a QueueTabber tab.
    const index = state.tabs.findIndex(tab => tab.tabId === details.tabId);
    if (index === -1) return;

    console.log('Found index:', index)

    const nextTabIdToFocus = findNextTabToFocus(details.tabId);

    console.log('Found next ID to focus:', nextTabIdToFocus)

    // Remove this HIT from the queue array, unless it's a captcha.
    const title = await getTabTitle(details.tabId);
    const url = state.tabs[index].url;
    if (title.toLowerCase() !== 'server busy') {
        console.log('Removing HIT from queue')
        state.lastHitCompleted = url;
        const i = state.queue.indexOf(url);
        state.queue.splice(i, 1);
    }

    // Close tab before the redirect happens.
    browser.tabs.remove(details.tabId).then(() => {
        console.log('Closing tab.')
        if (nextTabIdToFocus) {
            browser.tabs.update(nextTabIdToFocus, { active: true });
        }
    }).catch(error => console.error("Error removing tab after action:", error));

    // The tabRemovedListener will handle cleaning up the tabs array
}

// Using isCatchingHIT to make sure multiple requests aren't being fired at once
let isCatchingHIT = false;
async function catchHIT(groupId) {
    if (isCatchingHIT || state.queue.length >= state.maxHitsInQueue) {
        return;
    }

    isCatchingHIT = true;
    try {
        const url = `https://worker.mturk.com/projects/${groupId}/tasks/accept_random`;
        const response = await fetch(url);

        // Checking that response.url !== url because if there's a captcha,
        // the request URL will be returned with the response. This leads to
        // the queue array being filled with garbage and messes with the tabs. 
        if (response.ok && response.url.includes(groupId) && response.url !== url) {
            const newHIT = response.url.split('&')[0];
            state.queue.push(newHIT);
        } else {
            console.log('QueueTabber: Could not grab HIT:', response.status);
        }
    } catch (error) {
        console.error('QueueTabber: Error grabbing HIT:', error);

        // Check if being signed out is the reason for the error.
        await signedInCheck();
    } finally {
        isCatchingHIT = false;
    }
}

async function signedInCheck() {
    try {
        // If signed out, the URL will attempt to redirect to an Amazon sign-in
        // page. Setting 'redirect' to 'manual' to not follow the redirect.
        const response = await fetch('https://worker.mturk.com/tasks', {
            redirect: 'manual'
        });

        if (response.type === 'opaqueredirect') {
            textToSpeech('Queue Tabber stopped. You are logged out.');
            disableCatcherAndTabber();
            return false;
        } else {
            return true;
        }
    } catch(error) {
        console.error('QueueTabber: Error checking for signed in:', error);
        return null;
    }
}



// --- EVENT LISTENERS ---

let captchaTabId = null;
function captchaListener(tabId, changeInfo, tab) {
    if (!state.tabberEnabled) return;

    const isManaged = state.tabs.some(tab => tab.tabId === tabId);
    if (!isManaged) return;

    // Check for captcha
    if (changeInfo.title && changeInfo.title.toLowerCase().includes('server busy')) {
        captchaSound.play().catch(error =>
            console.error('Error playing sound:', error)
        );

        // Set captchaTabId to this tab's ID so listener can pick up when
        // tab title changes again (presumably after captcha is completed).
        captchaTabId = tabId;
    }
    // Attempt to catch page transition after captcha is completed.
    else if (changeInfo.title && tabId === captchaTabId
        && !changeInfo.title.toLowerCase().includes('server busy')) {

        const nextTabIdToFocus = findNextTabToFocus(tabId);
        browser.tabs.remove(tabId).then(() => {
            if (nextTabIdToFocus) {
                browser.tabs.update(nextTabIdToFocus, { active: true });
            }
        }).catch(error => console.error("Error removing tab after captcha:", error));

        captchaTabId = null;
    }
}

function tabRemovedListener(tabId) {
    const wasManaged = state.tabs.some(tab => tab.tabId === tabId);
    if (wasManaged) {
        // Remove the closed tab from tab array.
        state.tabs = state.tabs.filter(tab => tab.tabId !== tabId);
    }
}

async function storageChangeListener(changes) {
    /**
     * Resetting the queue check interval if it gets modified in the popup
     * settings. This will also determine if it needs to continue running if
     * catcher or tabber are toggled off.
     * 
     * Also resetting catcher and tabber intervals if refresh rate is adjusted
     * in the popup settings.
     */
    if (changes.catcherEnabled) {
        state.catcherEnabled = changes.catcherEnabled.newValue;
        setupQueueCheckInterval();

        if (changes.catcherEnabled.newValue) {
            preStart();
            setupCatcherInterval();
        }
    }
    if (changes.tabberEnabled) {
        state.tabberEnabled = changes.tabberEnabled.newValue;
        setupQueueCheckInterval();

        if (changes.tabberEnabled.newValue) {
            preStart();
            setupTabberInterval();
        } else {
            // If the tabber was disabled, close all managed tabs.
            const tabsToClose = state.tabs.map(tab => tab.tabId);
            if (tabsToClose.length > 0) {
                browser.tabs.remove(tabsToClose);
            }
            state.tabs = [];
        }
    }
    if (changes.maxTabs) {
        state.maxTabs = changes.maxTabs.newValue;
    }
    if (changes.maxHitsInQueue) {
        state.maxHitsInQueue = changes.maxHitsInQueue.newValue;
    }
    if (changes.refreshRate) {
        state.refreshRate = changes.refreshRate.newValue;
        setupCatcherInterval();
        setupTabberInterval();
    }
    if (changes.groupId) {
        state.groupId = changes.groupId.newValue;
    }
    if (changes.queueCheck) {
        state.queueCheck = changes.queueCheck.newValue;
        setupQueueCheckInterval();
    }
}



// --- INITIALIZATION ---

async function initialize() {
    const data = await browser.storage.local.get([
        'catcherEnabled',
        'tabberEnabled',
        'maxTabs',
        'queueCheck',
        'maxHitsInQueue',
        'refreshRate',
        'groupId'
    ]);
    state.catcherEnabled = data.catcherEnabled ?? false;
    state.tabberEnabled = data.tabberEnabled ?? false;
    state.maxTabs = data.maxTabs ?? 5;
    state.maxHitsInQueue = data.maxHitsInQueue ?? 10;
    state.refreshRate = data.refreshRate ?? 1;
    state.groupId = data.groupId ?? '';
    state.queueCheck = data.queueCheck ?? 15;

    browser.storage.onChanged.addListener(storageChangeListener);
    browser.tabs.onRemoved.addListener(tabRemovedListener);
    browser.tabs.onUpdated.addListener(captchaListener);

    browser.webRequest.onHeadersReceived.addListener(
        handleHitSubmission,
        {
        urls: [
            "https://worker.mturk.com/projects/*/tasks/*/submit",
            "https://worker.mturk.com/projects/*/tasks/*"
        ],
        types: ["main_frame"]
        },
        ["blocking"]
    );

    // Make sure everything is disabled in case the browser
    // shut down while running the catcher or tabber.
    disableCatcherAndTabber();

    console.log("QueueTabber initialized.", state);
}

initialize();