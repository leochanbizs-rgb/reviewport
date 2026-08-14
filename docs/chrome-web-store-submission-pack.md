# ReviewPort Chrome Web Store Submission Pack — v5.6.1 Candidate

## Publication gate

**Do not submit or publish yet.** The v5.6.1 package passed 22 local regression tests and a controlled Review Studio fixture run, but TikTok’s supplied product page returned a Security Check before its review UI loaded. The required English and Chinese exact-1-star live checks remain **NOT RUN**. ReviewPort must never bypass that check.

## Package

| Item | Value |
|---|---|
| Candidate ZIP | `reviewport-v5.6.1-chrome-web-store.zip` |
| Manifest | `5.6.1` |
| SHA-256 | `0703263fb33fc1a69a95cb64530b2a845abfd62e031febbbfbe40056435c4e0e` |
| Package scope | Runtime files only; no `docs/` or `store-assets/` paths. |

## Store listing draft

**Name:** ReviewPort for TikTok Shop

**Short description (118 characters):** Collect TikTok Shop reviews locally, inspect them in Review Studio, and export CSV or Markdown files.

**Category:** Shopping

**Language:** English

**Detailed description:**

ReviewPort helps you collect review data from the TikTok Shop product page you open, inspect saved results locally in Review Studio, and export a local CSV or Markdown file.

Start a scan from a TikTok Shop product page, choose a rating range and the number of reviews to collect, then open Review Studio to read the saved review set. ReviewPort keeps TikTok-displayed masked usernames, numeric scores, review text, Variant, dates, and buyer-photo URLs when TikTok makes them available. Photos only is off by default.

For an exact one-to-five-star scan, ReviewPort operates TikTok’s visible rating control and requires a numeric confirmation: the visible matching-result count must match the selected rating’s visible histogram count. If the count cannot be confirmed, ReviewPort pauses instead of scanning all ratings. If TikTok shows a Security Check, complete it manually; ReviewPort does not bypass verification.

Export files locally as a Custom CSV, structured Markdown, or a supported Shopify review-app CSV layout. TikTok product specification is represented as **Variant**, not a Shopify SKU. Where a review app requires Shopify product mapping, you provide the product handle or Product ID.

Review data stays in Chrome local storage until you clear it or the local seven-day cleanup runs. ReviewPort does not require an account, use telemetry, call AI or translation services, transmit review content to a developer server, execute remote code, or fabricate usernames.

ReviewPort is an independent tool and is not affiliated with, endorsed by, or sponsored by TikTok, TikTok Shop, Google, Shopify, Judge.me, or any Shopify review-app provider.

## Privacy tab draft

**Single purpose:** ReviewPort lets a user collect review content from the TikTok Shop product page they open, inspect it locally, and export it as a user-selected local CSV or Markdown file.

**User data declaration:** Select **Website content** and **Personally identifiable information** because user-initiated scans process review content and TikTok-displayed reviewer usernames locally. Do not select financial information, health information, authentication information, location, web history, personal communications, or payment information.

**Use of data:** Select only the option that data is used to provide the extension’s disclosed user-facing review collection, inspection, and export feature. Select **No** for sale, transfer to third parties, personalised advertising, creditworthiness, remote analytics, and developer access to review content.

**Privacy policy URL:** **NEEDS_INPUT.** Do not enter an invented URL. Publish `PRIVACY_POLICY.md` at a stable public HTTPS address first, preferably GitHub Pages, then enter that exact URL.

## Permission justifications

| Permission / access | Justification |
|---|---|
| `activeTab` | Restricts ReviewPort to the TikTok Shop tab the user actively opens for a scan. |
| `scripting` | Reconnects the packaged content script if the product page was loaded before ReviewPort. |
| `storage` | Stores scan state, preferences, and collected reviews locally in Chrome for Review Studio and local export. |
| `alarms` | Runs the local seven-day cleanup for saved review data. |
| `https://shop.tiktok.com/*` | Limits the product-page workflow and bounded review-list observation to TikTok Shop. |

**Packaged-code declaration:** `js/interceptor.js` is packaged inside the extension and injected into the page context only for TikTok Shop review-list observation during a user-started scan. It is not remotely hosted, no remote code is downloaded or executed, and it is removed/restored when a scan ends, pauses, stops, or errors.

## Required visual assets

The 128×128 store icon and 440×280 small promo tile exist in `store-assets/`. The Developer Dashboard requires at least one 1280×800 screenshot; up to five may be supplied. [1] The currently available 1280×800 Review Studio capture is a controlled local fixture using existing regression-test data and must be labelled or replaced with real product-state captures before upload. Do not upload a screenshot claimed to be a live TikTok scan unless it was actually captured from one.

## NEEDS_INPUT and live gates

| Item | Why it is needed |
|---|---|
| `CWS_DEVELOPER_ACCOUNT` | Confirm the developer account is registered and ready to upload. |
| `CWS_PUBLISHER_EMAIL` | The dedicated account email receiving review and policy notices. |
| `PRIVACY_POLICY_URL` | A stable public HTTPS URL for the policy. |
| `TRADER_STATUS` | Trader/business or non-trader/individual declaration for EU DSA fields. |
| Live English exact-1-star check | Must confirm displayed count equals the 1-star histogram and output contains only 1-star reviews. |
| Live Chinese exact-1-star check | Same proof in Chinese TikTok UI. |
| Screenshots | Capture popup, in-progress scan, Review Studio with reviews, and Export Center after the live gate clears. |

## References

[1] [Chrome Web Store: Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)

[2] [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)

[3] [Chrome Web Store User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
