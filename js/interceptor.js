/**
 * Network Interceptor - Injected into MAIN world
 * Hooks fetch and XHR to capture TikTok Shop review API responses.
 * Captured reviews are relayed to the content script via window.postMessage.
 */
(function () {
    if (window.__ttrhInterceptorInstalled) return;
    window.__ttrhInterceptorInstalled = true;

    const REVIEW_URL_HINTS = ['review', 'list'];

    function looksLikeReviewUrl(url) {
        if (!url) return false;
        const u = String(url).toLowerCase();
        return u.includes('review');
    }

    function extractReviewsFromJson(obj, found) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
            for (const item of obj) extractReviewsFromJson(item, found);
            return;
        }
        // A review object has these signature fields
        if (obj.review_id && (obj.review_text !== undefined || obj.review_rating !== undefined)) {
            found.push(obj);
            return;
        }
        for (const key of Object.keys(obj)) {
            extractReviewsFromJson(obj[key], found);
        }
    }

    function relayIfReviews(url, jsonText) {
        try {
            const data = JSON.parse(jsonText);
            const found = [];
            extractReviewsFromJson(data, found);
            if (found.length > 0) {
                window.postMessage({
                    source: 'ttrh-interceptor',
                    type: 'reviews-captured',
                    url: String(url),
                    reviews: found
                }, '*');
            }
        } catch (e) {
            /* not JSON, ignore */
        }
    }

    // ---- Hook fetch ----
    const origFetch = window.fetch;
    window.fetch = function (...args) {
        const url = (args[0] && args[0].url) ? args[0].url : args[0];
        const p = origFetch.apply(this, args);
        if (looksLikeReviewUrl(url)) {
            p.then(resp => {
                try {
                    const clone = resp.clone();
                    clone.text().then(text => relayIfReviews(url, text)).catch(() => {});
                } catch (e) { /* ignore */ }
            }).catch(() => {});
        }
        return p;
    };

    // ---- Hook XHR ----
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this.__ttrhUrl = url;
        return origOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function (...args) {
        if (looksLikeReviewUrl(this.__ttrhUrl)) {
            this.addEventListener('load', () => {
                try {
                    if (this.responseType === '' || this.responseType === 'text') {
                        relayIfReviews(this.__ttrhUrl, this.responseText);
                    } else if (this.responseType === 'json' && this.response) {
                        relayIfReviews(this.__ttrhUrl, JSON.stringify(this.response));
                    }
                } catch (e) { /* ignore */ }
            });
        }
        return origSend.apply(this, args);
    };

    console.log('[TTRH] Network interceptor installed');
})();
