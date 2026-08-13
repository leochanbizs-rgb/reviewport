/**
 * ReviewPort local utilities.
 * All formatting and export work is performed in the browser. Review content is
 * never sent to a translation, AI, or other third-party service.
 */

class ReviewFilter {
    filterByRating(reviews, minStars, maxStars) {
        return reviews.filter(review => {
            const rating = parseInt(review.rating, 10) || 0;
            return rating >= minStars && rating <= maxStars;
        });
    }

    filterByImages(reviews, onlyWithImages) {
        if (!onlyWithImages) return reviews;
        return reviews.filter(review => ReviewClassifier.photoUrls(review).length > 0);
    }

    applyFilters(reviews, options = {}) {
        const byRating = this.filterByRating(reviews, options.minStars || 1, options.maxStars || 5);
        return this.filterByImages(byRating, Boolean(options.onlyWithImages));
    }
}

class ReviewClassifier {
    static photoUrls(review) {
        if (Array.isArray(review?.photos)) {
            return review.photos.map(url => String(url || '').trim()).filter(Boolean);
        }
        return String(review?.photo_urls || '')
            .split(' | ')
            .map(url => url.trim())
            .filter(url => Boolean(url) && url !== 'N/A');
    }

    static ratingCategory(rating) {
        const value = parseInt(rating, 10) || 0;
        if (value === 5) return '5 stars - Excellent';
        if (value === 4) return '4 stars - Good';
        if (value === 3) return '3 stars - Mixed';
        if (value >= 1) return '1-2 stars - Needs attention';
        return 'No rating';
    }

    static photoCategory(photoCount) {
        if (photoCount === 0) return 'No photos';
        if (photoCount === 1) return '1 photo';
        if (photoCount <= 3) return '2-3 photos';
        return '4+ photos';
    }

    static metadata(review) {
        const photos = this.photoUrls(review);
        return {
            rating_category: this.ratingCategory(review.rating),
            review_type: photos.length ? 'Photo review' : 'Text review',
            has_photos: photos.length ? 'Yes' : 'No',
            photo_count: photos.length,
            photo_category: this.photoCategory(photos.length),
            photos
        };
    }

    static summary(reviews) {
        const counts = { total: reviews.length, photoReviews: 0, multiPhotoReviews: 0, lowRated: 0 };
        reviews.forEach(review => {
            const metadata = this.metadata(review);
            if (metadata.photo_count > 0) counts.photoReviews += 1;
            if (metadata.photo_count > 1) counts.multiPhotoReviews += 1;
            if ((parseInt(review.rating, 10) || 0) <= 2) counts.lowRated += 1;
        });
        return counts;
    }
}

/**
 * Converts only locally stored ReviewPort data into documented Shopify review
 * import layouts. It deliberately leaves unknown merchant/customer data empty.
 */
class ShopifyReviewConverter {
    static FORMAT_META = Object.freeze({
        judge_me: { label: 'Judge.me CSV', maxPhotos: 5, needsHandle: false },
        loox: { label: 'Loox CSV', maxPhotos: 5, needsHandle: true },
        okendo: { label: 'Okendo CSV', maxPhotos: Infinity, needsHandle: false },
        opinew: { label: 'Opinew CSV', maxPhotos: Infinity, needsHandle: false },
        ryviu: { label: 'Ryviu CSV', maxPhotos: Infinity, needsHandle: true },
        yotpo: { label: 'Yotpo mapping CSV', maxPhotos: 1, needsHandle: false },
        stamped: { label: 'Stamped CSV', maxPhotos: 3, needsHandle: false },
        fera: { label: 'Fera sample mapping CSV', maxPhotos: 2, needsHandle: false }
    });

    static normalizeSettings(settings = {}) {
        const text = value => String(value ?? '').trim();
        return {
            productHandle: text(settings.productHandle),
            productId: text(settings.productId),
            productUrl: text(settings.productUrl),
            productImageUrl: text(settings.productImageUrl),
            productTitle: text(settings.productTitle),
            publicationState: settings.publicationState === 'published' ? 'published' : 'pending',
            yotpoScope: settings.yotpoScope === 'site' ? 'site' : 'product',
            yotpoCountry: text(settings.yotpoCountry).toLowerCase(),
            yotpoUseTechnicalEmail: Boolean(settings.yotpoUseTechnicalEmail)
        };
    }

