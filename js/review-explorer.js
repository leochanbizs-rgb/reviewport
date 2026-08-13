/*
 * ReviewPort Full Review Preview
 * Reads locally saved extension data only. This page never scrapes TikTok,
 * triggers pagination, solves verification, or sends review content externally.
 */

(() => {
    const PAGE_SIZE = 50;
    const csvExporter = new CSVExporter();

    let reviews = [];
    let sortedReviews = [];
    let visibleCount = PAGE_SIZE;
    let selectedReviewKey = null;
    let selectedPhotoIndex = 0;
    let savedState = {
        scrapingState: null,
        lastUpdated: '',
        customExportColumns: [...CSVExporter.DEFAULT_EXPLORER_COLUMNS],
        shopifySettings: createDefaultShopifySettings()
    };

    const elements = {
        refresh: document.getElementById('refreshReviews'),
        themeToggle: document.getElementById('themeToggle'),
        themeToggleLabel: document.getElementById('themeToggleLabel'),
        openGettingStarted: document.getElementById('openGettingStarted'),
        openExport: document.getElementById('openExport'),
        exportDrawer: document.getElementById('exportDrawer'),
        exportReviewPort: document.getElementById('exportReviewPort'),
        exportMarkdown: document.getElementById('exportMarkdown'),
        exportShopify: document.getElementById('exportShopify'),
        exportContext: document.getElementById('exportContext'),
        columnPicker: document.getElementById('columnPicker'),
        columnSummary: document.getElementById('columnSummary'),
        resetColumns: document.getElementById('resetColumns'),
        shopifyFormat: document.getElementById('shopifyFormat'),
        shopifyFormatBadge: document.getElementById('shopifyFormatBadge'),
        shopifyFormatDescription: document.getElementById('shopifyFormatDescription'),
        shopifyMatchGuidance: document.getElementById('shopifyMatchGuidance'),
        productHandleRequirement: document.getElementById('productHandleRequirement'),
        productIdRequirement: document.getElementById('productIdRequirement'),
        shopifyProgress: document.querySelector('.shopify-progress'),
        shopifyValidation: document.getElementById('shopifyValidation'),
        productHandle: document.getElementById('productHandle'),
        productId: document.getElementById('productId'),
        publicationState: document.getElementById('publicationState'),
        productUrl: document.getElementById('productUrl'),
        productImageUrl: document.getElementById('productImageUrl'),
        productTitle: document.getElementById('productTitle'),
        advancedProductSettings: document.getElementById('advancedProductSettings'),
        yotpoSettings: document.getElementById('yotpoSettings'),
        yotpoScope: document.getElementById('yotpoScope'),
        yotpoCountry: document.getElementById('yotpoCountry'),
        yotpoUseTechnicalEmail: document.getElementById('yotpoUseTechnicalEmail'),
        bugDescription: document.getElementById('bugDescription'),
        includeDiagnostics: document.getElementById('includeDiagnostics'),
        prepareBugReport: document.getElementById('prepareBugReport'),
        bugStatus: document.getElementById('bugStatus'),
        pausedBanner: document.getElementById('pausedBanner'),
        pausedMessage: document.getElementById('pausedMessage'),
        subtitle: document.getElementById('workspaceSubtitle'),
        scanContext: document.getElementById('scanContext'),
        summaryTotal: document.getElementById('summaryTotal'),
        summaryPhotos: document.getElementById('summaryPhotos'),
        summaryMultiPhotos: document.getElementById('summaryMultiPhotos'),
        summaryLowRated: document.getElementById('summaryLowRated'),
        sort: document.getElementById('sortReviews'),
        tableBody: document.getElementById('reviewTableBody'),
        tableStatus: document.getElementById('tableStatus'),
        loadMore: document.getElementById('loadMoreReviews'),
        detailEmpty: document.getElementById('detailEmpty'),
        detailContent: document.getElementById('detailContent'),
        detailReviewer: document.getElementById('detailReviewer'),
        detailRating: document.getElementById('detailRating'),
        detailDate: document.getElementById('detailDate'),
        detailSku: document.getElementById('detailSku'),
        detailText: document.getElementById('detailText'),
        closeDetails: document.getElementById('closeDetails'),
        detailBackdrop: document.getElementById('detailBackdrop'),
        mediaTitle: document.getElementById('mediaTitle'),
        mediaEmpty: document.getElementById('mediaEmpty'),
        mediaViewer: document.getElementById('mediaViewer'),
        mainPhoto: document.getElementById('mainPhoto'),
        imageUnavailable: document.getElementById('imageUnavailable'),
        originalPhotoLink: document.getElementById('openOriginalPhoto'),
        thumbnails: document.getElementById('photoThumbnails'),
        previousPhoto: document.getElementById('previousPhoto'),
        nextPhoto: document.getElementById('nextPhoto'),
        photoPosition: document.getElementById('photoPosition'),
        workspace: document.querySelector('.review-workspace')
    };

    elements.refresh.addEventListener('click', () => loadSavedReviews(true));
    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.openGettingStarted.addEventListener('click', openGettingStarted);
    elements.openExport.addEventListener('click', openExportDrawer);
    elements.sort.addEventListener('change', () => {
        visibleCount = PAGE_SIZE;
        sortReviews();
        renderTable();
    });
    elements.loadMore.addEventListener('click', () => {
        visibleCount += PAGE_SIZE;
        renderTable();
    });
    elements.closeDetails.addEventListener('click', clearSelection);
    elements.detailBackdrop.addEventListener('click', clearSelection);
    elements.previousPhoto.addEventListener('click', () => movePhoto(-1));
    elements.nextPhoto.addEventListener('click', () => movePhoto(1));
    elements.exportReviewPort.addEventListener('click', exportReviewPortCSV);
    elements.exportMarkdown.addEventListener('click', exportMarkdown);
    elements.exportShopify.addEventListener('click', exportShopifyCSV);
    [
        elements.shopifyFormat, elements.productHandle, elements.productId, elements.publicationState,
        elements.productUrl, elements.productImageUrl, elements.productTitle, elements.yotpoScope,
        elements.yotpoCountry, elements.yotpoUseTechnicalEmail
    ].forEach(control => {
        control.addEventListener('change', saveShopifySettings);
        control.addEventListener('input', updateShopifyFormatUI);
    });
    elements.columnPicker.addEventListener('change', handleColumnSelection);
    elements.columnPicker.addEventListener('click', handleColumnOrdering);
    elements.resetColumns.addEventListener('click', resetCustomColumns);
    elements.prepareBugReport.addEventListener('click', prepareBugReport);
    document.addEventListener('keydown', handleKeyboardNavigation);

    loadTheme();
    loadSavedReviews(false);

    function loadTheme() {
        chrome.storage.local.get(['reportTheme'], result => {
            applyTheme(result.reportTheme === 'light' ? 'light' : 'dark');
        });
    }

    function toggleTheme() {
        const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        chrome.storage.local.set({ reportTheme: nextTheme });
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
        elements.themeToggle.setAttribute('aria-pressed', String(isDark));
        elements.themeToggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
        elements.themeToggleLabel.textContent = isDark ? 'Light' : 'Dark';
    }

    function loadSavedReviews(showRefreshState) {
        if (showRefreshState) {
            elements.refresh.disabled = true;
            elements.refresh.textContent = 'Refreshing…';
        }

        chrome.storage.local.get([
            'collectedReviews', 'processedReviews', 'scrapingState', 'lastUpdated',
            'productHandle', 'shopifyExportSettings', 'minStars', 'maxStars', 'onlyWithImages', 'customExportColumns'
        ], (result) => {
            const preferred = Array.isArray(result.processedReviews) && result.processedReviews.length
                ? result.processedReviews
                : result.collectedReviews;

            reviews = Array.isArray(preferred) ? preferred.map(normalizeReview).filter(Boolean) : [];
            savedState = {
                scrapingState: result.scrapingState || null,
                lastUpdated: result.lastUpdated || '',
                minStars: result.minStars || 1,
                maxStars: result.maxStars || 5,
                onlyWithImages: Boolean(result.onlyWithImages),
                customExportColumns: CSVExporter.normalizeExplorerColumns(result.customExportColumns),
                shopifySettings: loadShopifySettings(result)
            };
            syncShopifySettingsToControls();
            updateShopifyFormatUI();
            renderColumnPicker();

            if (selectedReviewKey && !reviews.some(review => review.key === selectedReviewKey)) {
                selectedReviewKey = null;
            }

            visibleCount = Math.max(PAGE_SIZE, Math.min(visibleCount, reviews.length || PAGE_SIZE));
            sortReviews();
            updateHeader();
            updateSummary();
            renderTable();
            renderSelection();

            elements.refresh.disabled = false;
            elements.refresh.textContent = 'Refresh saved reviews';
        });
    }

    function normalizeReview(review) {
        if (!review || typeof review !== 'object') return null;
        const description = String(review.description || '').replace(/\s+/g, ' ').trim();
        const username = String(review.username || '').trim();
        const date = String(review.date || '').trim();
        const sku = String(review.sku || '').trim();
        const rating = Math.max(0, Math.min(5, parseInt(review.rating, 10) || 0));
        const key = String(review.review_id || `${username}::${date}::${sku}::${description.slice(0, 120)}`);
        return {
            ...review,
            key,
            username,
            description,
            sku,
            date,
            rating,
            photos: ReviewClassifier.photoUrls(review).filter(isSafeImageUrl)
        };
    }

    function isSafeImageUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' || url.protocol === 'http:';
        } catch (_) {
            return false;
        }
    }

    function sortReviews() {
        const newestFirst = elements.sort.value === 'newest';
        sortedReviews = [...reviews].sort((a, b) => {
            if (!newestFirst && a.rating !== b.rating) return a.rating - b.rating;
            if (newestFirst) {
                const timeA = Date.parse(a.date) || 0;
                const timeB = Date.parse(b.date) || 0;
                if (timeA !== timeB) return timeB - timeA;
            }
            if (!newestFirst && a.rating === b.rating) {
                const timeA = Date.parse(a.date) || 0;
                const timeB = Date.parse(b.date) || 0;
                if (timeA !== timeB) return timeB - timeA;
            }
            return a.key.localeCompare(b.key);
        });
    }

    function updateHeader() {
        const total = reviews.length;
        elements.subtitle.textContent = total
            ? `${total} review${total === 1 ? '' : 's'} saved locally. Select a row to inspect the original review and buyer photos.`
            : 'No saved reviews yet. Open a TikTok Shop product page and run a ReviewPort scan.';

        const filters = `${savedState.minStars}–${savedState.maxStars} stars${savedState.onlyWithImages ? ' · photos only' : ''}`;
        const updated = savedState.lastUpdated ? `Last saved ${formatLocalTime(savedState.lastUpdated)}.` : 'No scan timestamp available.';
        elements.scanContext.textContent = total ? `${filters} · ${updated}` : 'Data stays in your browser until you export or clear it.';

        const paused = savedState.scrapingState && (savedState.scrapingState.status || savedState.scrapingState.state) === 'paused';
        elements.pausedBanner.hidden = !paused;
        if (paused) {
            elements.pausedMessage.textContent = savedState.scrapingState.message
                || 'Complete TikTok verification in the product page, then use Resume after verification from the ReviewPort popup.';
        }

        const hasReviews = total > 0;
        elements.exportReviewPort.disabled = !hasReviews;
        elements.exportMarkdown.disabled = !hasReviews;
        elements.exportShopify.disabled = !hasReviews;
        elements.exportContext.textContent = `${total} review${total === 1 ? '' : 's'} ready`;
    }

    function updateSummary() {
        const summary = ReviewClassifier.summary(reviews);
        elements.summaryTotal.textContent = summary.total;
        elements.summaryPhotos.textContent = summary.photoReviews;
        elements.summaryMultiPhotos.textContent = summary.multiPhotoReviews;
        elements.summaryLowRated.textContent = summary.lowRated;
    }

    function renderColumnPicker() {
        const definitions = CSVExporter.getExplorerColumnDefinitions();
        const selectedKeys = CSVExporter.normalizeExplorerColumns(savedState.customExportColumns);
        savedState.customExportColumns = selectedKeys;
        const selectedDefinitions = selectedKeys
            .map(key => definitions.find(column => column.key === key))
            .filter(Boolean);
        const unselectedDefinitions = definitions.filter(column => !selectedKeys.includes(column.key));
        const orderedDefinitions = [...selectedDefinitions, ...unselectedDefinitions];

        elements.columnPicker.replaceChildren();
        orderedDefinitions.forEach(column => {
            const selectedIndex = selectedKeys.indexOf(column.key);
            const isSelected = selectedIndex !== -1;
            const row = document.createElement('div');
            row.className = `report-column-option${isSelected ? ' is-selected' : ''}`;
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = isSelected;
            checkbox.dataset.columnKey = column.key;
            checkbox.disabled = isSelected && selectedKeys.length === 1;
            const text = document.createElement('span');
            text.textContent = column.label;
            label.append(checkbox, text);
            row.append(label);

            if (isSelected) {
                const controls = document.createElement('span');
                controls.className = 'report-column-order-controls';
                controls.append(
                    createColumnOrderButton('↑', `Move ${column.label} earlier`, column.key, 'up', selectedIndex === 0),
                    createColumnOrderButton('↓', `Move ${column.label} later`, column.key, 'down', selectedIndex === selectedKeys.length - 1)
                );
                row.append(controls);
            }
            elements.columnPicker.append(row);
        });
        elements.columnSummary.textContent = `${selectedKeys.length} selected`;
    }

    function createColumnOrderButton(symbol, label, key, direction, disabled) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'report-column-order-button';
        button.textContent = symbol;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.dataset.columnKey = key;
        button.dataset.direction = direction;
        button.disabled = disabled;
        return button;
    }

    function handleColumnSelection(event) {
        const checkbox = event.target;
        if (!checkbox.matches('input[type="checkbox"][data-column-key]')) return;
        const key = checkbox.dataset.columnKey;
        if (checkbox.checked && !savedState.customExportColumns.includes(key)) {
            savedState.customExportColumns.push(key);
        } else if (!checkbox.checked && savedState.customExportColumns.length > 1) {
            savedState.customExportColumns = savedState.customExportColumns.filter(column => column !== key);
        }
        saveCustomColumns();
    }

    function handleColumnOrdering(event) {
        const button = event.target.closest('.report-column-order-button');
        if (!button || button.disabled) return;
        const index = savedState.customExportColumns.indexOf(button.dataset.columnKey);
        const nextIndex = index + (button.dataset.direction === 'up' ? -1 : 1);
        if (index < 0 || nextIndex < 0 || nextIndex >= savedState.customExportColumns.length) return;
        [savedState.customExportColumns[index], savedState.customExportColumns[nextIndex]] = [
            savedState.customExportColumns[nextIndex], savedState.customExportColumns[index]
        ];
        saveCustomColumns();
    }

    function resetCustomColumns() {
        savedState.customExportColumns = [...CSVExporter.DEFAULT_EXPLORER_COLUMNS];
        saveCustomColumns();
        announceExport('ReviewPort CSV columns reset to the default order.');
    }

    function saveCustomColumns() {
        savedState.customExportColumns = CSVExporter.normalizeExplorerColumns(savedState.customExportColumns);
        chrome.storage.local.set({ customExportColumns: savedState.customExportColumns });
        renderColumnPicker();
    }

    function createDefaultShopifySettings() {
        return {
            format: 'judge_me',
            productHandle: '',
            productId: '',
            productUrl: '',
            productImageUrl: '',
            productTitle: '',
            publicationState: 'pending',
            yotpoScope: 'product',
            yotpoCountry: '',
            yotpoUseTechnicalEmail: false
        };
    }

    function loadShopifySettings(result) {
        const stored = result.shopifyExportSettings && typeof result.shopifyExportSettings === 'object'
            ? result.shopifyExportSettings
            : {};
        const legacyHandle = String(result.productHandle || '').trim();
        const source = {
            ...createDefaultShopifySettings(),
            ...stored,
            productHandle: stored.productHandle ?? (legacyHandle === 'tiktok-product' ? '' : legacyHandle)
        };
        const normalized = ShopifyReviewConverter.normalizeSettings(source);
        return {
            ...normalized,
            format: ShopifyReviewConverter.FORMAT_META[source.format] ? source.format : 'judge_me'
        };
    }

    function syncShopifySettingsToControls() {
        const settings = savedState.shopifySettings;
        elements.shopifyFormat.value = settings.format;
        elements.productHandle.value = settings.productHandle;
        elements.productId.value = settings.productId;
        elements.publicationState.value = settings.publicationState;
        elements.productUrl.value = settings.productUrl;
        elements.productImageUrl.value = settings.productImageUrl;
        elements.productTitle.value = settings.productTitle;
        elements.yotpoScope.value = settings.yotpoScope;
        elements.yotpoCountry.value = settings.yotpoCountry;
        elements.yotpoUseTechnicalEmail.checked = settings.yotpoUseTechnicalEmail;
    }

    function readShopifySettingsFromControls() {
        const selectedFormat = elements.shopifyFormat.value;
        const normalized = ShopifyReviewConverter.normalizeSettings({
            productHandle: elements.productHandle.value,
            productId: elements.productId.value,
            productUrl: elements.productUrl.value,
            productImageUrl: elements.productImageUrl.value,
            productTitle: elements.productTitle.value,
            publicationState: elements.publicationState.value,
            yotpoScope: elements.yotpoScope.value,
            yotpoCountry: elements.yotpoCountry.value,
            yotpoUseTechnicalEmail: elements.yotpoUseTechnicalEmail.checked
        });
        return {
            ...normalized,
            format: ShopifyReviewConverter.FORMAT_META[selectedFormat] ? selectedFormat : 'judge_me'
        };
    }

    function saveShopifySettings() {
        savedState.shopifySettings = readShopifySettingsFromControls();
        chrome.storage.local.set({
            shopifyExportSettings: savedState.shopifySettings,
            productHandle: savedState.shopifySettings.productHandle
        });
        updateShopifyFormatUI();
    }

    function currentShopifyValidation(settings) {
        const format = settings.format;
        const hasSkuForEveryReview = reviews.length > 0 && reviews.every(review => Boolean(review.sku));
        if ((format === 'loox' || format === 'ryviu') && !settings.productHandle) {
            return 'Step 2: add the Shopify product handle shown in your store URL before downloading this CSV.';
        }
        if ((format === 'okendo' || format === 'opinew') && !(settings.productHandle || settings.productId || hasSkuForEveryReview)) {
            return 'Step 2: add a product handle or Product ID, unless every saved review already has a SKU.';
        }
        if (format === 'stamped' && !(settings.productId && settings.productUrl && settings.productImageUrl && settings.productTitle)) {
            return 'Step 2: open “My app needs more product details” and add the Product ID, URL, image URL, and title required by Stamped.';
        }
        if (format === 'stamped' && (!ShopifyReviewConverter.isHttpUrl(settings.productUrl) || !ShopifyReviewConverter.isHttpUrl(settings.productImageUrl))) {
            return 'Step 2: use full public https:// URLs for both the Stamped product page and main product image.';
        }
        if (format === 'yotpo') {
            if (settings.yotpoScope === 'product' && !settings.productId) return 'Step 2: add the Shopify Product ID for a Yotpo product review.';
            if (!/^[a-z]{2}$/.test(settings.yotpoCountry)) return 'Step 2: enter Yotpo’s two-letter customer country code, such as us or ca.';
            if (!settings.yotpoUseTechnicalEmail) return 'Step 2: confirm the Yotpo technical email policy before downloading this CSV.';
        }
        return '';
    }

    function updateShopifyFormatUI() {
        const settings = readShopifySettingsFromControls();
        const descriptions = {
            judge_me: 'Judge.me CSV. Leave all product details blank only for a store review. Images are limited to 5 supported public links.',
            loox: 'Loox CSV. Requires the Shopify product handle and uses YYYY-MM-DD dates. Images are limited to 5 supported public links.',
            okendo: 'Okendo CSV. Uses product handle, product ID, or the original SKU. New imports stay pending by default.',
            opinew: 'Opinew CSV. Uses product ID, product handle, or SKU. New imports stay unpublished by default.',
            ryviu: 'Ryviu CSV. Requires the Shopify product handle. New imports stay disabled by default.',
            yotpo: 'Yotpo mapping CSV. Product reviews need Product ID, country, and an explicit local technical-email confirmation.',
            stamped: 'Stamped CSV. Requires advanced Shopify product details before a file can be created.',
            fera: 'Fera sample mapping CSV. Product ID is optional; leaving it blank creates a store-review mapping.'
        };
        const guidance = {
            judge_me: 'For a store review, you can skip product matching. Add a handle only when you want the review attached to a Shopify product.',
            loox: 'Loox needs the Shopify product handle. You do not need a Product ID for this format.',
            okendo: 'Okendo can match by product handle, Product ID, or the original SKU on every saved review.',
            opinew: 'Opinew can match by Product ID, product handle, or the original SKU on every saved review.',
            ryviu: 'Ryviu needs the Shopify product handle. You do not need a Product ID for this format.',
            yotpo: 'Yotpo product reviews need a Product ID. Open Yotpo needs extra confirmation below.',
            stamped: 'Stamped needs Product ID plus the extra product details in the expanded section below.',
            fera: 'Fera can use an optional Product ID. Leave it blank for a store-review mapping.'
        };
        const handleOnlyFormats = new Set(['loox', 'ryviu']);
        const idOnlyFormats = new Set(['yotpo', 'stamped', 'fera']);
        const handleField = elements.productHandle.closest('.shopify-field');
        const idField = elements.productId.closest('.shopify-field');
        handleField.hidden = idOnlyFormats.has(settings.format);
        idField.hidden = handleOnlyFormats.has(settings.format);
        elements.productHandleRequirement.textContent = handleOnlyFormats.has(settings.format)
            ? 'Required for this app'
            : settings.format === 'judge_me'
                ? 'Optional for a product review'
                : 'Handle, ID, or SKU accepted';
        elements.productIdRequirement.textContent = settings.format === 'stamped'
            ? 'Required for Stamped'
            : settings.format === 'yotpo'
                ? (settings.yotpoScope === 'product' ? 'Required for Yotpo product reviews' : 'Optional for site reviews')
                : settings.format === 'fera'
                    ? 'Optional for Fera'
                    : 'Handle, ID, or SKU accepted';
        elements.shopifyFormatBadge.textContent = CSVExporter.SHOPIFY_FORMATS[settings.format] || 'Shopify CSV';
        elements.shopifyFormatDescription.textContent = descriptions[settings.format] || 'ReviewPort validates the required fields before exporting.';
        elements.shopifyMatchGuidance.textContent = guidance[settings.format] || 'Only fill in the fields required by the app you selected.';
        elements.advancedProductSettings.hidden = settings.format !== 'stamped';
        elements.yotpoSettings.hidden = settings.format !== 'yotpo';
        const issue = currentShopifyValidation(settings);
        const progress = elements.shopifyProgress?.querySelectorAll('li');
        progress?.forEach((step, index) => step.classList.toggle('is-active', index === (issue ? 1 : 2)));
        setShopifyValidation(issue || 'Everything required is ready. Download your local Shopify CSV when you are ready.', issue ? 'error' : 'success');
    }

    function setShopifyValidation(message, type = '') {
        elements.shopifyValidation.textContent = message;
        elements.shopifyValidation.dataset.type = type;
    }

    function renderTable() {
        elements.tableBody.replaceChildren();
        if (!sortedReviews.length) {
            const row = document.createElement('tr');
            row.className = 'empty-table';
            const cell = document.createElement('td');
            cell.colSpan = 6;
            cell.textContent = 'No saved reviews match the latest scan settings. Return to the ReviewPort popup to scan reviews.';
            row.appendChild(cell);
            elements.tableBody.appendChild(row);
            elements.tableStatus.textContent = 'No saved reviews.';
            elements.loadMore.hidden = true;
            return;
        }

        const rendered = sortedReviews.slice(0, visibleCount);
        const fragment = document.createDocumentFragment();
        rendered.forEach(review => fragment.appendChild(createReviewRow(review)));
        elements.tableBody.appendChild(fragment);

        const remaining = Math.max(0, sortedReviews.length - rendered.length);
        elements.tableStatus.textContent = remaining
            ? `Showing ${rendered.length} of ${sortedReviews.length} saved reviews.`
            : `Showing all ${sortedReviews.length} saved reviews.`;
        elements.loadMore.hidden = remaining === 0;
        if (remaining) elements.loadMore.textContent = `Load ${Math.min(PAGE_SIZE, remaining)} more reviews`;
    }

    function createReviewRow(review) {
        const row = document.createElement('tr');
        row.tabIndex = 0;
        row.dataset.reviewKey = review.key;
        row.setAttribute('aria-label', `Open details for review from ${review.username || 'unknown reviewer'} rated ${review.rating || 0} stars`);
        if (review.key === selectedReviewKey) row.classList.add('is-selected');
        row.addEventListener('click', () => selectReview(review.key));
        row.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectReview(review.key);
            }
        });

        row.appendChild(textCell(review.date || '—', 'review-date'));
        row.appendChild(textCell(review.username || '—', 'reviewer-name'));

        const ratingCell = document.createElement('td');
        const rating = document.createElement('span');
        rating.className = 'star-rating';
        rating.setAttribute('aria-label', `${review.rating} out of 5 stars`);
        rating.textContent = `${'★'.repeat(review.rating)}${'☆'.repeat(Math.max(0, 5 - review.rating))}`;
        const number = document.createElement('span');
        number.className = 'rating-number';
        number.textContent = String(review.rating || '—');
        rating.appendChild(number);
        ratingCell.appendChild(rating);
        row.appendChild(ratingCell);

        const skuCell = document.createElement('td');
        if (review.sku) {
            const sku = document.createElement('span');
            sku.className = 'sku-label';
            sku.title = review.sku;
            sku.textContent = review.sku;
            skuCell.appendChild(sku);
        } else {
            skuCell.appendChild(textCell('—', 'sku-empty').firstChild);
        }
        row.appendChild(skuCell);

        row.appendChild(textCell(review.description || 'No written review', 'review-excerpt'));

        const photoCell = document.createElement('td');
        const photoCount = document.createElement('span');
        photoCount.className = `photo-count${review.photos.length ? '' : ' no-photos'}`;
        photoCount.textContent = review.photos.length ? `${review.photos.length} photo${review.photos.length === 1 ? '' : 's'}` : '—';
        photoCell.appendChild(photoCount);
        row.appendChild(photoCell);
        return row;
    }

    function textCell(text, className) {
        const cell = document.createElement('td');
        const span = document.createElement('span');
        if (className) span.className = className;
        span.textContent = text;
        cell.appendChild(span);
        return cell;
    }

    function selectReview(key) {
        selectedReviewKey = key;
        selectedPhotoIndex = 0;
        renderTable();
        renderSelection();
    }

    function clearSelection() {
        selectedReviewKey = null;
        selectedPhotoIndex = 0;
        renderTable();
        renderSelection();
    }

    function selectedReview() {
        return reviews.find(review => review.key === selectedReviewKey) || null;
    }

    function renderSelection() {
        const review = selectedReview();
        const hasSelection = Boolean(review);
        elements.workspace.classList.toggle('has-selection', hasSelection);
        elements.detailEmpty.hidden = hasSelection;
        elements.detailContent.hidden = !hasSelection;
        if (!review) return;

        elements.detailReviewer.textContent = review.username || 'Unknown reviewer';
        elements.detailRating.textContent = `${'★'.repeat(review.rating)}${'☆'.repeat(Math.max(0, 5 - review.rating))} ${review.rating}/5`;
        elements.detailDate.textContent = review.date || 'No date';
        elements.detailSku.textContent = review.sku || 'No SKU recorded';
        elements.detailText.textContent = review.description || 'No written review was provided.';
        renderPhotos(review);
    }

    function renderPhotos(review) {
        const photos = review.photos;
        const hasPhotos = photos.length > 0;
        elements.mediaEmpty.hidden = hasPhotos;
        elements.mediaViewer.hidden = !hasPhotos;
        elements.photoPosition.hidden = !hasPhotos;
        elements.mediaTitle.textContent = hasPhotos
            ? `${photos.length} buyer photo${photos.length === 1 ? '' : 's'}`
            : 'No buyer photos';

        if (!hasPhotos) {
            elements.thumbnails.replaceChildren();
            return;
        }

        selectedPhotoIndex = Math.max(0, Math.min(selectedPhotoIndex, photos.length - 1));
        elements.photoPosition.textContent = `${selectedPhotoIndex + 1} / ${photos.length}`;
        elements.previousPhoto.disabled = selectedPhotoIndex === 0;
        elements.nextPhoto.disabled = selectedPhotoIndex === photos.length - 1;
        renderThumbnailStrip(review);
        loadMainPhoto(photos[selectedPhotoIndex], review, selectedPhotoIndex);
    }

    function renderThumbnailStrip(review) {
        const fragment = document.createDocumentFragment();
        review.photos.forEach((url, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `thumbnail-button${index === selectedPhotoIndex ? ' is-active' : ''}`;
            button.setAttribute('aria-label', `View buyer photo ${index + 1} of ${review.photos.length}`);
            button.addEventListener('click', () => {
                selectedPhotoIndex = index;
                renderPhotos(review);
            });
            const img = document.createElement('img');
            img.src = url;
            img.alt = '';
            img.loading = 'lazy';
            img.referrerPolicy = 'no-referrer';
            img.addEventListener('error', () => {
                img.replaceWith(createThumbnailFallback());
            }, { once: true });
            button.appendChild(img);
            fragment.appendChild(button);
        });
        elements.thumbnails.replaceChildren(fragment);
    }

    function createThumbnailFallback() {
        const fallback = document.createElement('span');
        fallback.className = 'thumbnail-fallback';
        fallback.textContent = '—';
        return fallback;
    }

    function loadMainPhoto(url, review, index) {
        elements.imageUnavailable.hidden = true;
        elements.mainPhoto.hidden = false;
        elements.mainPhoto.alt = `Buyer photo ${index + 1} from ${review.username || 'reviewer'}`;
        elements.originalPhotoLink.href = url;
        elements.mainPhoto.onload = () => {
            elements.mainPhoto.hidden = false;
            elements.imageUnavailable.hidden = true;
        };
        elements.mainPhoto.onerror = () => {
            elements.mainPhoto.hidden = true;
            elements.imageUnavailable.hidden = false;
        };
        elements.mainPhoto.src = url;
    }

    function movePhoto(direction) {
        const review = selectedReview();
        if (!review || !review.photos.length) return;
        selectedPhotoIndex = Math.max(0, Math.min(review.photos.length - 1, selectedPhotoIndex + direction));
        renderPhotos(review);
    }

    function handleKeyboardNavigation(event) {
        const interactive = ['INPUT', 'TEXTAREA', 'SELECT'];
        if (interactive.includes(document.activeElement?.tagName)) return;
        if (event.key === 'ArrowLeft') movePhoto(-1);
        if (event.key === 'ArrowRight') movePhoto(1);
        if (event.key === 'Escape' && selectedReviewKey) clearSelection();
    }

    function openGettingStarted() {
        chrome.tabs.create({ url: chrome.runtime.getURL('getting-started.html') }, () => {
            if (chrome.runtime.lastError) {
                announceExport('Could not open the quick guide. Please try again.');
            }
        });
    }

    function openExportDrawer() {
        elements.exportDrawer.open = true;
        window.setTimeout(() => {
            const summary = elements.exportDrawer.querySelector('summary');
            const isDesktopDualWorkspace = window.matchMedia('(min-width: 1280px)').matches;
            if (!isDesktopDualWorkspace) {
                elements.exportDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            summary?.focus({ preventScroll: true });
        }, 0);
    }

    function exportReviewPortCSV() {
        if (!reviews.length) return;
        const filename = `reviewport_reviews_${fileTimestamp()}.csv`;
        csvExporter.exportToExplorerCSV(reviews, filename, savedState.customExportColumns);
        announceExport(`Exported ${reviews.length} reviews in ReviewPort CSV format.`);
    }

    function exportMarkdown() {
        if (!reviews.length) return;
        const filename = `reviewport_reviews_${fileTimestamp()}.md`;
        csvExporter.exportToMarkdown(reviews, filename, savedState.customExportColumns);
        announceExport(`Exported ${reviews.length} reviews as structured Markdown for LLM analysis.`);
    }

    function exportShopifyCSV() {
        if (!reviews.length) return;
        saveShopifySettings();
        const settings = savedState.shopifySettings;
        const issue = currentShopifyValidation(settings);
        if (issue) {
            setShopifyValidation(issue, 'error');
            elements.shopifyValidation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }
        try {
            const slug = settings.format.replace(/_/g, '-');
            const diagnostics = csvExporter.exportToShopifyCSV(
                settings.format,
                reviews,
                `${slug}_reviews_${fileTimestamp()}.csv`,
                settings
            );
            const skipped = diagnostics.skippedImages;
            const message = `Exported ${reviews.length} reviews in ${CSVExporter.SHOPIFY_FORMATS[settings.format]} format.${skipped ? ` ${skipped} unsupported or excess image URL${skipped === 1 ? '' : 's'} skipped.` : ''}`;
            setShopifyValidation(message, skipped ? 'error' : 'success');
            announceExport(message);
        } catch (error) {
            setShopifyValidation(error.message || 'The Shopify CSV could not be created.', 'error');
        }
    }

    function prepareBugReport() {
        const description = elements.bugDescription.value.trim();
        if (!description) {
            elements.bugStatus.textContent = 'Add a short description before preparing the email.';
            elements.bugStatus.dataset.type = 'error';
            elements.bugDescription.focus();
            return;
        }

        const body = [
            'ReviewPort bug report',
            '',
            'What happened:',
            description,
            ''
        ];

        if (elements.includeDiagnostics.checked) {
            const scanStatus = savedState.scrapingState?.status || savedState.scrapingState?.state || 'not available';
            body.push(
                'Technical details (no review text, usernames, or image URLs included):',
                `- Extension version: ${chrome.runtime.getManifest().version}`,
                `- Saved review count: ${reviews.length}`,
                `- Rating setting: ${savedState.minStars}–${savedState.maxStars} stars`,
                `- Photos only: ${savedState.onlyWithImages ? 'on' : 'off'}`,
                `- Scan status: ${scanStatus}`,
                `- Last saved: ${savedState.lastUpdated || 'not available'}`
            );
        }

        const subject = encodeURIComponent('ReviewPort bug report');
        const mailto = `mailto:leochanbizs@gmail.com?subject=${subject}&body=${encodeURIComponent(body.join('\n'))}`;
        elements.bugStatus.textContent = 'Opening an email draft. Review it and send it from your mail app.';
        elements.bugStatus.dataset.type = 'success';
        window.location.href = mailto;
    }

    function announceExport(message) {
        elements.scanContext.textContent = message;
        window.setTimeout(() => {
            if (reviews.length) updateHeader();
        }, 2500);
    }

    function fileTimestamp() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    }

    function formatLocalTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'recently';
        return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }
})();
