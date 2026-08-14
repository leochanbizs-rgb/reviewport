# ReviewPort Privacy Policy

**Effective date:** August 13, 2026

ReviewPort for TikTok Shop (“ReviewPort”, “the extension”) is an independent browser extension that helps a user inspect and export review data from a TikTok Shop product page they open. ReviewPort is **not affiliated with, endorsed by, or sponsored by TikTok, TikTok Shop, Google, Shopify, Judge.me, or any Shopify review-app provider**.

## Summary

ReviewPort processes review data locally in the user’s Chrome browser. It does not operate a ReviewPort cloud service, require an account, add analytics or advertising software, call an AI or translation service, or send review content to a developer server.

## What triggers access

ReviewPort acts only after the user starts a scan from a TikTok Shop product page. During that user-initiated scan, the extension reads review information embedded in the product page and observes TikTok Shop review-list responses that the page receives. The observer is restricted to review-list paths on TikTok-owned domains, is active only while the scan is running, ignores unrelated and oversized responses, and is removed when the scan completes, pauses, stops, or errors.

For a numerically confirmed exact-rating scan, ReviewPort may also read the currently visible, bounded filtered review cards when TikTok renders that first result page without a compatible observable review-list response. It does not use unfiltered data to fill an exact-rating scan.

## Information handled locally

Depending on the product page and the user’s scan settings, local processing can include the reviewer’s displayed username, rating, review text, Variant, country or verified-purchase signal where TikTok provides it, date, and buyer-photo URLs. ReviewPort also stores local scan state, export choices, and theme preferences in Chrome extension storage.

ReviewPort preserves the username as TikTok displays it, including a masked name. It does not generate a replacement name, fabricate importer data, or label a review as verified unless TikTok provides that signal.

## How local information is used

ReviewPort uses locally handled data only for the user-requested workflow: scanning the selected page, pausing or stopping a scan, displaying saved reviews in Review Studio, and producing the local CSV or Markdown file the user chooses. The extension does not publish reviews, post content, make purchases, modify product pages, contact reviewers, or send saved review content to a ReviewPort service.

A bug-report feature creates a user-reviewed `mailto:` draft addressed to `leochanbizs@gmail.com`. Review text, usernames, and photo URLs are excluded by default. Sending that email remains the user’s action.

## Storage and retention

Review data, scan state, export settings, and preferences are stored locally in `chrome.storage.local`. The user can clear saved review data from the extension. ReviewPort is designed to remove saved review data older than seven days through scheduled local cleanup. Exported files are created locally and remain under the user’s control.

## Data sharing and sale

ReviewPort does not transmit review content or local settings to a remote ReviewPort server. It does not sell, rent, share, or use the data for advertising, profiling, or analytics. A user may later choose to upload or import a local export into another service; that separate action is outside ReviewPort and is controlled by the user.

## Permissions

| Permission | Why ReviewPort needs it |
|---|---|
| `activeTab` | Works with the current TikTok Shop tab only after the user opens the extension. |
| `scripting` | Reconnects the content script to a product page loaded before the extension. |
| `storage` | Keeps local scan state, preferences, and collected reviews. |
| `alarms` | Schedules the local seven-day cleanup. |
| `https://shop.tiktok.com/*` | Restricts supported page access to TikTok Shop. |

The page-context interceptor is packaged with the extension. It is not remotely hosted code and ReviewPort does not execute remote code.

## Security and limitations

ReviewPort does not bypass TikTok verification. If TikTok requests verification or an exact rating cannot be numerically confirmed, ReviewPort pauses and retains already saved data. TikTok Shop can change its page structure, response paths, pagination, and access controls at any time.

## Changes and contact

If ReviewPort’s data practices change, this policy will be updated before the changed version is released. For privacy or setup questions, contact [leochanbizs@gmail.com](mailto:leochanbizs@gmail.com). For reproducible bugs, use [GitHub Issues](https://github.com/leochanbizs-rgb/reviewport/issues) and do not include personal orders, customer data, credentials, or private URLs.
