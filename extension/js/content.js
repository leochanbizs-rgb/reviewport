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

    function setReviewHookActive(action) {
        window.postMessage({
            source: 'reviewport-content',
            type: 'review-hook-control',
            action
        }, '*');
    }

    // ==================== Review store ====================
    const reviewStore = new Map(); // review_id -> normalized review
    const DEBUG = false;
    const PACING = Object.freeze({ selectorRefresh: 250, pageClickSettling: 450, responsePoll: 400, responseWait: 8000, betweenPages: 900, storageDebounce: 400, stateDebounce: 180 });
    const debug = (...args) => { if (DEBUG) console.debug('[ReviewPort]', ...args); };
    let requiredNativeRating = 0; // exact native rating used for the current scan, or 0

    function tsToDate(ms) {
        try {
            const d = new Date(parseInt(ms, 10));
            if (isNaN(d.getTime())) return '';
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        } catch (e) {
            return '';
        }
    }

    // Upgrade known 300x300 thumbnails where possible. Keep an unchanged URL when the
    // pattern does not match so exports never silently lose a captured image reference.
    function upgradePhotoUrl(url) {
        if (!url) return '';
        const original = String(url).trim();
        const upgraded = original.replace(/-crop-webp:300:300\.webp/, '-crop-webp:800:800.webp');
        return upgraded || original;
    }

    function normalizeReview(raw) {
        if (!raw || !raw.review_id) return null;
        const photos = Array.isArray(raw.review_images) ? raw.review_images.map(upgradePhotoUrl) : [];
        return {
            review_id: String(raw.review_id),
            username: raw.reviewer_name || '',
            rating: parseInt(raw.review_rating, 10) || 0,
            description: (raw.review_text || '').replace(/\s+/g, ' ').trim(),
            // TikTok calls this a specification/variant, not a verified Shopify SKU.
            variant: raw.sku_specification || raw.variant || '',
            sku: raw.sku_specification || raw.variant || '', // legacy export compatibility only
            country: raw.country_code || raw.country || raw.reviewer_country || '',
            verified: Boolean(raw.is_verified_purchase || raw.verified_purchase || raw.is_verified),
            date: tsToDate(raw.review_time),
            photo_urls: photos
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

    // ==================== Source 1B: visible, confirmed native-filter results ====================
    // Some TikTok Shop pages render the first filtered page from their client state
    // without emitting a separately observable review-list response. This fallback
    // is deliberately fail-closed: it runs only after the visible native filter is
    // confirmed to equal the requested exact rating, and only within the review area.
    const REVIEW_TEXT_MARKERS = /(?:篩選條件|筛选条件|review\s*filters?|sort|排序方式)/i;
    const PRODUCT_MARKER = /^(?:商品|商品規格|product|variant|item)\s*[:：]?$/i;
    const PRODUCT_LABEL = /^(?:商品|商品規格|product|variant|item)\s*[:：]/i;
    const DATE_MARKER = /^\d{4}-\d{2}-\d{2}$/;
    const REVIEW_NON_BODY_LINES = /^(?:已驗證購買|已验证购买|verified purchase|\u00b7|[★☆\s]+|[A-Z]{2,3})$/i;
    const REVIEW_IMAGE_URL = /~tplv-[^/]+-crop-webp:/i;

    function localFingerprint(value) {
        let hash = 2166136261;
        const text = String(value || '');
        for (let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function findVisibleReviewScope() {
        const select = findNativeRatingSelect();
        let cursor = select?.interactive || select?.valueNode || null;
        for (let level = 0; cursor && level < 9; level++, cursor = cursor.parentElement) {
            const text = normalizedText(cursor.innerText || cursor.textContent);
            if (text.length < 14000 && REVIEW_TEXT_MARKERS.test(text)
                && (cursor.querySelector('article, li, [data-e2e*="review" i], [data-testid*="review" i], [class*="review-item" i], [class*="review-card" i]')
                    || Array.from(cursor.querySelectorAll('span, p, time, div')).some(node => DATE_MARKER.test(normalizedText(node.textContent))))) {
                return cursor;
            }
        }
        return document.querySelector('[data-e2e*="review-list" i], [data-testid*="review-list" i], [class*="review-list" i]');
    }

    function numericTokens(value) {
        return (String(value || '').match(/(?:\d{1,3}(?:,\d{3})+|\d+)/g) || [])
            .map(token => Number(token.replace(/,/g, '')))
            .filter(Number.isFinite);
    }

    function metricCandidateScopes() {
        const scopes = [];
        const select = findNativeRatingSelect();
        let cursor = select?.interactive || select?.valueNode || null;
        for (let level = 0; cursor && level < 12; level++, cursor = cursor.parentElement) {
            if (!scopes.includes(cursor) && isVisible(cursor)) scopes.push(cursor);
        }
        const visibleScope = findVisibleReviewScope();
        if (visibleScope && !scopes.includes(visibleScope)) scopes.push(visibleScope);
        return scopes;
    }

    function parseReviewMetricsFromScope(scope) {
        if (!scope) return null;
        const lines = String(scope.innerText || scope.textContent || '').split(/\n+/).map(normalizedText).filter(Boolean);
        const histogram = {};
        for (let index = 0; index < lines.length; index++) {
            const tokens = numericTokens(lines[index]);
            const inlineRating = tokens.length >= 2 && /^[1-5]$/.test(String(tokens[0])) && /(?:★|☆|stars?|星)/i.test(lines[index]) ? tokens[0] : 0;
            const nextRating = tokens.length === 1 && /^[1-5]$/.test(String(tokens[0])) ? tokens[0] : 0;
            if (inlineRating && tokens[1] >= 0) histogram[inlineRating] = tokens[1];
            if (nextRating && index + 1 < lines.length) {
                const nextTokens = numericTokens(lines[index + 1]);
                if (nextTokens.length === 1 && nextTokens[0] >= 0) histogram[nextRating] = nextTokens[0];
            }
        }
        const completeHistogram = [1, 2, 3, 4, 5].every(rating => Number.isFinite(histogram[rating]));
        if (!completeHistogram) return null;
        const total = [1, 2, 3, 4, 5].reduce((sum, rating) => sum + histogram[rating], 0);
        if (!total) return null;
        for (const line of lines) {
            const values = numericTokens(line);
            if (values.length !== 2) continue;
            const [displayed, lineTotal] = values;
            if (lineTotal === total && displayed >= 0 && displayed <= total) {
                return { histogram, total, displayed, source: 'review-results-count' };
            }
        }
        return { histogram, total, displayed: null, source: 'histogram-only' };
    }

    function readReviewMetrics() {
        for (const scope of metricCandidateScopes()) {
            const metrics = parseReviewMetricsFromScope(scope);
            if (metrics) return metrics;
        }
        return null;
    }

    function isExactRatingConfirmedByMetrics(expectedRating) {
        const metrics = readReviewMetrics();
        if (!metrics || !expectedRating || !Number.isFinite(metrics.displayed)) return { confirmed: false, metrics };
        return {
            confirmed: metrics.displayed === metrics.histogram[Number(expectedRating)],
            metrics
        };
    }

    async function waitForExactRatingMetrics(expectedRating, timeout = 5500) {
        let latest = isExactRatingConfirmedByMetrics(expectedRating);
        let waited = 0;
        while (!latest.confirmed && waited < timeout) {
            await sleep(PACING.responsePoll);
            waited += PACING.responsePoll;
            latest = isExactRatingConfirmedByMetrics(expectedRating);
        }
        return latest;
    }

    function visibleReviewCandidateCards(scope) {
        if (!scope) return [];
        const direct = Array.from(scope.querySelectorAll(
            'article, li, [data-e2e*="review-item" i], [data-testid*="review-item" i], [class*="review-item" i], [class*="review-card" i]'
        ));
        const cards = direct.length ? direct : [];
        // The date is a stable public field in TikTok review cards. Only walk from a
        // matching date node to a bounded ancestor inside the confirmed review scope;
        // never iterate arbitrary page divs.
        for (const node of scope.querySelectorAll('span, p, time, div')) {
            const text = normalizedText(node.textContent);
            if (!DATE_MARKER.test(text) || node.children.length > 0) continue;
            let cursor = node.parentElement;
            for (let level = 0; cursor && cursor !== scope && level < 7; level++, cursor = cursor.parentElement) {
                const cardText = normalizedText(cursor.innerText || cursor.textContent);
                if (cardText.length >= 20 && cardText.length <= 2600 && PRODUCT_LABEL.test(cardText)) {
                    if (!cards.includes(cursor)) cards.push(cursor);
                    break;
                }
            }
        }
        return cards.filter(card => isVisible(card));
    }

    function renderedRatingFromCard(card) {
        const labeledNodes = Array.from(card.querySelectorAll('[aria-label], [data-rating], [data-value]'));
        for (const node of labeledNodes) {
            const label = [node.getAttribute('data-rating'), node.getAttribute('data-value'), node.getAttribute('aria-label'), node.textContent]
                .filter(Boolean).join(' ');
            const match = normalizedText(label).match(/(?:^|\D)([1-5])\s*(?:stars?|星)(?:\D|$)/i);
            if (match) return Number(match[1]);
        }
        const textGroups = String(card.innerText || card.textContent || '').match(/[★☆]{1,5}/g) || [];
        const filledGroup = textGroups.find(group => group.includes('★'));
        if (filledGroup) {
            const filled = (filledGroup.match(/★/g) || []).length;
            if (filled >= 1 && filled <= 5) return filled;
        }
        const visualStars = Array.from(card.querySelectorAll('[data-e2e*="star" i], [class*="star" i]'));
        const filledVisualStars = visualStars.filter(node => /(?:filled|active|selected|full|yellow)/i.test(`${node.className || ''} ${node.getAttribute('aria-label') || ''}`)).length;
        return filledVisualStars >= 1 && filledVisualStars <= 5 ? filledVisualStars : 0;
    }

    function parseVisibleReviewCard(card, rating) {
        const renderedRating = renderedRatingFromCard(card);
        if (renderedRating !== Number(rating)) return null;
        const lines = String(card.innerText || card.textContent || '')
            .split(/\n+/)
            .map(normalizedText)
            .filter(Boolean);
        const dateIndex = lines.findIndex(line => DATE_MARKER.test(line));
        const productIndex = lines.findIndex(line => PRODUCT_LABEL.test(line));
        if (dateIndex < 0 || productIndex < 0) return null;
        const date = lines[dateIndex];
        const productLine = lines[productIndex];
        const inlineSku = productLine.replace(/^(?:商品|商品規格|product|variant|item)\s*[:：]\s*/i, '');
        const sku = inlineSku || lines[productIndex + 1] || '';
        if (!sku) return null;
        const bodyCandidates = lines.slice(0, productIndex).filter(line => (
            line.length >= 12
            && !REVIEW_NON_BODY_LINES.test(line)
            && !DATE_MARKER.test(line)
            && !PRODUCT_MARKER.test(line)
            && !/^\d+(?:\.\d+)?$/.test(line)
        ));
        const description = bodyCandidates.join('\n').trim();
        if (!description) return null;
        const username = lines.find(line => /^[\p{L}\p{N}_*.·-]{2,32}$/u.test(line)
            && !REVIEW_NON_BODY_LINES.test(line)
            && !DATE_MARKER.test(line)) || '';
        const country = lines.find(line => /^[A-Z]{2,3}$/.test(line)) || '';
        const verified = lines.some(line => /(?:verified purchase|已驗證購買|已验证购买|真实购买)/i.test(line));
        const photoUrls = Array.from(card.querySelectorAll('img[src]'))
            .map(image => upgradePhotoUrl(image.currentSrc || image.src || ''))
            .filter(url => REVIEW_IMAGE_URL.test(url) && !/(?:common-sign|avatar|profile)/i.test(url))
            .filter((url, index, values) => values.indexOf(url) === index)
            .slice(0, 5);
        const review_id = `visible-${localFingerprint(`${username}|${date}|${sku}|${description}`)}`;
        return { review_id, username, rating, description, variant: sku, sku, country, verified, date, photo_urls: photoUrls };
    }

    function extractVisibleFilteredReviews(expectedRating, filterConfirmed) {
        // The scan flow already owns filter confirmation. Do not re-derive it from
        // a transient control label while the list is re-rendering.
        if (!expectedRating || !filterConfirmed) return 0;
        const scope = findVisibleReviewScope();
        if (!scope || !isVisible(scope)) return 0;
        let added = 0;
        for (const card of visibleReviewCandidateCards(scope)) {
            const review = parseVisibleReviewCard(card, expectedRating);
            if (review && !reviewStore.has(review.review_id)) {
                reviewStore.set(review.review_id, review);
                added++;
            }
        }
        debug('Visible confirmed filtered reviews processed', { rating: expectedRating, added, total: reviewStore.size });
        return added;
    }

    // ==================== Source 2: intercepted API responses ====================
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.source !== 'reviewport-interceptor' || msg.type !== 'reviews-captured') return;
        const added = addReviews(msg.reviews);
        debug('Review response captured', { received: msg.reviews.length, added, total: reviewStore.size });
        if (scraper.isRunning) {
            scraper.onNewReviewsCaptured();
        }
    });

    // ==================== TikTok selector registry ====================
    // Keep TikTok-facing selectors in one documented registry. Every target has a
    // conservative fallback chain so layout changes can be diagnosed safely.
    const SELECTORS = Object.freeze({
        paginationContainers: [
            '[aria-label*="pagination" i]',
            '[role="navigation"][aria-label*="page" i]',
            '[class*="pagination" i]',
            '[class*="pager" i]'
        ],
        paginationNext: ['[rel="next"]', '[aria-label*="next" i]', '[data-testid*="next" i]', '[data-e2e*="next" i]'],
        paginationCurrent: ['[aria-current="page"]', '[aria-selected="true"][data-page]', '[data-current-page]', '[data-page].is-active', '[data-page][data-active="true"]'],
        ratingSelect: ['[class*="review-filter-star-select-container"] [data-testid="tux-web-select"]', '[data-testid="tux-web-select"]'],
        ratingInteractive: ['[data-testid="tux-web-input-like"]', '[class*="tux-select"]'],
        ratingOptions: ['.tux-menu-item', '[data-testid="tux-web-interaction-container"]'],
        verification: ['[role="dialog"]', '[class*="captcha" i]', '[id*="captcha" i]', '[class*="verify" i]', '[id*="verify" i]', '[class*="challenge" i]', '[id*="challenge" i]']
    });
    const NEXT_LABELS = /^(next|下一個|下一个|siguiente|próximo|suivant|weiter|avanti|volgende|berikutnya|tiếp theo|ต่อไป|다음|次へ|التالي)$/i;
    let lastPaginationStrategy = 'not-run';

    function queryFirst(selectors, scope = document) {
        for (const selector of selectors) {
            const element = scope.querySelector(selector);
            if (element) return { element, selector };
        }
        return null;
    }

    function paginationScopes() {
        const scopes = [];
        for (const selector of SELECTORS.paginationContainers) {
            document.querySelectorAll(selector).forEach(element => {
                if (isVisible(element) && !scopes.includes(element)) scopes.push(element);
            });
        }
        return scopes;
    }

    function pageNumberFromElement(element) {
        if (!element) return null;
        const value = element.getAttribute('data-current-page') || element.getAttribute('data-page') || element.getAttribute('aria-label') || element.textContent;
        const match = String(value || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    }

    function runSelectorSelfTest() {
        const next = findNextButton();
        const current = getCurrentPageNumber();
        const rating = findNativeRatingSelect();
        return {
            paginationContainers: paginationScopes().length,
            nextResolved: Boolean(next),
            nextStrategy: lastPaginationStrategy,
            currentPageResolved: Number.isInteger(current),
            ratingSelectorResolved: Boolean(rating),
            ratingSelectorStrategy: rating?.strategy || 'unresolved',
            ratingSelectorValue: rating?.value || '',
            summary: `pagination=${next ? lastPaginationStrategy : 'unresolved'}; active-page=${Number.isInteger(current) ? 'resolved' : 'unresolved'}; rating-filter=${rating ? `${rating.strategy}:${rating.value}` : 'unresolved'}`
        };
    }

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
        for (const scope of paginationScopes()) {
            const structural = queryFirst(SELECTORS.paginationNext, scope);
            if (structural && isVisible(structural.element) && !isDisabledPaginationControl(structural.element)) {
                lastPaginationStrategy = `structural:${structural.selector}`;
                return structural.element;
            }
            for (const control of scope.querySelectorAll('button, [role="button"], a, div')) {
                const text = normalizedText(control.getAttribute('aria-label') || control.textContent);
                if (NEXT_LABELS.test(text) && isVisible(control) && !isDisabledPaginationControl(control)) {
                    lastPaginationStrategy = 'scoped-localized-label';
                    return control;
                }
            }
        }
        // Last resort: semantic controls only. Never iterate every div on the product page.
        for (const control of document.querySelectorAll('button, [role="button"], a[rel="next"], [aria-label*="next" i]')) {
            const text = normalizedText(control.getAttribute('aria-label') || control.textContent);
            if ((NEXT_LABELS.test(text) || control.getAttribute('rel') === 'next') && isVisible(control) && !isDisabledPaginationControl(control)) {
                lastPaginationStrategy = 'semantic-localized-fallback';
                return control;
            }
        }
        lastPaginationStrategy = 'unresolved';
        return null;
    }

    function getCurrentPageNumber() {
        for (const scope of paginationScopes()) {
            const current = queryFirst(SELECTORS.paginationCurrent, scope);
            const page = pageNumberFromElement(current?.element);
            if (Number.isInteger(page)) return page;
        }
        return null;
    }

    function getLastPageNumber() {
        let highest = 0;
        for (const scope of paginationScopes()) {
            for (const element of scope.querySelectorAll('[data-page], [aria-label], button, a, span')) {
                const page = pageNumberFromElement(element);
                if (Number.isInteger(page) && page > highest) highest = page;
            }
        }
        return highest || null;
    }

    function deriveReviewTargetBudget(targetReviews, metrics) {
        const eligible = Number.isFinite(metrics?.displayed) ? metrics.displayed : (metrics?.total || 0);
        const requested = Math.max(1, parseInt(targetReviews, 10) || 30);
        const boundedTarget = eligible ? Math.min(requested, eligible) : requested;
        const lastPage = getLastPageNumber();
        const visibleCards = visibleReviewCandidateCards(findVisibleReviewScope()).length;
        const reviewsPerPage = lastPage && eligible
            ? Math.max(1, Math.ceil(eligible / lastPage))
            : Math.max(1, visibleCards || 1);
        const estimatedPages = Math.max(1, Math.ceil(boundedTarget / reviewsPerPage));
        return { targetReviews: boundedTarget, eligibleReviews: eligible, reviewsPerPage, estimatedPages, lastPage };
    }

    function hasDisabledNextControl() {
        for (const scope of paginationScopes()) {
            for (const selector of SELECTORS.paginationNext) {
                for (const control of scope.querySelectorAll(selector)) {
                    if (isVisible(control) && isDisabledPaginationControl(control)) return true;
                }
            }
            for (const control of scope.querySelectorAll('button, [role="button"], a, div')) {
                const text = normalizedText(control.getAttribute('aria-label') || control.textContent);
                if (NEXT_LABELS.test(text) && isVisible(control) && isDisabledPaginationControl(control)) return true;
            }
        }
        return false;
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
        const candidates = document.querySelectorAll(SELECTORS.verification.join(', '));
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
        // TikTok may render a selected rating as `1`, `★ 1`, `1★`, `1 star`,
        // `1 星`, `全部`, or `★ 全部`. Strip decorative stars before handling
        // either the all-ratings or numeric branch.
        const cleaned = normalizedText(value).replace(/^[★☆\s]+|[★☆\s]+$/g, '');
        if (/^(?:全部|all)(?:\s*(?:reviews?|評價|评价|評論|评论))?$/i.test(cleaned)) return 'all';
        const match = cleaned.match(/(?:^|[^0-9])([1-5])(?=\s*(?:★|☆|stars?|星)?(?:$|[^0-9]))/i);
        return match ? match[1] : '';
    }

    /**
     * Locates TikTok's visible rating selector, not the rating-distribution bars.
     * The Tux select value is walked upward until it is next to the review-filter label.
     */
    function findNativeRatingSelect() {
        const candidateIsRating = valueNode => {
            const currentValue = normalizedNativeRating(valueNode.getAttribute('data-value') || valueNode.getAttribute('aria-label') || valueNode.innerText || valueNode.textContent);
            return currentValue === 'all' || /^[1-5]$/.test(currentValue);
        };
        const describeCandidate = (valueNode, strategy) => ({
            valueNode,
            interactive: valueNode.closest(SELECTORS.ratingInteractive.join(', ')) || valueNode,
            strategy,
            value: normalizedNativeRating(valueNode.getAttribute('data-value') || valueNode.getAttribute('aria-label') || valueNode.innerText || valueNode.textContent)
        });

        // TikTok's review-rating control has a dedicated review-filter container.
        const directValue = queryFirst([SELECTORS.ratingSelect[0]])?.element;
        if (directValue && candidateIsRating(directValue)) {
            return describeCandidate(directValue, 'dedicated-rating-container');
        }

        // Conservative fallback for TikTok layout changes. Sort and filter can share
        // a short ancestor, therefore a candidate must itself normalize to all/1–5.
        const values = document.querySelectorAll(SELECTORS.ratingSelect[1]);
        for (const valueNode of values) {
            if (!candidateIsRating(valueNode)) continue;
            let context = valueNode;
            for (let level = 0; context && level < 6; level++, context = context.parentElement) {
                const text = normalizedText(context.innerText || context.textContent);
                if (text.length < 160 && /(篩選條件|筛选条件|review filters?|filter)/i.test(text)) {
                    return describeCandidate(valueNode, 'filter-context-normalized-value');
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
        const expected = target === 'all' ? 'all' : String(target);
        const menuItems = document.querySelectorAll(SELECTORS.ratingOptions.join(', '));
        for (const item of menuItems) {
            if (!isVisible(item)) continue;
            const value = normalizedNativeRating(
                item.getAttribute('data-value') || item.getAttribute('aria-label') || item.innerText || item.textContent
            );
            if (value === expected) return item;
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
            await sleep(PACING.selectorRefresh);
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
        requestedPage: 1,
        selectorDiagnostics: null,
        reviewMetrics: null,
        reviewSaveTimer: null,
        stateSaveTimer: null,

        setState(status, message, progress, pauseReason = '') {
            const scrapingState = {
                status, // 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error'
                message: message || '',
                progress: progress || 0,
                pauseReason: pauseReason || '',
                reviewCount: reviewStore.size,
                resumePage: this.resumePage,
                requestedPage: this.requestedPage,
                selectorDiagnostics: this.selectorDiagnostics,
                reviewMetrics: this.reviewMetrics,
                options: this.options,
                timestamp: Date.now()
            };
            const commit = () => {
                this.stateSaveTimer = null;
                chrome.storage.local.set({ scrapingState });
            };
            const terminal = ['paused', 'stopped', 'completed', 'error'].includes(status);
            if (this.stateSaveTimer) clearTimeout(this.stateSaveTimer);
            if (terminal) {
                // Pause, Stop and completion promise that results are immediately available.
                this.saveReviews(true);
                commit();
            } else {
                this.stateSaveTimer = setTimeout(commit, PACING.stateDebounce);
            }
        },

        saveReviews(immediate = false) {
            const payload = {
                collectedReviews: Array.from(reviewStore.values()),
                lastUpdated: new Date().toISOString()
            };
            const commit = () => {
                this.reviewSaveTimer = null;
                chrome.storage.local.set(payload);
            };
            if (this.reviewSaveTimer) clearTimeout(this.reviewSaveTimer);
            if (immediate) commit();
            else this.reviewSaveTimer = setTimeout(commit, PACING.storageDebounce);
        },

        onNewReviewsCaptured() {
            this.lastCaptureTime = Date.now();
            this.saveReviews();
        },

        async start(options) {
            if (this.isRunning) {
                debug('Scan start ignored because a scan is already running.');
                return;
            }

            const requestedOptions = Object.assign({ targetReviews: 30, maxPages: 10, minStars: 1, maxStars: 5, resume: false }, options || {});
            // `maxPages` stays an internal compatibility value; the user sets a review target.
            let maxPages = Math.max(1, Math.min(100, parseInt(requestedOptions.maxPages, 10) || 10));
            const targetReviews = Math.max(1, parseInt(requestedOptions.targetReviews, 10) || Math.max(1, maxPages * 3));
            const minStars = Math.max(1, Math.min(5, parseInt(requestedOptions.minStars, 10) || 1));
            const maxStars = Math.max(minStars, Math.min(5, parseInt(requestedOptions.maxStars, 10) || 5));
            const exactNativeRating = minStars === maxStars ? minStars : 0;
            const isResume = Boolean(requestedOptions.resume);
            if (!isResume) {
                reviewStore.clear();
                this.resumePage = 1;
                this.saveReviews(true);
            }

            this.isRunning = true;
            setReviewHookActive('start');
            this.paused = false;
            this.stopRequested = false;
            this.options = { maxPages, minStars, maxStars, targetReviews };
            this.nativeRatingActive = false;
            this.reviewMetrics = readReviewMetrics();
            requiredNativeRating = exactNativeRating;
            let page = Math.max(1, Math.min(100, parseInt(this.resumePage, 10) || 1));
            // Requested page is an extension-owned state value. A visible active-page control,
            // when present, is observational only and never inferred from CSS styling.
            this.requestedPage = page;
            this.selectorDiagnostics = runSelectorSelfTest();

            debug(`${isResume ? 'Resuming' : 'Starting'} scan`, { maxPages, page });
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

                const metricConfirmation = exactNativeRating
                    ? await waitForExactRatingMetrics(exactNativeRating)
                    : { confirmed: true, metrics: readReviewMetrics() };
                this.reviewMetrics = metricConfirmation.metrics || this.reviewMetrics;
                const targetBudget = deriveReviewTargetBudget(targetReviews, this.reviewMetrics);
                maxPages = Math.min(100, Math.max(page, targetBudget.estimatedPages));
                this.options.maxPages = maxPages;
                this.options.targetReviews = targetBudget.targetReviews;
                // The numerical result count is the primary filter contract. The native
                // control label is retained only for triggering the visible UI and diagnostics.
                this.nativeRatingActive = Boolean(exactNativeRating && metricConfirmation.confirmed);
                if (this.nativeRatingActive) {
                    // The interceptor sees the filtered request. SSR JSON remains unfiltered,
                    // so it is intentionally not used for an exact native rating scan.
                    const receivedFilteredPage = await waitForCondition(() => reviewStore.size > 0, 2500, 150);
                    if (!receivedFilteredPage) {
                        // TikTok can render an already-filtered first page from client state
                        // without a separately observable review-list response. Read only the
                        // currently visible, numerically confirmed rating cards; never use SSR.
                        extractVisibleFilteredReviews(exactNativeRating, metricConfirmation.confirmed);
                    }
                    if (!reviewStore.size) {
                        this.pauseForNativeFilter(page, maxPages, exactNativeRating, 'TikTok numerically confirmed the requested rating, but ReviewPort could not safely read any visible filtered review cards yet.');
                        return;
                    }
                    this.saveReviews();
                    this.setState('running', `TikTok ${exactNativeRating}-star filter active: ${reviewStore.size} reviews collected`, Math.round((page / maxPages) * 100));
                } else if (exactNativeRating) {
                    const metrics = metricConfirmation.metrics;
                    const detail = metrics && Number.isFinite(metrics.displayed)
                        ? `TikTok currently shows ${metrics.displayed} of ${metrics.total} reviews, not the ${metrics.histogram?.[exactNativeRating] ?? '?'} expected for ${exactNativeRating} star.`
                        : nativeResult.message;
                    this.pauseForNativeFilter(page, maxPages, exactNativeRating, detail);
                    return;
                }
            } else {
                // A scan paused before page one may be resumed after the user has already
                // chosen ★ 1 in TikTok. Safely refresh the *visible native control* once
                // to trigger the filtered response; never fall back to all-review scanning.
                let resumeFilterResult = null;
                if (exactNativeRating && (page === 1 || reviewStore.size === 0)) {
                    this.setState('running', `Refreshing TikTok ${exactNativeRating}-star results before resuming...`, 5);
                    resumeFilterResult = await applyNativeRatingFilter(exactNativeRating);
                }
                const resumeMetricConfirmation = exactNativeRating
                    ? await waitForExactRatingMetrics(exactNativeRating, PACING.responseWait)
                    : { confirmed: true, metrics: readReviewMetrics() };
                this.reviewMetrics = resumeMetricConfirmation.metrics || this.reviewMetrics;
                const resumeTargetBudget = deriveReviewTargetBudget(targetReviews, this.reviewMetrics);
                maxPages = Math.min(100, Math.max(page, resumeTargetBudget.estimatedPages));
                this.options.maxPages = maxPages;
                this.options.targetReviews = resumeTargetBudget.targetReviews;
                this.nativeRatingActive = Boolean(exactNativeRating && resumeMetricConfirmation.confirmed);
                if (exactNativeRating && !this.nativeRatingActive) {
                    const metrics = resumeMetricConfirmation.metrics;
                    const detail = metrics && Number.isFinite(metrics.displayed)
                        ? `TikTok currently shows ${metrics.displayed} of ${metrics.total} reviews, not the expected ${metrics.histogram?.[exactNativeRating] ?? '?'} for ${exactNativeRating} star.`
                        : (resumeFilterResult?.message || 'TikTok has not published a numerical filtered-review count yet.');
                    this.pauseForNativeFilter(page, maxPages, exactNativeRating, detail);
                    return;
                }
                if (this.nativeRatingActive && reviewStore.size === 0) {
                    const receivedFilteredPage = await waitForCondition(() => reviewStore.size > 0, PACING.responseWait, 150);
                    if (!receivedFilteredPage) {
                        extractVisibleFilteredReviews(exactNativeRating, resumeMetricConfirmation.confirmed);
                    }
                    if (!reviewStore.size) {
                        this.pauseForNativeFilter(page, maxPages, exactNativeRating, 'TikTok numerically confirmed the requested rating, but ReviewPort could not safely read any visible filtered review cards yet. Wait for the list to refresh, then retry the selected star filter.');
                        return;
                    }
                }
            }

            if (!this.nativeRatingActive) {
                const targetBudget = deriveReviewTargetBudget(targetReviews, this.reviewMetrics);
                maxPages = Math.min(100, Math.max(page, targetBudget.estimatedPages));
                this.options.maxPages = maxPages;
                this.options.targetReviews = targetBudget.targetReviews;
                // Page 1 data is embedded in the document for unfiltered/range scans.
                const embedded = extractEmbeddedReviews();
                const added = addReviews(embedded);
                debug('Embedded page-one reviews processed', { received: embedded.length, added });
                this.saveReviews();
            }
            this.setState('running', `Page ${page}: ${reviewStore.size} reviews collected`, Math.round((page / maxPages) * 100));

            while (page < maxPages && reviewStore.size < this.options.targetReviews && !this.stopRequested) {
                const visibleVerification = getVerificationMessage();
                if (visibleVerification) {
                    this.pauseForVerification(page, maxPages, visibleVerification);
                    return;
                }

                const nextBtn = findNextButton();
                if (!nextBtn) {
                    const diagnostics = runSelectorSelfTest();
                    this.selectorDiagnostics = diagnostics;
                    if (diagnostics.paginationContainers > 0 && diagnostics.nextStrategy === 'unresolved' && !hasDisabledNextControl()) {
                        this.pauseForPaginationSelector(page, maxPages, diagnostics);
                        return;
                    }
                    debug('No enabled next-page control; pagination finished.');
                    break;
                }

                const currentPage = page;
                const beforeCount = reviewStore.size;
                this.requestedPage = currentPage + 1;
                nextBtn.scrollIntoView({ block: 'center', behavior: 'instant' });
                await sleep(PACING.pageClickSettling);
                nextBtn.click();
                debug('Requested next review page', { page: currentPage + 1 });

                let waited = 0;
                let verificationPrompt = '';
                let pageAdvanced = false;
                while (waited < PACING.responseWait) {
                    await sleep(PACING.responsePoll);
                    waited += PACING.responsePoll;
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
                        setReviewHookActive('stop');
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
                await sleep(PACING.betweenPages); // conservative pacing; no anti-bot bypass attempt
            }

            // Pause and Stop can be requested while a page response is pending. Their saved
            // state must win over the normal completion path so collected reviews remain resumable.
            if (this.stopRequested || this.paused) return;
            this.saveReviews();
            this.isRunning = false;
            this.paused = false;
            setReviewHookActive('stop');
            debug('Scan completed', { reviewCount: reviewStore.size, pages: page });
            const targetReached = reviewStore.size >= this.options.targetReviews;
            this.setState('completed', targetReached
                ? `Review target reached: ${reviewStore.size} reviews collected.`
                : `Completed: ${reviewStore.size} reviews from ${page} page(s)`, 100);
        },

        pauseForVerification(page, maxPages, promptText) {
            this.resumePage = page;
            this.saveReviews();
            this.isRunning = false;
            this.paused = true;
            this.stopRequested = true;
            setReviewHookActive('stop');
            const progress = Math.min(95, Math.round((page / maxPages) * 100));
            debug('Paused for user verification.', { promptText });
            this.setState('paused', `Paused: TikTok requires verification. Complete it in the page, then select Resume scan. ${reviewStore.size} reviews are safely saved.`, progress, 'verification');
        },

        pauseForNativeFilter(page, maxPages, rating, reason = '') {
            this.resumePage = page;
            this.saveReviews();
            this.isRunning = false;
            this.paused = true;
            this.stopRequested = true;
            setReviewHookActive('stop');
            const progress = Math.min(95, Math.round((page / maxPages) * 100));
            const detail = reason ? ` ${reason}` : '';
            this.setState('paused', `Paused before scanning: TikTok did not confirm the ${rating}-star filter, so ReviewPort did not scan all reviews.${detail} Select ${rating} in TikTok's visible review filter, then choose Retry selected star filter.`, progress, 'native_rating');
        },

        pauseForNoData(page, maxPages) {
            this.resumePage = page;
            this.saveReviews();
            this.isRunning = false;
            this.paused = true;
            this.stopRequested = true;
            setReviewHookActive('stop');
            const progress = Math.min(95, Math.round((page / maxPages) * 100));
            const diagnostics = this.selectorDiagnostics || runSelectorSelfTest();
            // This is an intentionally safe pause, not an uncaught extension error.
            // Use informational logging so Chrome DevTools does not present it as a failure stack trace.
            debug('Scan paused safely because TikTok did not return new review data after the next-page request.');
            this.setState('paused', `Scan paused safely: TikTok did not return new review data after page ${page}. Check the product page for a verification prompt, then select Resume scan. Selector check: ${diagnostics.summary}. ${reviewStore.size} reviews are saved locally.`, progress, 'no_data');
        },

        pauseForPaginationSelector(page, maxPages, diagnostics) {
            this.resumePage = page;
            this.saveReviews();
            this.isRunning = false;
            this.paused = true;
            this.stopRequested = true;
            setReviewHookActive('stop');
            const progress = Math.min(95, Math.round((page / maxPages) * 100));
            this.setState('paused', `Paused: ReviewPort could not resolve TikTok’s next-page control. Do not change the page manually. Refresh the product page or report this selector issue, then resume. Selector check: ${diagnostics.summary}. ${reviewStore.size} reviews are saved locally.`, progress, 'pagination_selector');
        },

        pauseByUser() {
            if (!this.isRunning) return false;
            this.resumePage = Math.max(1, this.resumePage);
            this.saveReviews();
            this.isRunning = false;
            this.paused = true;
            this.stopRequested = true;
            setReviewHookActive('stop');
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
            setReviewHookActive('stop');
            const progress = Math.min(100, Math.round((this.resumePage / this.options.maxPages) * 100));
            this.setState('stopped', `Stopped by you. ${reviewStore.size} reviews were kept locally and are ready for the full report.`, progress, 'user');
            return true;
        },

        stop() {
            this.stopRequested = true;
            this.isRunning = false;
            setReviewHookActive('stop');
        },

        clear() {
            reviewStore.clear();
            this.resumePage = 1;
            this.requestedPage = 1;
            this.paused = false;
            this.stopRequested = true;
            if (this.reviewSaveTimer) clearTimeout(this.reviewSaveTimer);
            if (this.stateSaveTimer) clearTimeout(this.stateSaveTimer);
            this.reviewSaveTimer = null;
            this.stateSaveTimer = null;
            setReviewHookActive('stop');
            chrome.storage.local.remove([
                'collectedReviews', 'processedReviews', 'reviews', 'scrapingState', 'lastUpdated',
                'shopifyExportSettings', 'productHandle', 'customExportColumns',
                'minStars', 'maxStars', 'onlyWithImages'
            ]);
        }
    };

    // ==================== Message handling ====================
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        debug('Content script received message', request.action);

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

    debug('Content script loaded.');
})();
