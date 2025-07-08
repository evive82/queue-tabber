// QueueTabber
// Copyright (C) 2025 Evelyn O'Dell
//
// This file is part of a browser extension licensed under the GNU General Public License v3.0.
// You may redistribute and/or modify it under the terms of the GPL as published by the Free Software Foundation.
//
// This extension is distributed WITHOUT ANY WARRANTY; see the LICENSE file for details.
// Full license text: https://www.gnu.org/licenses/gpl-3.0.txt

const catcherToggle = document.getElementById('catcher-toggle');
const tabberToggle = document.getElementById('tabber-toggle');
const catcherText = document.getElementById('catcher-text');
const tabberText = document.getElementById('tabber-text');
const optionsLink = document.getElementById('options-link');
const maxTabsInput = document.getElementById('max-tabs-input');
const maxQueueInput = document.getElementById('max-queue-input');
const refreshInput = document.getElementById('refresh-input');
const queueCheckInput = document.getElementById('queue-check-input');
const groupIdInput = document.getElementById('panda-box');

groupIdInput.addEventListener('input', () => {
    // If a link gets pasted in, try to convert it to group ID.
    let input = groupIdInput.value;
    if (input.includes('/projects/')) {
        const match = input.match(/projects\/([^/]+)/);
        input = match ? match[1] : groupIdInput.value;

        // Update group ID input
        groupIdInput.value = input;
    }

    browser.storage.local.set({ groupId: input })
});

maxTabsInput.addEventListener('input', () => {
    browser.storage.local.set({ maxTabs: parseInt(maxTabsInput.value) })
});

maxQueueInput.addEventListener('input', () => {
    browser.storage.local.set({ maxHitsInQueue: parseInt(maxQueueInput.value) })
});

refreshInput.addEventListener('input', () => {
    browser.storage.local.set({ refreshRate: parseFloat(refreshInput.value) })
});

queueCheckInput.addEventListener('input', () => {
    browser.storage.local.set({ queueCheck: parseInt(queueCheckInput.value) })
});

/**
 * Restores the options from storage and populates the form.
 */
function restoreOptions() {
    // Set default values, then retrieve saved values.
    browser.storage.local.get({
        groupId: '',
        maxTabs: 5,
        maxHitsInQueue: 10,
        refreshRate: 1,
        queueCheck: 15
    }).then(result => {
        groupIdInput.value = result.groupId;
        maxTabsInput.value = result.maxTabs;
        maxQueueInput.value = result.maxHitsInQueue;
        refreshInput.value = result.refreshRate;
        queueCheckInput.value = result.queueCheck;
    });
}


/**
 * Updates the UI of the popup based on the stored enabled state.
 * @param {boolean} catcherEnabled - Whether the extension is currently enabled.
 */
function updateCatcherToggle(catcherEnabled) {
    catcherToggle.checked = catcherEnabled;
    catcherText.textContent = catcherEnabled ? 'HIT Catcher Enabled' : 'HIT Catcher Disabled';
    catcherText.style.color = catcherEnabled ? '#28a745' : '#dc3545';
}

function updateTabberToggle(tabberEnabled) {
    tabberToggle.checked = tabberEnabled;
    tabberText.textContent = tabberEnabled ? 'Tab Manager Enabled' : 'Tab Manager Disabled';
    tabberText.style.color = tabberEnabled ? '#28a745' : '#dc3545';
}

// When the popup is opened, load the current state from storage and update the UI.
document.addEventListener('DOMContentLoaded', () => {
    browser.storage.local.get('catcherEnabled').then(result => {
        updateCatcherToggle(result.catcherEnabled ?? false);
    });
    browser.storage.local.get('tabberEnabled').then(result => {
        updateTabberToggle(result.tabberEnabled ?? false);
    });
    restoreOptions();
});

// When the user clicks the toggle, save the new state to storage.
// The background script will listen for this change and act accordingly.
catcherToggle.addEventListener('change', () => {
    const catcherEnabled = catcherToggle.checked;
    browser.storage.local.set({ catcherEnabled: catcherEnabled });
    updateCatcherToggle(catcherEnabled);
});

tabberToggle.addEventListener('change', () => {
    const tabberEnabled = tabberToggle.checked;
    browser.storage.local.set({ tabberEnabled: tabberEnabled });
    updateTabberToggle(tabberEnabled);
});

// Listen for the disabling of catcher/tabber coming from background.js,
// and update the toggles to disabled.
browser.storage.onChanged.addListener((changes) => {
    if (changes.catcherEnabled && changes.catcherEnabled.newValue === false) {
        catcherToggle.checked = false;
        catcherText.textContent = 'HIT Catcher Disabled';
        catcherText.style.color = '#dc3545';
    }
    if (changes.tabberEnabled && changes.tabberEnabled.newValue === false) {
        tabberToggle.checked = false;
        tabberText.textContent = 'Tab Manager Disabled';
        tabberText.style.color = '#dc3545';
    }
});