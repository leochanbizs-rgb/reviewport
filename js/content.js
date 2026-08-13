/**
 * Content Script - TikTok Shop Review Scraper v3.0
 *
 * Strategy (based on real DOM/JSON analysis):
 * 1. Page 1 reviews are embedded in <script id="__MODERN_ROUTER_DATA__"> as JSON.
 * 2. Subsequent pages load via XHR API -> captured by interceptor.js (MAIN world hook)
 *    which relays review JSON objects through window.postMessage.
 * 3. Pagination is driven by clicking the「下一個」/ "Next" div button.
 *
 * Review JSON fields (confirmed):
 *   reviewer_name, review_rating (1-5 int), review_text, review_time (ms timestamp),
 *   sku_specification, review_images[] (photo urls), review_id
 *
 * Output fields (user requirement): username, rating, description, sku, date, photo_urls
 */

(function () {
    if (window.__ttrhContentLoaded) {
        console.log('[ReviewPort] Content script already loaded');
        return;
    }
    window.__ttrhContentLoaded = true;

    // ==================== Interceptor injection (MAIN world) ====================
    function injectInterceptor() {
        try {
            const s = document.createElement('script');
            s.src = chrome.runtime.getURL('js/interceptor.js');
            s.onload = function () { this.remove(); };
            (document.head || document.documentElement).appendChild(s);
        } catch (e) {
            console.warn('[ReviewPort] Failed to inject interceptor:', e);
        }
    }
    // Inject as early as possible so the hook catches all review API calls
    if (document.documentElement) {
        injectInterceptor();
    } else {
        document.addEventListener('DOMContentLoaded', injectInterceptor, { once: true });
    }

    // ==================== Review store ====================
    const reviewStore = new Map(); // review_id -> normalized review
    let requiredNativeRating = 0; // exact native rating used for the current scan, or 0

    function tsToDate(ms) {
        try {
            const d = new Date(parseInt(ms, 10));
            if (isNaN(d.getTime())) return '';
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        } catch (e) {
            return '';
        }
    }

    // Upgrade 300x300 thumbnails to larger images where possible
    function upgradePhotoUrl(url) {
        if (!url) return url;
        return url.replace(/-crop-webp:300:300\.webp/, '-crop-webp:800:800.webp');
    }

    function normalizeReview(raw) {
        if (!raw || !raw.review_id) return null;
        const photos = Array.isArray(raw.review_images) ? raw.review_images.map(upgradePhotoUrl) : [];
        return {
            review_id: String(raw.review_id),
            username: raw.reviewer_name || '',
            rating: parseInt(raw.review_rating, 10) || 0,
            description: (raw.review_text || '').replace(/\s+/g, ' ').trim(),
            sku: raw.sku_specification || '',
            date: tsToDate(raw.review_time),
            photo_urls: photos.join(' | ')
        };
    }

    function addReviews(rawList) {
        let added = 0;
        for (const raw of rawList) {
            const r = normalizeReview(raw);
            if (r && (!requiredNativeRating || r.rating === requiredNativeRating) && !reviewStore.has(r.review_id)) {
                reviewStore.set(r.review_id, r);
                added++;
            }
        }
        return added;
    }

    // ==================== Source 1: embedded SSR JSON (page 1) ====================
    function extractEmbeddedReviews() {
        const found = [];
        const script = document.getElementById('__MODERN_ROUTER_DATA__');
        if (!script) return found;
        try {
            const data = JSON.parse(script.textContent);
            (function walk(obj) {
                if (!obj || typeof obj !== 'object') return;
                if (Array.isArray(obj)) { obj.forEach(walk); return; }
                if (obj.review_id && (obj.review_text !== undefined || obj.review_rating !== undefined)) {
                    found.push(obj);
                    return;
                }
                Object.values(obj).forEach(walk);
            })(data);
        } catch (e) {
            console.warn('[ReviewPort] Failed to parse embedded JSON:', e);
        }
        return found;
    }

    // ==================== Source 2: intercepted API responses ====================
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.source !== 'ttrh-interceptor' || msg.type !== 'reviews-captured') return;
        const added = addReviews(msg.reviews);
        console.log(`[ReviewPort] Interceptor captured ${msg.reviews.length} reviews (${added} new). Total: ${reviewStore.size}`);
        if (scraper.isRunning) {
            scraper.onNewReviewsCaptured();
        }
    });

    // ==================== Pagination helpers ====================
    function isDisabledPaginationControl(element) {
        if (!element) return true;
        const control = element.closest('button, [role="button"], [aria-disabled], [class*="pagination" i]') || element;
        const classText = `${control.className || ''} ${element.className || ''}`;
        return control.disabled === true
            || control.getAttribute('aria-disabled') === 'true'
            || /\b(disabled|is-disabled|not-allowed)\b/i.test(classText);
    }

    function findNextButton() {
        // Pagination buttons are divs; "下一個" (zh-TW), "下一个" (zh-CN), "Next" (en).
        // Only use one visible, enabled pagination-sized control. This avoids clicking a
        // hidden duplicate or a disabled final-page Next control and then reporting a false error.
        const candidates = document.querySelectorAll('div, button, [role="button"]');
        for (const el of candidates) {
            const text = (el.textContent || '').trim();
            if ((text === '下一個' || text === '下一个' || text === 'Next')
                && el.childElementCount <= 2
                && isVisible(el)
                && !isDisabledPaginationControl(el)) {
                return el;
            }
        }
        return null;
    }

    function getCurrentPageNumber() {
        // The active page button typically has distinct styling; fallback: parse from DOM
        const pagBtns = document.querySelectorAll('div');
        for (const el of pagBtns) {
            const text = (el.textContent || '').trim();
            if (/^\d+$/.test(text) && el.childElementCount === 0) {
                const cls = el.className || '';
                const style = window.getComputedStyle(el);
                // Active page usually has dark background or bold font
                if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                    style.backgroundColor !== 'rgb(255, 255, 255)') {
                    return parseInt(text, 10);
                }
            }
        }
        return null;
    }

    function isVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }

    /**
     * Detects an on-page verification prompt so scanning can stop safely.
     * It does not solve, click, or otherwise attempt to bypass verification.
     */
    function getVerificationMessage() {
        const verificationText = /captcha|security check|verify (that )?you(?:'|’)re human|verify your identity|安全驗證|安全验证|請完成驗證|请完成验证|拖動滑塊|拖动滑块|拼圖驗證|拼图验证/i;
        const candidates = document.querySelectorAll('[role="dialog"], [class*="captcha" i], [id*="captcha" i], [class*="verify" i], [id*="verify" i], [class*="challenge" i], [id*="challenge" i]');
        for (const element of candidates) {
            if (!isVisible(element)) continue;
            const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
            if (verificationText.test(text)) return text.slice(0, 180);
        }
        return '';
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function normalizedText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function normalizedNativeRating(value) {
        const text = normalizedText(value);
        if (/^(全部|all)$/i.test(text)) return 'all';
        return /^[1-5]$/.test(text) ? text : '';
    }

    /**
     * Locates TikTok's visible rating selector, not the rating-distribution bars.
     * The Tux select value is walked upward until it is next to the review-filter label.
     */
    function findNativeRatingSelect() {
        // TikTok's review-rating control has a dedicated review-filter container.
        const directValue = document.querySelector('[class*="review-filter-star-select-container"] [data-testid="tux-web-select"]');
        if (directValue) {
            return {
                valueNode: directValue,
                interactive: directValue.closest('[data-testid="tux-web-input-like"]')
                    || directValue.closest('[class*="tux-select"]')
                    || directValue
            };
        }

        // Conservative fallback for TikTok layout changes: only accept a select that
        // lives in a short filter-label container, never the broader review section.
        const values = document.querySelectorAll('[data-testid="tux-web-select"]');
        for (const valueNode of values) {
            let context = valueNode;
            for (let level = 0; context && level < 6; level++, context = context.parentElement) {
                const text = normalizedText(context.innerText || context.textContent);
                if (text.length < 120 && /(篩選條件|筛选条件|review filters?|filter)/i.test(text)) {
                    const interactive = valueNode.closest('[data-testid="tux-web-input-like"]')
                        || valueNode.closest('[class*="tux-select"]')
                        || valueNode;
                    return { valueNode, interactive };
                }
            }
        }
        return null;
    }

    function getNativeRatingSelection() {
        const select = findNativeRatingSelect();
        return select ? normalizedNativeRating(select.valueNode.innerText || select.valueNode.textContent) : '';
    }

    function findNativeRatingOption(target) {
        const expected = target === 'all' ? ['全部', 'All'] : [String(target)];
        const menuItems = document.querySelectorAll('.tux-menu-item, [data-testid="tux-web-interaction-container"]');
        for (const item of menuItems) {
            if (!isVisible(item)) continue;
            const text = normalizedText(item.innerText || item.textContent);
            if (expected.includes(text)) return item;
        }
        return null;
    }

    async function waitForCondition(predicate, timeout = 5000, interval = 120) {
        let waited = 0;
        while (waited < timeout) {
            if (predicate()) return true;
            await sleep(interval);
            waited += interval;
        }
        return Boolean(predicate());
    }

    /**
     * Uses one normal pointer/mouse event sequence on a visible control. Some
     * TikTok Tux controls listen on pointer-down instead of HTMLElement.click().
     * This remains limited to the rating UI already visible to the user.
     */
    function activateVisibleControl(element) {
        if (!element || !isVisible(element)) return false;
        element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        const rect = element.getBoundingClientRect();
        const clientX = Math.round(rect.left + Math.max(1, rect.width / 2));
        const clientY = Math.round(rect.top + Math.max(1, rect.height / 2));
        const targetAtPoint = document.elementFromPoint(clientX, clientY);
        const target = targetAtPoint && element.contains(targetAtPoint) ? targetAtPoint : element;
        const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX, clientY, button: 0, buttons: 1 };
        try {
            if (window.PointerEvent) {
                target.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
            }
            target.dispatchEvent(new MouseEvent('mousedown', base));
            if (window.PointerEvent) {
                target.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
            }
            target.dispatchEvent(new MouseEvent('mouseup', base));
            target.dispatchEvent(new MouseEvent('click', base));
            // Preserve the native DOM activation path as a final same-control step.
            if (target !== element) element.click();
            else target.click();
            return true;
        } catch (error) {
            console.warn('[ReviewPort] Could not activate TikTok rating control:', error);
            return false;
        }
    }

    /**
     * Applies TikTok's own exact-rating selector. The function only drives the
     * visible filter UI; it does not bypass verification or invoke private APIs.
     */
    async function applyNativeRatingFilter(targetRating) {
        const target = targetRating ? String(targetRating) : 'all';
        const select = findNativeRatingSelect();
        if (!select) {
            return { applied: false, changed: false, message: 'TikTok rating filter was not available; manual selection is required.' };
        }

        let current = getNativeRatingSelection();
        const needsRefresh = target !== 'all' && current === target;
        const sequence = needsRefresh ? ['all', target] : (current === target ? [] : [target]);
        let changed = false;

        for (const step of sequence) {
            const freshSelect = findNativeRatingSelect();
            if (!freshSelect) {
                return { applied: false, changed, message: 'TikTok rating filter was unavailable while updating.' };
            }
            if (!activateVisibleControl(freshSelect.interactive)) {
                return { applied: false, changed, message: 'TikTok rating selector could not be activated.' };
            }
            const optionReady = await waitForCondition(() => Boolean(findNativeRatingOption(step)), 1800);
            if (!optionReady) {
                return { applied: false, changed, message: 'TikTok rating choices did not open; manual selection is required.' };
            }
            const option = findNativeRatingOption(step);
            if (!option) {
                return { applied: false, changed, message: 'Requested TikTok rating choice was not found.' };
            }
            if (!activateVisibleControl(option)) {
                return { applied: false, changed, message: 'TikTok rating option could not be activated.' };
            }
            const selected = await waitForCondition(() => getNativeRatingSelection() === step, 4000);
            if (!selected) {
                return { applied: false, changed, message: 'TikTok rating choice did not update; manual selection is required.' };
            }
            changed = true;
            current = step;
            await sleep(250);
        }

        return { applied: current === target, changed, message: current === target ? `TikTok ${target === 'all' ? 'all-rating' : `${target}-star`} filter applied.` : 'Using local filtering.' };
    }

    // ==================== Scraper ====================
    const scraper = {
        isRunning: false,
        stopRequested: false,
        paused: false,
        resumePage: 1,
        lastCaptureTime: 0,
        options: { maxPages: 10, minStars: 1, maxStars: 5 },
        nativeRatingActive: false,

        setState(status, message, progress, pauseReason = '') {
            chrome.storage.local.set({
                scrapingState: {
                    status, // 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error'
                    message: message || '',
                    progress: progress || 0,
                    pauseReason: pauseReason || '',
                    reviewCount: reviewStore.size,
                    resumePage: this.resumePage,
                    timestamp: Date.now()
                }
            });
        },

        saveReviews() {
            chrome.storage.local.set({
                collectedReviews: Array.from(reviewStore.values()),
                lastUpdated: new Date().toISOString()
            });
        },

        onNewReviewsCaptured() {
            this.lastCaptureTime = Date.now();
            this.saveReviews();
        },

        async start(options) {
            if (this.isRunning) {
                console.log('[ReviewPort] Already running');
                return;
            }

            const requestedOptions = Object.assign({ maxPages: 10, minStars: 1, maxStars: 5, resume: false }, options || {});
            const maxPages = Math.max(1, Math.min(100, parseInt(requestedOptions.maxPages, 10) || 10));
            const minStars = Math.max(1, Math.min(5, parseInt(requestedOptions.minStars, 10) || 1));
            const maxStars = Math.max(minStars, Math.min(5, parseInt(requestedOptions.maxStars, 10) || 5));
            const exactNativeRating = minStars === maxStars ? minStars : 0;
            const isResume = Boolean(requestedOptions.resume);
            if (!isResume) {
                reviewStore.clear();
                this.resumePage = 1;
                this.saveReviews();
            }

            this.isRunning = true;
            this.paused = false;
            this.stopRequested = false;
            this.options = { maxPages, minStars, maxStars };
            this.nativeRatingActive = false;
            requiredNativeRating = exactNativeRating;
            let page = Math.max(1, Math.min(maxPages, parseInt(this.resumePage, 10) || 1));
            if (isResume) {
                const visiblePage = getCurrentPageNumber();
                if (Number.isInteger(visiblePage) && visiblePage >= page && visiblePage <= maxPages) {
                    page = visiblePage;
                    this.resumePage = page;
                }
            }

            console.log(`[ReviewPort] 🚀 ${isResume ? 'Resuming' : 'Starting'} scan, maxPages=${maxPages}, from page ${page}`);
            this.setState('running', isResume ? `Resuming from page ${page}...` : 'Extracting page 1 reviews...', 5);

            if (document.readyState === 'loading') {
                await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
            }

            const initialVerification = getVerificationMessage();
            if (initialVerification) {
                this.pauseForVerification(page, maxPages, initialVerification);
                return;
            }

            if (!isResume) {
                this.setState('running', exactNativeRating
                    ? `Applying TikTok ${exactNativeRating}-star filter before scanning...`
                    : 'Preparing all-rating review results...', 5);
                const nativeResult = await applyNativeRatingFilter(exactNativeRating || null);
                const verificationAfterFilter = getVerificationMessage();
                if (verificationAfterFilter) {
                    this.pauseForVerification(page, maxPages, verificationAfterFilter);
                    return;
                }

                this.nativeRatingActive = Boolean(exactNativeRating && nativeResult.applied);
                if (this.nativeRatingActive) {
                    // The interceptor sees the filtered request. SSR JSON remains unfiltered,
                    // so it is intentionally not used for an exact native rating scan.
                    const receivedFilteredPage = await waitForCondition(() => reviewStore.size > 0, 5500, 150);
                    if (!receivedFilteredPage) {
                        this.pauseForNativeFilter(page, maxPages, exactNativeRating);
                        return;
                    }
                    this.saveReviews();
                    this.setState('running', `TikTok ${exactNativeRating}-star filter active: ${reviewStore.size} reviews collected`, Math.round((page / maxPages) * 100));
                } else if (exactNativeRating) {
                    // Exact-star scans must never silently fall back to all reviews. The
                    // native selection is the source of truth for the requested subset.
                    this.pauseForNativeFilter(page, maxPages, exactNativeRating, nativeResult.message);
                    return;
                }
            } else {
                this.nativeRatingActive = Boolean(exactNativeRating && getNativeRatingSelection() === String(exactNativeRating));
                if (exactNativeRating && !this.nativeRatingActive) {
                    this.pauseForNativeFilter(page, maxPages, exactNativeRating, 'TikTok is not yet showing the requested rating. Select it in TikTok, then resume.');
                    return;
                }
                if (this.nativeRatingActive && reviewStore.size === 0) {
                    const receivedFilteredPage = await waitForCondition(() => reviewStore.size > 0, 3000, 150);
                    if (!receivedFilteredPage) {
                        this.pauseForNativeFilter(page, maxPages, exactNativeRating, 'TikTok has not returned the filtered first page yet.');
                        return;
                    }
                }
            }

            if (!this.nativeRatingActive) {
                // Page 1 data is embedded in the document for unfiltered/range scans.
                const embedded = extractEmbeddedReviews();
                const added = addReviews(embedded);
                console.log(`[ReviewPort] Page 1 embedded JSON: ${embedded.length} reviews (${added} new)`);
                this.saveReviews();
            }
            this.setState('running', `Page ${page}: ${reviewStore.size} reviews collected`, Math.round((page / maxPages) * 100));

            while (page < maxPages && !this.stopRequested) {
                const visibleVerification = getVerificationMessage();
                if (visibleVerification) {
                    this.pauseForVerification(page, maxPages, visibleVerification);
                    return;
                }

                const nextBtn = findNextButton();
                if (!nextBtn) {
                    console.log('[ReviewPort] No next button found, stopping pagination');
                    break;
                }

                const currentPage = page;
                const beforeCount = reviewStore.size;
                nextBtn.scrollIntoView({ block: 'center', behavior: 'instant' });
                await sleep(450);
                nextBtn.click();
                console.log(`[ReviewPort] Requested page ${currentPage + 1}`);

                let waited = 0;
                let verificationPrompt = '';
                let pageAdvanced = false;
                while (waited < 8000) {
                    await sleep(400);
                    waited += 400;
                    verificationPrompt = getVerificationMessage();
                    const visiblePage = getCurrentPageNumber();
                    pageAdvanced = Number.isInteger(visiblePage) && visiblePage >= currentPage + 1;
                    // A visible page change alone is not sufficient: TikTok may render the new page
                    // before its review API response reaches the interceptor. Keep waiting for data
                    // (or a visible verification prompt) until the conservative timeout expires.
                    if (verificationPrompt || reviewStore.size > beforeCount) break;
                }

                if (verificationPrompt) {
                    // Keep the last known safe page so a user-initiated resume does not skip data.
                    this.pauseForVerification(currentPage, maxPages, verificationPrompt);
                    return;
                }

                // A user command may arrive while TikTok is still resolving a page request.
                // Keep the explicit Pause or Stop state rather than replacing it with completion.
                if (this.stopRequested || this.paused) return;

                if (reviewStore.size === beforeCount) {
                    // A visible page change with no new unique review IDs is an ordinary end-of-results
                    // condition, not a verification failure. Finish with the data safely collected so far.
                    if (pageAdvanced) {
                        page = currentPage + 1;
                        this.resumePage = page;
                        this.saveReviews();
                        this.isRunning = false;
                        this.paused = false;
                        this.setState('completed', `Completed: ${reviewStore.size} reviews. TikTok returned no additional unique reviews on page ${page}.`, 100);
                        return;
                    }

                    // Do not retry or force another click. TikTok may be loading slowly or require a
                    // user-visible verification; pause safely and let the user decide whether to resume.
                    this.pauseForNoData(currentPage, maxPages);
                    return;
                }

                page = currentPage + 1;
                this.resumePage = page;
                this.saveReviews();
                this.setState('running',
                    `Page ${page}: ${reviewStore.size} reviews collected`,
                    Math.min(95, Math.round((page / maxPages) * 100)));
                await sleep(900); // conservative pacing; no anti-bot bypass attempt
            }

            // Pause and Stop can be requested while a page response is pending. Their saved
            // state must win over the normal completion path so collected reviews remain resumable.
            if (this.stopRequested || this.paused) return;
            this.saveReviews();
            this.isRunning = false;
            this.paused = false;
            console.log(`[ReviewPort] ✓ Completed: ${reviewStore.size} reviews from ${page} page(s)`);
            this.setState('completed', `Completed: ${reviewStore.size} reviews from ${page} page(s)`, 100);
        },

        pauseForVerification(page, maxPages, promptText) {
            this.resumePage = page;
            this.saveReviews();
            this.isRunning = false;
            this.paused = true;
            this.stopRequested = true;
            const progress = Math.min(95, Math.round((page / maxPages) * 100));
            console.warn('[ReviewPort] Paused for user verification:', promptText);
            this.setState('paused', `Paused: TikTok requires verification. Complete it in the page, then select Resume scan. ${reviewStore.size} reviews are safely saved.`, progress, 'verification');
        },

        pauseForNativeFilter(page, maxPages, rating, reason = '') {
            this.resumePage = page;
            this.saveReviews();
            this.isRunning = false;
            this.paused = true;
            this.stopRequested = true;
            const progress = Math.min(95, Math.round((page / maxPages) * 100));
            const detail = reason ? ` ${reason}` : '';
            this.setState('paused', `Paused before scanning: TikTok did not confirm the ${rating}-star filter, so ReviewPort did not scan all reviews.${detail} Select ${rating} in TikTok's visible review filter, then choose Resume scan.`, progress, 'verification');
        },

        pauseForNoData(page, maxPages) {
            this.resumePage = page;
            this.saveReviews();
            this.isRunning = false;
            this.paused = true;
            this.stopRequested = true;
            const progress = Math.min(95, Math.round((page / maxPages) * 100));
            // This is an intentionally safe pause, not an uncaught extension error.
            // Use informational logging so Chrome DevTools does not present it as a failure stack trace.
            console.info('[ReviewPort] Scan paused safely: TikTok did not return new review data after the next-page request.');
            this.setState('paused', `Scan paused safely: TikTok did not return new review data after page ${page}. Check the product page for a verification prompt, then select Resume scan. ${reviewStore.size} reviews are saved locally.`, progress, 'no_data');
        },

        pauseByUser() {
            if (!this.isRunning) return false;
            this.resumePage = Math.max(1, this.resumePage);
            this.saveReviews();
            this.isRunning = false;
            this.paused = true;
            this.stopRequested = true;
            const progress = Math.min(95, Math.round((this.resumePage / this.options.maxPages) * 100));
            this.setState('paused', `Paused by you. ${reviewStore.size} reviews are saved locally. Keep the TikTok product page open, then select Resume scan when ready.`, progress, 'user');
            return true;
        },

        stopByUser() {
            if (!this.isRunning && !this.paused) return false;
            this.saveReviews();
            this.isRunning = false;
            this.paused = false;
            this.stopRequested = true;
            const progress = Math.min(100, Math.round((this.resumePage / this.options.maxPages) * 100));
            this.setState('stopped', `Stopped by you. ${reviewStore.size} reviews were kept locally and are ready for the full report.`, progress, 'user');
            return true;
        },

        stop() {
            this.stopRequested = true;
            this.isRunning = false;
        },

        clear() {
            reviewStore.clear();
            this.resumePage = 1;
            this.paused = false;
            this.stopRequested = true;
            chrome.storage.local.remove(['collectedReviews', 'scrapingState']);
        }
    };

    // ==================== Message handling ====================
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('[ReviewPort] Content script received:', request.action);

        if (request.action === 'ping') {
            sendResponse({ success: true, loaded: true });
            return;
        }

        if (request.action === 'startScraping') {
            // Respond immediately; progress is reported via chrome.storage polling
            scraper.start(request.options);
            sendResponse({ success: true, started: true });
            return;
        }

        if (request.action === 'resumeScraping') {
            scraper.start(Object.assign({}, request.options || {}, { resume: true }));
            sendResponse({ success: true, started: true, resumed: true });
            return;
        }

        if (request.action === 'pauseScraping') {
            const paused = scraper.pauseByUser();
            sendResponse({ success: paused, paused });
            return;
        }

        if (request.action === 'stopScraping') {
            const stopped = scraper.stopByUser();
            sendResponse({ success: stopped, stopped });
            return;
        }

        if (request.action === 'getReviews') {
            sendResponse({ success: true, reviews: Array.from(reviewStore.values()) });
            return;
        }

        if (request.action === 'clearReviews') {
            scraper.clear();
            sendResponse({ success: true });
            return;
        }
    });

    console.log('[ReviewPort] ReviewPort content script loaded');
})();
