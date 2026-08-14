/**
 * ReviewPort scan controller.
 * This popup only configures review collection and opens the local report.
 */

const reviewFilter = new ReviewFilter();

let collectedReviews = [];
let processedReviews = [];
let pollInterval = null;
const PHOTO_PREFERENCE_MIGRATION = 2;

const minStarsSelect = document.getElementById('minStars');
const maxStarsSelect = document.getElementById('maxStars');
const targetReviewsInput = document.getElementById('targetReviews');
const targetEstimate = document.getElementById('targetEstimate');
const onlyWithImagesCheckbox = document.getElementById('onlyWithImages');
const startScrapingBtn = document.getElementById('startScraping');
const pauseScrapingBtn = document.getElementById('pauseScraping');
const stopScrapingBtn = document.getElementById('stopScraping');
const resumeScrapingBtn = document.getElementById('resumeScraping');
const openFullPreviewBtn = document.getElementById('openFullPreview');
const clearDataBtn = document.getElementById('clearData');
const openGettingStartedBtn = document.getElementById('openGettingStarted');
const statusDiv = document.getElementById('status');
const connectionPill = document.getElementById('connectionPill');
const progressBar = document.getElementById('progressBar');
const reviewCountDiv = document.getElementById('reviewCount');
const progressElement = document.querySelector('.progress');

startScrapingBtn.addEventListener('click', () => startScraping(false));
pauseScrapingBtn.addEventListener('click', pauseScanning);
stopScrapingBtn.addEventListener('click', stopScanning);
resumeScrapingBtn.addEventListener('click', () => startScraping(true));
openFullPreviewBtn.addEventListener('click', () => openFullPreview(false));
clearDataBtn.addEventListener('click', clearData);
openGettingStartedBtn.addEventListener('click', openGettingStarted);
[minStarsSelect, maxStarsSelect, targetReviewsInput, onlyWithImagesCheckbox]
    .forEach(element => element.addEventListener('change', savePreferences));
document.querySelectorAll('.help-tip').forEach(button => {
    button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
    });
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.activeElement?.classList.contains('help-tip')) {
        document.activeElement.blur();
    }
});

chrome.storage.local.get([
    'minStars', 'maxStars', 'targetReviews', 'maxPages', 'onlyWithImages', 'photoPreferenceMigration',
    'collectedReviews', 'scrapingState'
], result => {
    if (result.minStars) minStarsSelect.value = result.minStars;
    if (result.maxStars) maxStarsSelect.value = result.maxStars;
    if (result.targetReviews) targetReviewsInput.value = Math.max(1, Math.min(10000, parseInt(result.targetReviews, 10) || 30));
    else if (result.maxPages) targetReviewsInput.value = Math.max(1, Math.min(10000, (parseInt(result.maxPages, 10) || 10) * 3));

    if (result.photoPreferenceMigration === PHOTO_PREFERENCE_MIGRATION) {
        onlyWithImagesCheckbox.checked = Boolean(result.onlyWithImages);
    } else {
        onlyWithImagesCheckbox.checked = false;
        chrome.storage.local.set({
            onlyWithImages: false,
            photoPreferenceMigration: PHOTO_PREFERENCE_MIGRATION
        });
    }

    if (Array.isArray(result.collectedReviews) && result.collectedReviews.length) {
        collectedReviews = result.collectedReviews;
        applyFiltersOnly();
        openFullPreviewBtn.disabled = processedReviews.length === 0;
        updateStatus(`${processedReviews.length} matching reviews are ready to review.`, 'success');
    } else {
        updateReviewCount();
    }

    const activeState = result.scrapingState;
    updateTargetEstimate(activeState?.reviewMetrics, activeState?.options);
    const stateValue = activeState && (activeState.status || activeState.state);
    if (stateValue === 'paused') {
        handlePausedState(activeState);
    } else if (stateValue === 'stopped') {
        onScrapingStopped(activeState);
    } else if (activeState && ['running', 'starting'].includes(stateValue)) {
        if (Date.now() - activeState.timestamp < 60000) {
            startScrapingBtn.disabled = true;
            pauseScrapingBtn.hidden = false;
            pauseScrapingBtn.disabled = false;
            stopScrapingBtn.hidden = false;
            stopScrapingBtn.disabled = false;
            resumeScrapingBtn.hidden = true;
            updatePill('Scanning', 'running');
            startPolling();
        }
    }
});

