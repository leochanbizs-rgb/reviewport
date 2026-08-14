/**
 * ReviewPort background service worker.
 * Review data stays in Chrome local storage; no review content is sent externally.
 */

const REVIEWPORT_DATA_KEYS = Object.freeze([
    'reviews', 'collectedReviews', 'processedReviews', 'scrapingState', 'lastUpdated',
    'shopifyExportSettings', 'productHandle', 'customExportColumns',
    'minStars', 'maxStars', 'onlyWithImages'
]);
const CLEANUP_ALARM = 'cleanupLocalReviewData';
const RETENTION_DAYS = 7;

function clearReviewPortData(callback) {
    chrome.storage.local.remove(REVIEWPORT_DATA_KEYS, callback);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveReviews') {
        chrome.storage.local.set({
            reviews: request.reviews,
            lastUpdated: new Date().toISOString()
        }, () => sendResponse({ success: true }));
        return true;
    }

    if (request.action === 'getReviews') {
        chrome.storage.local.get(['reviews'], result => {
            sendResponse({ success: true, reviews: result.reviews || [] });
        });
        return true;
    }

    if (request.action === 'clearReviews') {
        clearReviewPortData(() => sendResponse({ success: true }));
        return true;
    }

    return false;
});

function scheduleCleanup() {
    chrome.alarms?.create(CLEANUP_ALARM, { periodInMinutes: 24 * 60 });
}

chrome.runtime.onInstalled.addListener(scheduleCleanup);
chrome.runtime.onStartup?.addListener(scheduleCleanup);

chrome.alarms?.onAlarm?.addListener(alarm => {
    if (alarm.name !== CLEANUP_ALARM) return;
    chrome.storage.local.get(['lastUpdated'], result => {
        const lastUpdated = Date.parse(result.lastUpdated || '');
        if (!Number.isFinite(lastUpdated)) return;
        const ageInDays = (Date.now() - lastUpdated) / (1000 * 60 * 60 * 24);
        if (ageInDays > RETENTION_DAYS) clearReviewPortData();
    });
});
