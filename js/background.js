/**
 * ReviewPort background service worker.
 * This extension does not send review content to external services. Review data
 * is stored locally in Chrome only.
 */

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
        chrome.storage.local.remove(['reviews', 'collectedReviews', 'processedReviews', 'scrapingState', 'lastUpdated'], () => {
            sendResponse({ success: true });
        });
        return true;
    }

    return false;
});

function scheduleCleanup() {
    if (chrome.alarms?.create) {
        chrome.alarms.create('cleanupLocalReviewData', { periodInMinutes: 24 * 60 });
    }
}

chrome.runtime.onInstalled.addListener(details => {
    console.log(`ReviewPort ${details.reason}`);
    scheduleCleanup();
});

chrome.runtime.onStartup?.addListener(scheduleCleanup);

chrome.alarms?.onAlarm?.addListener(alarm => {
    if (alarm.name !== 'cleanupLocalReviewData') return;

    chrome.storage.local.get(['lastUpdated'], result => {
        if (!result.lastUpdated) return;
        const ageInDays = (Date.now() - new Date(result.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays > 7) {
            chrome.storage.local.remove(['collectedReviews', 'processedReviews', 'reviews', 'scrapingState', 'lastUpdated']);
            console.log('ReviewPort cleared review data older than 7 days.');
        }
    });
});

console.log('ReviewPort background service worker loaded');