function savePreferences() {
    chrome.storage.local.set({
        minStars: minStarsSelect.value,
        maxStars: maxStarsSelect.value,
        targetReviews: Math.max(1, Math.min(10000, parseInt(targetReviewsInput.value, 10) || 30)),
        onlyWithImages: onlyWithImagesCheckbox.checked,
        photoPreferenceMigration: PHOTO_PREFERENCE_MIGRATION
    });

    if (collectedReviews.length) {
        applyFiltersOnly();
        openFullPreviewBtn.disabled = processedReviews.length === 0;
    }
}

function updateTargetEstimate(metrics, options = {}) {
    if (!targetEstimate || !metrics) return;
    const target = Math.max(1, Number(options.targetReviews || targetReviewsInput.value) || 30);
    const eligible = Number.isFinite(metrics.displayed) ? metrics.displayed : metrics.total;
    const pageCount = Number(options.maxPages) || 0;
    if (Number.isFinite(eligible) && eligible >= 0) {
        const actualTarget = Math.min(target, eligible);
        const pageText = pageCount ? ` · ~${pageCount} pages` : '';
        targetEstimate.textContent = `${eligible} matching reviews available${pageText}. ReviewPort will collect up to ${actualTarget}.`;
    }
}

function updatePill(label, type = 'ready') {
    connectionPill.textContent = label;
    connectionPill.classList.toggle('is-running', type === 'running');
    connectionPill.classList.toggle('is-error', type === 'error');
    connectionPill.classList.toggle('is-paused', type === 'paused');
}

function updateStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.dataset.type = type;
    if (type === 'error') updatePill('Needs attention', 'error');
    else if (type === 'paused') updatePill('Paused', 'paused');
    else if (type === 'success') updatePill('Ready', 'ready');
    else if (type === 'running') updatePill('Scanning', 'running');
}

function setButtonLabel(button, icon, label) {
    const iconElement = document.createElement('span');
    iconElement.className = 'button-icon';
    iconElement.setAttribute('aria-hidden', 'true');
    iconElement.textContent = icon;
    button.replaceChildren(iconElement, document.createTextNode(` ${label}`));
    button.setAttribute('aria-label', label);
}

function handlePausedState(state) {
    stopPolling();
    startScrapingBtn.disabled = false;
    pauseScrapingBtn.hidden = true;
    pauseScrapingBtn.disabled = false;
    stopScrapingBtn.hidden = true;
    stopScrapingBtn.disabled = false;
    resumeScrapingBtn.hidden = false;
    resumeScrapingBtn.disabled = false;
    const resumeLabel = state.pauseReason === 'verification'
        ? 'Resume after verification'
        : state.pauseReason === 'native_rating'
            ? 'Retry selected star filter'
            : 'Resume scan';
    setButtonLabel(resumeScrapingBtn, '▶', resumeLabel);
    if (collectedReviews.length) {
        applyFiltersOnly();
        openFullPreviewBtn.disabled = processedReviews.length === 0;
    }
    updateProgress(state.progress || 0);
    updateStatus(
        state.message || 'Paused safely. Review the TikTok product page, then select the action shown above to continue.',
        'paused'
    );
}

function updateProgress(percentage) {
    const safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0));
    progressBar.style.width = `${safePercentage}%`;
    const rounded = Math.round(safePercentage);
    progressElement.setAttribute('aria-valuenow', String(rounded));
    progressElement.setAttribute('aria-valuetext', `${rounded}% complete`);
}

function updateReviewCount() {
    reviewCountDiv.textContent = `${collectedReviews.length} scanned`;
}

