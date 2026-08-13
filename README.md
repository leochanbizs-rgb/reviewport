# ReviewPort for TikTok Shop

ReviewPort is a **free Chrome extension** for filtering, previewing, and exporting reviews from TikTok Shop product pages as CSV files. It works in Chrome and processes review data locally in your browser.

> ReviewPort is an independent tool. It is not affiliated with, endorsed by, or sponsored by TikTok, TikTok Shop, Judge.me, Google, or Shopify.

## Download and install

1. On GitHub, select **Code → Download ZIP**.
2. Unzip the downloaded folder somewhere you can keep it.
3. Open `chrome://extensions` in Google Chrome.
4. Turn on **Developer mode** in the top-right corner.
5. Select **Load unpacked**.
6. Choose the unzipped ReviewPort folder—the folder that contains `manifest.json`.
7. Pin ReviewPort from Chrome's Extensions menu.
8. Open a TikTok Shop product page, scroll to the reviews, then select the ReviewPort toolbar icon.

To update the extension, download the latest repository ZIP, unzip it, then return to `chrome://extensions` and select **Reload** on the ReviewPort card.

## What it does

| Capability | Description |
|---|---|
| Review scan | Reads reviews visible on the TikTok Shop product page you select and follows review pagination up to your chosen page limit. |
| Rating and photo filters | Lets you choose a rating range and optionally retain only reviews with photos. |
| Local full preview | Opens a local extension tab to inspect saved reviews, full review text, and buyer photos without re-scanning. |
| ReviewPort CSV | Creates an Excel/Google Sheets-ready file with separate columns for every photo URL. |
| Judge.me CSV | Creates a Judge.me-compatible CSV layout when you provide a Shopify product handle. |
| Verification-safe pause | Pauses when TikTok requests verification; you complete verification yourself before resuming. |

## Use ReviewPort

1. In the popup, select the lowest and highest star ratings you want.
2. Set **Pages to scan** and, if useful, turn on **Photos only**.
3. Select **Scan reviews**.
4. If TikTok presents a verification prompt, complete it yourself and then select **Resume after verification**.
5. Choose **Open full preview** to review saved results locally.
6. Select **Export CSV** when you are ready to save a file.

## Local processing and retention

ReviewPort does not require an account, API key, AI service, translation service, or remote ReviewPort server. It handles review information only after you start a scan. Review data and preferences remain in Chrome extension storage until you clear them or the extension removes saved data after seven days.

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for details.

## Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Works with the TikTok Shop product page you selected. |
| `scripting` | Reconnects to the active product page if it was loaded before ReviewPort. |
| `storage` | Keeps scan state, preferences, and collected reviews locally. |
| `alarms` | Runs the seven-day local cleanup. |
| `https://shop.tiktok.com/*` | Limits page access to TikTok Shop. |

## Limits and responsible use

TikTok Shop can change page structure, pagination, or access controls. ReviewPort does not bypass verification or alter TikTok Shop pages. Use it only with product pages and review data you are entitled to access, and follow applicable laws, platform terms, and reviewer privacy rights.

## Support

Open a GitHub Issue with the ReviewPort version, Chrome version, page type, and any console messages beginning with `[ReviewPort]`. Do not include personal orders, customer data, account credentials, or private URLs.

## Version

Current version: **4.5.0**
