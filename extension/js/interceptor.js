/**
 * ReviewPort MAIN-world review-response interceptor.
 *
 * The content script enables this hook only while a user-started scan is running.
 * It observes a small allowlist of TikTok Shop review-list response paths, processes
 * matching response data locally, and relays recognised review objects to the content script.
 */
(function () {
    if (window.__reviewPortInterceptorController) return;
    window.__reviewPortInterceptorController = true;

    const MAX_CAPTURE_BYTES = 512 * 1024;
    // TikTok Shop can return the same first-party review-list response from the
    // product-page origin or a TikTok Shop API subdomain. The allowlist is still
    // host-bound and path-bound; it never accepts arbitrary third-party hosts.
    const REVIEW_API_HOSTS = [
        /^(?:[a-z0-9-]+\.)*tiktok\.com$/i,
        /^(?:[a-z0-9-]+\.)*tiktokv\.com$/i
    ];
    const REVIEW_LIST_PATHS = [
        // TikTok Shop desktop serves the review block inside the product page data
        // response. The path contains no "review" segment, so the older patterns below
        // never matched it and no review response was ever observed on these pages.
        // Region segment is optional: /api/shop/pdp_desktop/page_data and
        // /api/shop/us/pdp_desktop/page_data are both in use.
        /\/api\/(?:v\d+\/)?shop\/(?:[a-z]{2}\/)?pdp(?:_desktop)?\/page_data\/?$/i,
        /\/api\/(?:v\d+\/)?shop\/(?:[a-z]{2}\/)?pdp(?:_desktop)?\/(?:get_)?review(?:_list|s)?\/?$/i,
        /\/api\/(?:v\d+\/)?(?:shop\/)?product\/review\/(?:list|get_review_list)\/?$/i,
        /\/api\/(?:v\d+\/)?(?:shop\/)?review\/(?:list|get_review_list)\/?$/i,
        /\/api\/(?:v\d+\/)?(?:ecommerce\/)?review\/(?:list|get_review_list)\/?$/i,
        /\/api\/(?:v\d+\/)?commerce\/review\/(?:list|get_review_list)\/?$/i
    ];

    let hooksInstalled = false;
    let captureActive = false;
    let originalFetch = null;
    let originalOpen = null;
    let originalSend = null;
    let patchedFetch = null;
    let patchedOpen = null;
    let patchedSend = null;

    function isReviewListUrl(rawUrl) {
        if (!rawUrl) return false;
        try {
            const url = new URL(String(rawUrl), window.location.href);
            const allowedHost = REVIEW_API_HOSTS.some(pattern => pattern.test(url.hostname));
            return allowedHost && REVIEW_LIST_PATHS.some(pattern => pattern.test(url.pathname));
        } catch (error) {
            return false;
        }
    }

    function isWithinCaptureLimit(text) {
        return typeof text === 'string' && text.length * 2 <= MAX_CAPTURE_BYTES;
    }

    function extractReviewsFromJson(obj, found) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
            for (const item of obj) extractReviewsFromJson(item, found);
            return;
        }
        if (obj.review_id && (obj.review_text !== undefined || obj.review_rating !== undefined)) {
            found.push(obj);
            return;
        }
        for (const key of Object.keys(obj)) extractReviewsFromJson(obj[key], found);
    }

    function relayIfReviews(url, jsonText) {
        if (!captureActive || !isWithinCaptureLimit(jsonText)) return;
        try {
            const data = JSON.parse(jsonText);
            const found = [];
            extractReviewsFromJson(data, found);
            if (found.length) {
                window.postMessage({
                    source: 'reviewport-interceptor',
                    type: 'reviews-captured',
                    url: String(url),
                    reviews: found
                }, '*');
            }
        } catch (error) {
            // Non-JSON or an unexpected response is ignored without affecting TikTok's page.
        }
    }

    function observeFetchResponse(url, response) {
        if (!captureActive) return;
        try {
            const contentLength = Number(response.headers && response.headers.get('content-length'));
            if (Number.isFinite(contentLength) && contentLength > MAX_CAPTURE_BYTES) return;
            response.clone().text()
                .then(text => relayIfReviews(url, text))
                .catch(() => {});
        } catch (error) {
            // Observation must never affect the original fetch promise.
        }
    }

    function observeXhrResponse(xhr) {
        if (!captureActive) return;
        try {
            if (xhr.responseType === '' || xhr.responseType === 'text') {
                relayIfReviews(xhr.__reviewPortReviewUrl, xhr.responseText || '');
            } else if (xhr.responseType === 'json' && xhr.response) {
                const serialized = JSON.stringify(xhr.response);
                relayIfReviews(xhr.__reviewPortReviewUrl, serialized);
            }
        } catch (error) {
            // Observation must never affect TikTok's XHR load handling.
        }
    }

    function installHooks() {
        if (hooksInstalled) return;
        originalFetch = window.fetch;
        originalOpen = XMLHttpRequest.prototype.open;
        originalSend = XMLHttpRequest.prototype.send;

        patchedFetch = function (...args) {
            const url = (args[0] && args[0].url) ? args[0].url : args[0];
            const result = originalFetch.apply(this, args);
            try {
                if (captureActive && isReviewListUrl(url)) {
                    Promise.resolve(result).then(response => observeFetchResponse(url, response)).catch(() => {});
                }
            } catch (error) {
                // Preserve the original result even if ReviewPort observation fails.
            }
            return result;
        };

        patchedOpen = function (method, url, ...rest) {
            try {
                this.__reviewPortReviewUrl = url;
            } catch (error) {
                // Do not interfere with the native XHR open call.
            }
            return originalOpen.call(this, method, url, ...rest);
        };

        patchedSend = function (...args) {
            try {
                if (captureActive && isReviewListUrl(this.__reviewPortReviewUrl)) {
                    this.addEventListener('load', () => observeXhrResponse(this), { once: true });
                }
            } catch (error) {
                // Do not interfere with the native XHR send call.
            }
            return originalSend.apply(this, args);
        };

        window.fetch = patchedFetch;
        XMLHttpRequest.prototype.open = patchedOpen;
        XMLHttpRequest.prototype.send = patchedSend;
        hooksInstalled = true;
    }

    function restoreHooks() {
        if (!hooksInstalled) return;
        try {
            if (window.fetch === patchedFetch) window.fetch = originalFetch;
            if (XMLHttpRequest.prototype.open === patchedOpen) XMLHttpRequest.prototype.open = originalOpen;
            if (XMLHttpRequest.prototype.send === patchedSend) XMLHttpRequest.prototype.send = originalSend;
        } catch (error) {
            // A third party may have replaced a native method; never overwrite it blindly.
        } finally {
            hooksInstalled = false;
            patchedFetch = null;
            patchedOpen = null;
            patchedSend = null;
        }
    }

    function setCaptureActive(active) {
        captureActive = Boolean(active);
        if (captureActive) installHooks();
        else restoreHooks();
        window.postMessage({
            source: 'reviewport-interceptor',
            type: 'review-hook-state',
            active: captureActive,
            installed: hooksInstalled
        }, '*');
    }

    window.addEventListener('message', event => {
        if (event.source !== window) return;
        const message = event.data;
        if (!message || message.source !== 'reviewport-content' || message.type !== 'review-hook-control') return;
        if (message.action === 'start') setCaptureActive(true);
        if (message.action === 'stop') setCaptureActive(false);
    });
})();