function applyFiltersOnly() {
    const reviews = structuredClone(collectedReviews);
    processedReviews = reviewFilter.applyFilters(reviews, {
        minStars: Number(minStarsSelect.value),
        maxStars: Number(maxStarsSelect.value),
        onlyWithImages: onlyWithImagesCheckbox.checked
    });
    updateReviewCount();
    chrome.storage.local.set({ processedReviews });
}

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
        chrome.storage.local.get(['scrapingState', 'collectedReviews'], result => {
            const state = result.scrapingState;
            if (!state) return;
            const stateValue = state.status || state.state;

            if (Array.isArray(result.collectedReviews)) {
                collectedReviews = result.collectedReviews;
                updateReviewCount();
            }
            updateProgress(state.progress);
            updateTargetEstimate(state.reviewMetrics, state.options);

            if (stateValue === 'paused') {
                handlePausedState(state);
            } else if (stateValue === 'completed') {
                stopPolling();
                onScrapingCompleted();
            } else if (stateValue === 'stopped') {
                stopPolling();
                onScrapingStopped(state);
            } else if (stateValue === 'error') {
                stopPolling();
                startScrapingBtn.disabled = false;
                pauseScrapingBtn.hidden = true;
                stopScrapingBtn.hidden = true;
                resumeScrapingBtn.hidden = true;
                updateStatus(state.message || 'The scan could not be completed.', 'error');
            } else {
                updateStatus(state.message || 'Scanning reviews…', 'running');
            }
        });
    }, 1000);
}

function stopPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = null;
}

function onScrapingCompleted() {
    startScrapingBtn.disabled = false;
    pauseScrapingBtn.hidden = true;
    stopScrapingBtn.hidden = true;
    resumeScrapingBtn.hidden = true;
    if (!collectedReviews.length) {
        updateProgress(0);
        updateStatus('No reviews found. Scroll to the review section and try again.', 'error');
        return;
    }

    applyFiltersOnly();
    updateProgress(100);
    openFullPreviewBtn.disabled = processedReviews.length === 0;
    if (!processedReviews.length) {
        updateStatus('The scan finished, but no reviews match the selected filters.', 'error');
        return;
    }

    updateStatus(`${processedReviews.length} matching reviews are ready. Opening the full report…`, 'success');
    window.setTimeout(() => openFullPreview(true), 220);
}

async function startScraping(resume = false) {
    try {
        startScrapingBtn.disabled = true;
        pauseScrapingBtn.hidden = true;
        stopScrapingBtn.hidden = true;
        resumeScrapingBtn.disabled = true;
        resumeScrapingBtn.hidden = true;
        if (!resume) openFullPreviewBtn.disabled = true;

        updateProgress(resume ? 5 : 2);
        updateStatus(resume ? 'Restoring the saved scan safely…' : 'Preparing the page for a scan…', 'running');

        if (!resume) {
            collectedReviews = [];
            processedReviews = [];
            updateReviewCount();
            await chrome.storage.local.set({
                collectedReviews: [],
                processedReviews: [],
                scrapingState: { status: 'starting', progress: 2, timestamp: Date.now(), message: 'Preparing scan…' }
            });
        }

        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!currentTab?.id || !currentTab.url?.startsWith('https://shop.tiktok.com/')) {
            throw new Error('Open a TikTok Shop product page before scanning.');
        }

        let pingOk = false;
        try {
            const pingResponse = await chrome.tabs.sendMessage(currentTab.id, { action: 'ping' });
            pingOk = Boolean(pingResponse && (pingResponse.loaded || pingResponse.pong));
        } catch (_) {
            pingOk = false;
        }

        if (!pingOk) {
            updateStatus('Connecting to the page…', 'running');
            await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, files: ['js/content.js'] });
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const targetReviews = Math.max(1, Math.min(10000, parseInt(targetReviewsInput.value, 10) || 30));
        const response = await chrome.tabs.sendMessage(currentTab.id, {
            action: resume ? 'resumeScraping' : 'startScraping',
            options: {
                targetReviews,
                minStars: Number(minStarsSelect.value),
                maxStars: Number(maxStarsSelect.value)
            }
        });

        if (!response || !response.started) throw new Error('Review scan did not start. Refresh the product page and try again.');
        pauseScrapingBtn.hidden = false;
        pauseScrapingBtn.disabled = false;
        stopScrapingBtn.hidden = false;
        stopScrapingBtn.disabled = false;
        startPolling();
    } catch (error) {
        console.error('ReviewPort scan error:', error);
        updateProgress(0);
        updateStatus(error.message || 'Something went wrong while starting the scan.', 'error');
        startScrapingBtn.disabled = false;
        pauseScrapingBtn.hidden = true;
        stopScrapingBtn.hidden = true;
        resumeScrapingBtn.disabled = false;
        stopPolling();
    }
}