    static build(format, reviews, settings = {}) {
        if (!Array.isArray(reviews) || !reviews.length) throw new Error('No reviews available to export.');
        const normalized = this.normalizeSettings(settings);
        if (!this.FORMAT_META[format]) throw new Error(`Unsupported Shopify export format: ${format}.`);
        if (this.FORMAT_META[format].needsHandle && !normalized.productHandle) {
            throw new Error(`${this.FORMAT_META[format].label} requires a Shopify product handle. Add the part after /products/ in Shopify import settings.`);
        }

        const diagnostics = { skippedImages: 0, totalImages: 0 };
        const rows = reviews.map((review, index) => this.rowFor(format, review, index, normalized, diagnostics));
        return { headers: this.headersFor(format), rows, diagnostics };
    }

    static headersFor(format) {
        const headers = {
            judge_me: ['title', 'body', 'rating', 'review_date', 'reviewer_name', 'reviewer_email', 'product_url', 'picture_urls', 'product_id', 'product_handle', 'reply', 'reply_date', 'ip_address', 'curated'],
            loox: ['product_handle', 'product_Id', 'rating', 'author', 'email', 'body', 'created_at', 'photo_url', 'reply', 'replied_at', 'verified_purchase', 'incentivized'],
            okendo: ['name', 'body', 'handle', 'productId', 'rating', 'sku', 'dateCreated', 'countryCode', 'email', 'imageUrls', 'isApproved', 'isIncentivized', 'isRecommended', 'rejectedImageUrls', 'reply', 'replyDateCreated', 'replyIsPublic', 'title', 'videoUrls', 'isVerifiedBuyer', 'variantId', 'status'],
            opinew: ['body', 'rating', 'review_date', 'state', 'reviewer_name', 'reviewer_email', 'product_id', 'product_handle', 'reply', 'reply_date', 'picture_urls', 'SKU', 'barcode', 'region'],
            ryviu: ['product_handle', 'rating', 'author', 'title', 'body_text', 'email', 'photo_urls', 'created_at', 'status', 'featured'],
            yotpo: ['Product ID', 'Date', 'Review Title', 'Review Content', 'Review Score', 'Display Name', 'Email', 'Customer Country', 'Published Image URL', 'Published'],
            stamped: ['product_id', 'product_handle', 'productUrl', 'productImageUrl', 'photoFilenames', 'videoFilenames', 'productTitle', 'rating', 'title', 'author', 'email', 'body', 'created_at', 'published', 'reply', 'replied_at', 'publishedReply', 'tags', 'recommended', 'votes_up', 'votes_down', 'location', 'featured'],
            fera: ['Product ID', 'Customer ID', 'Heading', 'Body', 'Rating', 'Customer Name', 'Customer Location', 'Customer Avatar', 'Created At', 'Updated At', 'Store Reply', 'Store Replied At', 'Customer Media 1', 'Customer Media 2']
        };
        return [...headers[format]];
    }

