# Changelog

All notable public changes to ReviewPort are recorded here. Versions refer to the manifest version and the corresponding GitHub Release asset.

## v5.6.1 — Release asset alignment

This release packages the current Manifest V3 source as `reviewport-v5.6.1.zip`, so the downloadable asset matches the `5.6.1` manifest version. It also corrects the Review Studio export-format hint element identifier used by the current page markup.

## v5.6.0 — Numeric exact-rating scan and repository release

The scan popup now asks for a **Reviews to collect** target instead of a user-entered page count. ReviewPort derives an internal page budget from TikTok’s visible matching-review count and retains a 100-page safety ceiling.

Exact one-to-five-star scans now require a numeric confirmation: TikTok’s visible matching-result count must equal the selected rating’s visible histogram count before collection begins. This fixes cases where a selected star glyph such as `★ 1` appeared active but scanning could remain at zero or risk mixing ratings. If TikTok renders a numerically confirmed first page without a compatible observable review-list response, ReviewPort reads only the bounded visible filtered cards; it never substitutes unfiltered data.

TikTok product specification is now presented as **Variant** and is no longer treated as a Shopify SKU. Shopify formats requiring product matching require a merchant-supplied handle or Product ID. Country and verified-purchase values are retained only when TikTok provides them. Buyer-photo URL limitations are disclosed before strict Shopify exports.

The public data-flow wording now accurately describes user-initiated local processing of embedded page data and bounded TikTok Shop review-list responses during a scan. The observer is active only during a scan and is restored afterward. No review data is sent to a developer server.

## v5.5.0 — Safety, accessibility, and local-state hardening

ReviewPort introduced the low-density Review Studio with numeric `N / 5` scores, an on-demand Export Center, and near-black/light themes with high-contrast surfaces. The popup gained Pause and Stop controls; saved reviews remain available after stopping.

The implementation added bounded review-list interception, response-size limits, hook restoration, selector diagnostics, UTC date handling, photo URL arrays, storage debounce with terminal flushes, complete local clearing, keyboard-accessible review details, and theme bootstrap support. The change addressed user-visible cases where scans could pause confusingly or display unclear labels.

## v5.4.0 — Review Studio and scan controls

Review Studio became the default local report page. It presents saved reviews in a full-width table, uses an unambiguous numeric five-point score, and keeps export settings hidden until requested. The popup added Pause and Stop controls and retained a 100-page internal safety ceiling.

## v4.5.0

This historical version is preserved as a GitHub Release asset for users who require the prior package. It is not stored as a tracked ZIP in the repository.
