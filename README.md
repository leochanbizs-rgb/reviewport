# ReviewPort for TikTok Shop

**ReviewPort** is a Manifest V3 Chrome extension that helps a user collect review data from a TikTok Shop product page they open, inspect it locally, and export it to CSV or Markdown. It is an independent tool and is **not affiliated with, endorsed by, or sponsored by TikTok, TikTok Shop, Google, Shopify, Judge.me, or any Shopify review-app provider**.

> Review data is processed in the browser. ReviewPort does not call an AI service, transmit review content to a developer server, generate replacement usernames, translate reviews, or bypass TikTok verification.

## Current download

The current release is **v5.6.1**. Download [`reviewport-v5.6.1.zip`](https://github.com/leochanbizs-rgb/reviewport/releases/download/v5.6.1/reviewport-v5.6.1.zip) from the [GitHub Releases page](https://github.com/leochanbizs-rgb/reviewport/releases/tag/v5.6.1), not from a raw branch link. Its SHA-256 is `d0b6c329977c5a4c81a877ec9dfe56aca8b8722cf625339f6f8fbde58d2b3509`.

## How it works

When the user starts a scan on a TikTok Shop product page, ReviewPort processes embedded review information and observes bounded TikTok Shop review-list responses **only during that scan**. The observer is limited to review-list paths on TikTok-owned domains, ignores oversized or unrelated responses, and is removed when the scan completes, pauses, stops, or errors. Review data remains in `chrome.storage.local` until the user exports, clears it, or the local seven-day cleanup removes it.

For an exact rating scan, ReviewPort first operates TikTok's visible native rating control. It only starts collecting after the visible matching-result count numerically matches the selected rating's visible histogram count. If that contract cannot be confirmed, it pauses rather than scanning all ratings. If TikTok renders a numerically confirmed first page without a compatible observable response, ReviewPort can read only the currently visible, bounded filtered review cards; it never fills an exact-rating scan from unfiltered SSR data.

| Workflow | What the user does | What ReviewPort does locally |
|---|---|---|
| Scan | Sets a rating range and a **Reviews to collect** target | Derives an internal page budget from TikTok's visible matching count, capped at 100 pages. |
| Review | Opens Review Studio after a completed or stopped scan | Shows the saved sample, a numeric `N / 5` score, Variant, full review text, and buyer photos. |
| Export | Opens Export files only when ready | Produces a Custom CSV, Markdown, or validated Shopify review-app CSV locally. |

## Install locally

1. Download and unzip the release asset from GitHub Releases.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Select **Load unpacked**.
4. For a GitHub **release ZIP**, choose the unzipped folder that directly contains `manifest.json`. For a source checkout or a GitHub source archive, choose its **`extension/`** folder.
5. Open a TikTok Shop product page, scroll to reviews, and select the ReviewPort toolbar icon.

To update an existing unpacked installation, replace the unzipped release folder and choose **Reload** in `chrome://extensions`.

## Key safeguards

| Safeguard | Behavior |
|---|---|
| Exact-rating scans | Fail closed if TikTok's visible count contract is not confirmed; never falls back to all ratings. |
| Verification | Pauses safely for the user to complete any TikTok verification manually; it never bypasses verification. |
| Usernames | Preserves TikTok-displayed masked usernames such as `X**e`; never fabricates names. |
| Photos | Photos only is off by default. Buyer images remain third-party URLs and can expire; strict Shopify formats accept only supported public URLs. |
| Shopify product matching | TikTok product specification is stored as **Variant**, never treated as a Shopify SKU. Where required, the merchant supplies a Shopify product handle or Product ID. |
| Review data | Retained locally only. The bug-report tool creates a user-reviewed `mailto:` draft and excludes review content, usernames, and photos by default. |

## Permissions

| Permission | Purpose |
|---|---|
| `activeTab` | Works with the current TikTok Shop tab only after the user opens the extension. |
| `scripting` | Reconnects the content script to a product page loaded before ReviewPort. |
| `storage` | Keeps local scan state, preferences, and reviews. |
| `alarms` | Schedules the local seven-day cleanup. |
| `https://shop.tiktok.com/*` | Restricts page access to TikTok Shop. |

`js/interceptor.js` is a packaged extension script injected into the page context. It is not remotely hosted code and ReviewPort does not execute remote code.

## Limitations

The interface is currently English-only. TikTok Shop can change its DOM, review-list response path, pagination, or access controls at any time. The extension keeps an internal 100-page safety limit; TikTok commonly renders only a small number of reviews per page, so a large product's scan can still be a sample rather than its full review history. ReviewPort does not bypass verification and should only be used with pages and review data the user is entitled to access.

## Repository layout

```text
extension/    Manifest V3 runtime source; package this folder's contents only
docs/         Technical specs, page observations, QA notes, and release evidence
store-assets/ Chrome Web Store artwork; never include it in the extension ZIP
```

## Privacy and support

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for the full local-processing policy. For help, use the bug-report draft in Review Studio; it is addressed to `leochanbizs@gmail.com` and is only sent after the user reviews and confirms it.

## License

[MIT](LICENSE)