    static rowFor(format, review, index, settings, diagnostics) {
        const base = this.baseReview(review, index);
        const maxPhotos = this.FORMAT_META[format].maxPhotos;
        const photos = this.compatiblePhotos(review, maxPhotos, diagnostics).join(',');
        const reviewerName = base.username || 'Anonymous';
        const sku = base.sku;

        if (format === 'judge_me') {
            return {
                title: this.makeLocalTitle(base.body, base.rating),
                body: base.body,
                rating: base.rating,
                review_date: this.dateDDMMYYYY(base.date),
                reviewer_name: reviewerName,
                reviewer_email: '',
                product_url: settings.productUrl,
                picture_urls: photos,
                product_id: settings.productId,
                product_handle: settings.productHandle,
                reply: '',
                reply_date: '',
                ip_address: '',
                curated: settings.publicationState === 'published' ? 'ok' : 'not-yet'
            };
        }

        if (format === 'loox') {
            return {
                product_handle: settings.productHandle,
                product_Id: settings.productId,
                rating: base.rating,
                author: reviewerName,
                email: '',
                body: base.body,
                created_at: this.dateYMD(base.date),
                photo_url: photos,
                reply: '',
                replied_at: '',
                verified_purchase: '',
                incentivized: ''
            };
        }

        if (format === 'okendo') {
            if (!(settings.productHandle || settings.productId || sku)) {
                throw new Error('Okendo requires a Shopify product handle, product ID, or the original SKU for every review.');
            }
            const published = settings.publicationState === 'published';
            return {
                name: reviewerName,
                body: base.body,
                handle: settings.productHandle,
                productId: settings.productId,
                rating: base.rating,
                sku,
                dateCreated: this.dateYMDTime(base.date),
                countryCode: '',
                email: '',
                imageUrls: photos,
                isApproved: published ? 'true' : 'false',
                isIncentivized: 'false',
                isRecommended: '',
                rejectedImageUrls: '',
                reply: '',
                replyDateCreated: '',
                replyIsPublic: 'false',
                title: this.makeLocalTitle(base.body, base.rating),
                videoUrls: '',
                isVerifiedBuyer: 'false',
                variantId: '',
                status: published ? 'approved' : 'pending'
            };
        }

        if (format === 'opinew') {
            if (!(settings.productHandle || settings.productId || sku)) {
                throw new Error('Opinew requires a Shopify product ID, product handle, or SKU for every review.');
            }
            return {
                body: base.body,
                rating: base.rating,
                review_date: `${this.dateYMDTime(base.date)} UTC`,
                state: settings.publicationState === 'published' ? 'published' : 'unpublished',
                reviewer_name: reviewerName,
                reviewer_email: '',
                product_id: settings.productId,
                product_handle: settings.productHandle,
                reply: '',
                reply_date: '',
                picture_urls: photos,
                SKU: sku,
                barcode: '',
                region: ''
            };
        }

        if (format === 'ryviu') {
            return {
                product_handle: settings.productHandle,
                rating: base.rating,
                author: reviewerName,
                title: this.makeLocalTitle(base.body, base.rating),
                body_text: base.body,
                email: '',
                photo_urls: photos,
                created_at: this.dateYMDMinute(base.date),
                status: settings.publicationState === 'published' ? 'enable' : 'disable',
                featured: '0'
            };
        }

        if (format === 'yotpo') {
            if (settings.yotpoScope === 'product' && !settings.productId) {
                throw new Error('Yotpo product reviews require a Shopify Product ID. Choose site reviews only if these reviews should not be attached to a product.');
            }
            if (!/^[a-z]{2}$/.test(settings.yotpoCountry)) {
                throw new Error('Yotpo requires a two-letter customer country code, such as us or ca.');
            }
            if (!settings.yotpoUseTechnicalEmail) {
                throw new Error('Yotpo requires an email column. Confirm the local technical placeholder option before exporting; ReviewPort never invents a real customer email.');
            }
            return {
                'Product ID': settings.yotpoScope === 'site' ? '' : settings.productId,
                Date: this.dateYMD(base.date),
                'Review Title': this.makeLocalTitle(base.body, base.rating),
                'Review Content': base.body,
                'Review Score': base.rating,
                'Display Name': reviewerName,
                Email: this.technicalEmail(index),
                'Customer Country': settings.yotpoCountry,
                'Published Image URL': photos,
                Published: settings.publicationState === 'published' ? 'TRUE' : 'FALSE'
            };
        }

        if (format === 'stamped') {
            if (!(settings.productId && settings.productUrl && settings.productImageUrl && settings.productTitle)) {
                throw new Error('Stamped requires a product ID, product URL, product image URL, and product title. Complete the advanced product mapping before exporting.');
            }
            if (!this.isHttpUrl(settings.productUrl) || !this.isHttpUrl(settings.productImageUrl)) {
                throw new Error('Stamped product URL and product image URL must both be valid HTTP(S) URLs.');
            }
            const published = settings.publicationState === 'published';
            return {
                product_id: settings.productId,
                product_handle: settings.productHandle,
                productUrl: settings.productUrl,
                productImageUrl: settings.productImageUrl,
                photoFilenames: photos,
                videoFilenames: '',
                productTitle: settings.productTitle,
                rating: base.rating,
                title: this.makeLocalTitle(base.body, base.rating),
                author: reviewerName,
                email: '',
                body: base.body,
                created_at: this.dateYMDTime(base.date),
                published: published ? 'TRUE' : 'FALSE',
                reply: '',
                replied_at: '',
                publishedReply: 'FALSE',
                tags: '',
                recommended: '',
                votes_up: '',
                votes_down: '',
                location: '',
                featured: 'FALSE'
            };
        }

        if (format === 'fera') {
            const media = photos.split(',');
            return {
                'Product ID': settings.productId,
                'Customer ID': '',
                Heading: this.makeLocalTitle(base.body, base.rating),
                Body: base.body,
                Rating: base.rating,
                'Customer Name': reviewerName,
                'Customer Location': '',
                'Customer Avatar': '',
                'Created At': base.date.toISOString(),
                'Updated At': '',
                'Store Reply': '',
                'Store Replied At': '',
                'Customer Media 1': media[0] || '',
                'Customer Media 2': media[1] || ''
            };
        }

        throw new Error(`Unsupported Shopify export format: ${format}.`);
    }

