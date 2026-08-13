# ReviewPort Privacy Policy

**Effective date:** August 13, 2026

ReviewPort for TikTok Shop (“ReviewPort”, “the extension”, “we”, “us”) is an independent browser extension that lets a user organise review information already visible on a TikTok Shop product page they open. This policy explains what information the extension handles and how that information is used.

## Summary

ReviewPort processes review information locally in the user’s Chrome browser. It does not operate a remote ReviewPort server, does not require an account, does not use analytics or advertising software for review content, and does not send review content to an AI, translation, tracking, or other third-party service.

## Information handled by the extension

When a user explicitly starts a scan on a TikTok Shop product page, ReviewPort reads the review information made available on that page. Depending on the product page, this can include the reviewer’s displayed username, star rating, review text, selected product SKU, review date, and URLs of review photos.

The extension also stores local settings such as page limit and chosen export options. It keeps this information in Chrome extension storage on the user’s device.

## How information is used

ReviewPort uses review information only to provide the user-requested local workflow: scanning the page the user selected, pausing or stopping that scan, organising the saved review set in Review Studio, and creating the local export option the user chooses. ReviewPort does not publish reviews, post content, make purchases, modify product pages, contact reviewers, or send saved review content to a ReviewPort service.

Any export, spreadsheet import, or external AI handoff occurs only after the user chooses it outside ReviewPort. The user is responsible for deciding whether information is appropriate to share with another service.

## Storage and retention

Review data and preferences are stored locally in Chrome extension storage. The user can clear saved review data using the extension’s local controls. ReviewPort is designed to remove saved review data older than seven days through scheduled local cleanup.

## Data sharing and sale

ReviewPort does not transmit review content or local settings to a remote ReviewPort server. It does not sell, rent, share, or use review information for advertising, profiling, or analytics. Any file created through a local export is downloaded or saved by the user, who controls its later use, storage, editing, sharing, or import.

## Permissions

| Permission | What it lets ReviewPort do | Why it is needed |
|---|---|---|
| `activeTab` | Work with the TikTok Shop tab the user actively selects. | The extension must not access an unrelated tab. |
| `scripting` | Connect the local workflow to the selected page. | The user starts the review workflow from that page. |
| `storage` | Keep local scan state and settings. | Saved review data and preferences remain in the browser. |
| `alarms` | Schedule local cleanup. | Supports removal of saved records after the retention period. |
| TikTok Shop host access | Limit supported page access to `https://shop.tiktok.com/*`. | The extension is designed for TikTok Shop product pages. |

## Security

Because ReviewPort does not send review content to a ReviewPort server, the extension does not transmit review data as part of its local workflow. Users should still protect locally exported files and use them in accordance with applicable laws, platform terms, and the privacy rights of reviewers.

## Third-party services and affiliations

ReviewPort is not affiliated with, endorsed by, or sponsored by TikTok, TikTok Shop, Google, Shopify, Judge.me, or any Shopify review-app provider. These names are referenced only to describe supported pages or user-selected export formats.

## Changes to this policy

If ReviewPort’s data practices change, this policy will be updated before the changed version is released. The effective date above reflects the latest revision.

## Contact

For privacy or setup questions, contact [leochanbizs@gmail.com](mailto:leochanbizs@gmail.com). For reproducible bugs, use the public [GitHub Issues](https://github.com/leochanbizs-rgb/reviewport/issues) page and do not include personal orders, customer data, credentials, or private URLs.