async function sendScanControl(action, pendingMessage) {
    try {
        pauseScrapingBtn.disabled = true;
        stopScrapingBtn.disabled = true;
        updateStatus(pendingMessage, 'running');
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!currentTab?.id || !currentTab.url?.startsWith('https://shop.tiktok.com/')) {
            throw new Error('Return to the TikTok Shop product page to control the active scan.');
        }
        const response = await chrome.tabs.sendMessage(currentTab.id, { action });
        if (!response?.success) throw new Error('The scan control was not acknowledged. Refresh the product page and try again.');
        startPolling();
    } catch (error) {
        pauseScrapingBtn.disabled = false;
        stopScrapingBtn.disabled = false;
        updateStatus(error.message || 'Could not update the scan.', 'error');
    }
}

function pauseScanning() {
    return sendScanControl('pauseScraping', 'Pausing scan safely and saving collected reviews…');
}

function stopScanning() {
    return sendScanControl('stopScraping', 'Stopping scan and keeping collected reviews…');
}

function onScrapingStopped(state) {
    startScrapingBtn.disabled = false;
    pauseScrapingBtn.hidden = true;
    stopScrapingBtn.hidden = true;
    resumeScrapingBtn.hidden = true;
    pauseScrapingBtn.disabled = false;
    stopScrapingBtn.disabled = false;
    if (collectedReviews.length) {
        applyFiltersOnly();
        openFullPreviewBtn.disabled = processedReviews.length === 0;
        updateStatus(state.message || `${processedReviews.length} matching reviews were kept. Open the full report or start a new scan.`, 'success');
    } else {
        updateProgress(0);
        updateStatus(state.message || 'Scan stopped before any reviews were collected.', 'success');
    }
}

async function openGettingStarted() {
    try {
        await chrome.tabs.create({ url: chrome.runtime.getURL('getting-started.html') });
    } catch (error) {
        console.error('ReviewPort getting-started guide error:', error);
        updateStatus('Could not open the quick guide.', 'error');
    }
}

async function openFullPreview(automatic) {
    if (!processedReviews.length && collectedReviews.length) applyFiltersOnly();
    if (!processedReviews.length) {
        if (!automatic) updateStatus('Scan at least one matching review before opening the full report.', 'error');
        return;
    }

    try {
        await chrome.tabs.create({ url: chrome.runtime.getURL('review-studio.html') });
    } catch (error) {
        console.error('ReviewPort report error:', error);
        updateStatus('Could not open the full report.', 'error');
    }
}

function clearData() {
    if (!confirm('Clear all saved reviews from this browser?')) return;
    collectedReviews = [];
    processedReviews = [];
    pauseScrapingBtn.hidden = true;
    stopScrapingBtn.hidden = true;
    resumeScrapingBtn.hidden = true;
    resumeScrapingBtn.disabled = false;
    openFullPreviewBtn.disabled = true;
    updateProgress(0);
    updateReviewCount();
    chrome.storage.local.remove([
        'collectedReviews', 'processedReviews', 'scrapingState', 'reviews', 'lastUpdated',
        'shopifyExportSettings', 'productHandle', 'customExportColumns',
        'minStars', 'maxStars', 'onlyWithImages'
    ]);
    updateStatus('Saved reviews cleared from this browser.', 'success');
}

// Popup intentionally has no production console logging.