    static baseReview(review, index) {
        const body = String(review?.description || '').replace(/\s+/g, ' ').trim();
        const rating = parseInt(review?.rating, 10);
        if (!body) throw new Error(`Review ${index + 1} has no written review text. This target format requires a review body.`);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            throw new Error(`Review ${index + 1} has an invalid rating. Shopify review imports require an integer from 1 to 5.`);
        }
        const date = this.parseDate(review?.date);
        if (!date) throw new Error(`Review ${index + 1} has no valid review date. Re-scan or remove the row before exporting.`);
        return {
            body,
            rating,
            date,
            username: String(review?.username || '').trim(),
            sku: String(review?.sku || '').trim()
        };
    }

    static parseDate(value) {
        const input = String(value || '').trim();
        const match = input.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            const parsed = new Date(Date.UTC(year, month - 1, day));
            return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? parsed : null;
        }
        const parsed = new Date(input);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    static dateYMD(date) {
        return date.toISOString().slice(0, 10);
    }

    static dateDDMMYYYY(date) {
        const ymd = this.dateYMD(date).split('-');
        return `${ymd[2]}/${ymd[1]}/${ymd[0]}`;
    }

    static dateYMDTime(date) {
        return `${this.dateYMD(date)} 00:00:00`;
    }

    static dateYMDMinute(date) {
        return `${this.dateYMD(date)} 00:00`;
    }

    static makeLocalTitle(body, rating) {
        let title = String(body || '').split(/(?<=[.!?。！？])\s+/)[0] || String(body || '');
        title = title.replace(/[.。!！?？,，;；:：]+$/, '').trim();
        if (title.length > 60) {
            title = title.slice(0, 60);
            const lastSpace = title.lastIndexOf(' ');
            if (lastSpace > 20) title = title.slice(0, lastSpace);
        }
        return title || `${rating}-star review`;
    }

    static technicalEmail(index) {
        return `review-${index + 1}@reviewport.local`;
    }

    static compatiblePhotos(review, maxPhotos, diagnostics) {
        const photos = ReviewClassifier.photoUrls(review);
        diagnostics.totalImages += photos.length;
        const compatible = [];
        photos.forEach(value => {
            if (compatible.length >= maxPhotos || !this.isSupportedImageUrl(value)) {
                diagnostics.skippedImages += 1;
            } else {
                compatible.push(value);
            }
        });
        return compatible;
    }

    static isHttpUrl(value) {
        try {
            return ['http:', 'https:'].includes(new URL(String(value)).protocol);
        } catch (_) {
            return false;
        }
    }

    static isSupportedImageUrl(value) {
        try {
            const url = new URL(String(value));
            return this.isHttpUrl(value) && /\.(jpe?g|png)$/i.test(url.pathname);
        } catch (_) {
            return false;
        }
    }
}

class JudgeMeConverter {
    convertToJudgeMeFormat(reviews, settingsOrHandle = {}) {
        const settings = typeof settingsOrHandle === 'string' ? { productHandle: settingsOrHandle } : settingsOrHandle;
        return ShopifyReviewConverter.build('judge_me', reviews, settings).rows;
    }

    makeLocalTitle(review) {
        return ShopifyReviewConverter.makeLocalTitle(review?.description, parseInt(review?.rating, 10) || 5);
    }

    formatDate(dateString) {
        const date = ShopifyReviewConverter.parseDate(dateString);
        return date ? ShopifyReviewConverter.dateDDMMYYYY(date) : '';
    }
}

class CSVExporter {
    static EXPLORER_COLUMNS = Object.freeze([
        { key: 'username', label: 'Username', header: 'username' },
        { key: 'rating', label: 'Rating', header: 'rating' },
        { key: 'rating_category', label: 'Rating category', header: 'rating_category' },
        { key: 'review_type', label: 'Review type', header: 'review_type' },
        { key: 'has_photos', label: 'Has photos', header: 'has_photos' },
        { key: 'photo_count', label: 'Photo count', header: 'photo_count' },
        { key: 'photo_category', label: 'Photo category', header: 'photo_category' },
        { key: 'description', label: 'Review description', header: 'description' },
        { key: 'sku', label: 'SKU / variant', header: 'sku' },
        { key: 'date', label: 'Review date', header: 'date' },
        { key: 'review_id', label: 'Review ID', header: 'review_id' },
        { key: 'photos', label: 'Photo URLs (separate columns)', header: 'photo_url_1…' }
    ]);

    static DEFAULT_EXPLORER_COLUMNS = Object.freeze([
        'username', 'rating', 'rating_category', 'review_type',
        'has_photos', 'photo_count', 'photo_category',
        'description', 'sku', 'date', 'photos'
    ]);

    static SHOPIFY_FORMATS = Object.freeze({
        judge_me: 'Judge.me CSV',
        loox: 'Loox CSV',
        okendo: 'Okendo CSV',
        opinew: 'Opinew CSV',
        ryviu: 'Ryviu CSV',
        yotpo: 'Yotpo mapping CSV',
        stamped: 'Stamped CSV',
        fera: 'Fera sample mapping CSV'
    });

    static getExplorerColumnDefinitions() {
        return CSVExporter.EXPLORER_COLUMNS.map(column => ({ ...column }));
    }

    static normalizeExplorerColumns(columns) {
        const allowed = new Set(CSVExporter.EXPLORER_COLUMNS.map(column => column.key));
        const unique = [];
        (Array.isArray(columns) ? columns : []).forEach(key => {
            if (allowed.has(key) && !unique.includes(key)) unique.push(key);
        });
        return unique.length ? unique : [...CSVExporter.DEFAULT_EXPLORER_COLUMNS];
    }

    escapeCSVField(value) {
        let stringValue = String(value ?? '');
        // Prevent spreadsheet formula interpretation when a CSV is opened.
        if (/^[=+\-@]/.test(stringValue)) stringValue = `'${stringValue}`;
        if (/[",\n\r]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
        return stringValue;
    }

    exportToCSV(reviews, filename = 'reviewport_reviews.csv') {
        if (!Array.isArray(reviews) || !reviews.length) throw new Error('No reviews available to export.');
        const headers = ['username', 'rating', 'description', 'sku', 'date', 'photo_urls'];
        this.downloadCSV(this.toCsv(headers, reviews), filename);
    }

    buildExplorerExport(reviews, selectedColumns = CSVExporter.DEFAULT_EXPLORER_COLUMNS) {
        if (!Array.isArray(reviews) || !reviews.length) throw new Error('No reviews available to export.');

        const columns = CSVExporter.normalizeExplorerColumns(selectedColumns);
        const includePhotos = columns.includes('photos');
        const maxPhotoCount = includePhotos
            ? Math.max(0, ...reviews.map(review => ReviewClassifier.photoUrls(review).length))
            : 0;
        const photoHeaders = Array.from({ length: maxPhotoCount }, (_, index) => `photo_url_${index + 1}`);
        const headers = columns.flatMap(key => key === 'photos'
            ? photoHeaders
            : [CSVExporter.EXPLORER_COLUMNS.find(column => column.key === key).header]);
        if (!headers.length) {
            throw new Error('Selected Photo URLs, but these matching reviews do not contain photos. Select another column or include reviews with photos.');
        }

        const rows = reviews.map(review => {
            const metadata = ReviewClassifier.metadata(review);
            const values = {
                username: review.username || '',
                rating: parseInt(review.rating, 10) || '',
                rating_category: metadata.rating_category,
                review_type: metadata.review_type,
                has_photos: metadata.has_photos,
                photo_count: metadata.photo_count,
                photo_category: metadata.photo_category,
                description: review.description || '',
                sku: review.sku || '',
                date: review.date || '',
                review_id: review.review_id || ''
            };

            const row = {};
            columns.forEach(key => {
                if (key === 'photos') {
                    photoHeaders.forEach((header, index) => { row[header] = metadata.photos[index] || ''; });
                } else {
                    const header = CSVExporter.EXPLORER_COLUMNS.find(column => column.key === key).header;
                    row[header] = values[key];
                }
            });
            return row;
        });

        return { headers, rows, selectedColumns: columns };
    }

    exportToExplorerCSV(reviews, filename = 'reviewport_csv_explorer.csv', selectedColumns = CSVExporter.DEFAULT_EXPLORER_COLUMNS) {
        const { headers, rows } = this.buildExplorerExport(reviews, selectedColumns);
        this.downloadCSV(this.toCsv(headers, rows), filename);
    }

    exportToMarkdown(reviews, filename = 'reviewport_reviews.md', selectedColumns = CSVExporter.DEFAULT_EXPLORER_COLUMNS) {
        const { headers, rows, selectedColumns: columns } = this.buildExplorerExport(reviews, selectedColumns);
        const columnDefinitions = CSVExporter.EXPLORER_COLUMNS;
        const fieldLabels = columns.map(key => columnDefinitions.find(column => column.key === key)?.label || key);
        const timestamp = new Date().toISOString();
        const frontmatter = [
            '---',
            'source: ReviewPort local export',
            `exported_at: ${timestamp}`,
            `review_count: ${rows.length}`,
            `selected_fields: ${fieldLabels.join(', ')}`,
            '---',
            '',
            '# ReviewPort review dataset',
            '',
            '> This file contains locally saved TikTok Shop review data. It is structured for analysis by an LLM or another text tool. It does not contain an AI-generated summary.',
            ''
        ];

        const reviewSections = rows.map((row, index) => {
            const lines = [`## Review ${index + 1}`, ''];
            headers.forEach(header => {
                const value = String(row[header] ?? '').trim();
                if (!value) return;
                const label = header.replace(/_/g, ' ');
                if (header === 'description') {
                    lines.push(`### ${label}`, value, '');
                } else {
                    lines.push(`- ${label}: ${value}`);
                }
            });
            return lines.join('\n');
        });

        this.downloadText([...frontmatter, ...reviewSections].join('\n'), filename, 'text/markdown;charset=utf-8;');
    }

    buildShopifyExport(format, reviews, settings = {}) {
        return ShopifyReviewConverter.build(format, reviews, settings);
    }

    exportToShopifyCSV(format, reviews, filename, settings = {}) {
        const result = this.buildShopifyExport(format, reviews, settings);
        this.downloadCSV(this.toCsv(result.headers, result.rows), filename);
        return result.diagnostics;
    }

    exportToJudgeMeCSV(reviews, filename = 'judge_me_reviews.csv', settingsOrHandle = {}) {
        const settings = typeof settingsOrHandle === 'string' ? { productHandle: settingsOrHandle } : settingsOrHandle;
        return this.exportToShopifyCSV('judge_me', reviews, filename, settings);
    }

    exportToLooxCSV(reviews, filename = 'loox_reviews.csv', settings = {}) {
        return this.exportToShopifyCSV('loox', reviews, filename, settings);
    }

    exportToOkendoCSV(reviews, filename = 'okendo_reviews.csv', settings = {}) {
        return this.exportToShopifyCSV('okendo', reviews, filename, settings);
    }

    exportToOpinewCSV(reviews, filename = 'opinew_reviews.csv', settings = {}) {
        return this.exportToShopifyCSV('opinew', reviews, filename, settings);
    }

    exportToRyviuCSV(reviews, filename = 'ryviu_reviews.csv', settings = {}) {
        return this.exportToShopifyCSV('ryviu', reviews, filename, settings);
    }

    exportToYotpoCSV(reviews, filename = 'yotpo_reviews.csv', settings = {}) {
        return this.exportToShopifyCSV('yotpo', reviews, filename, settings);
    }

    exportToStampedCSV(reviews, filename = 'stamped_reviews.csv', settings = {}) {
        return this.exportToShopifyCSV('stamped', reviews, filename, settings);
    }

    exportToFeraCSV(reviews, filename = 'fera_reviews.csv', settings = {}) {
        return this.exportToShopifyCSV('fera', reviews, filename, settings);
    }

    toCsv(headers, rows) {
        return [headers.join(','), ...rows.map(row => headers.map(header => this.escapeCSVField(row[header])).join(','))].join('\n');
    }

    downloadCSV(csvContent, filename) {
        this.downloadText(`\uFEFF${csvContent}`, filename, 'text/csv;charset=utf-8;');
    }

    downloadText(content, filename, type = 'text/plain;charset=utf-8;') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReviewFilter, ReviewClassifier, ShopifyReviewConverter, CSVExporter, JudgeMeConverter };
}
