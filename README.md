# ReviewPort for TikTok Shop

ReviewPort is a **free, local-first Chrome extension** for scanning and organising reviews already visible on a TikTok Shop product page you open. It runs in your browser, requires no ReviewPort account, and does not operate a remote ReviewPort review service.

> ReviewPort is an independent tool. It is not affiliated with, endorsed by, or sponsored by TikTok, TikTok Shop, Google, Shopify, Judge.me, or any Shopify review-app provider.

## Current download

**Current version: v5.4.0**  
**Distribution: GitHub ZIP only. ReviewPort is not published in the Chrome Web Store.**

1. Download [ReviewPort v5.4.0 ZIP](https://github.com/leochanbizs-rgb/reviewport/raw/refs/heads/main/reviewport-v5.4.0.zip).
2. Unzip it to a folder you can keep.
3. Open `chrome://extensions` in Google Chrome.
4. Turn on **Developer mode**.
5. Select **Load unpacked**.
6. Choose the unzipped folder that contains `manifest.json`.
7. Pin ReviewPort from Chrome’s Extensions menu.
8. Open a TikTok Shop product page, open its review area, then select the ReviewPort toolbar icon.

To update, download the latest GitHub ZIP, unzip it, then select **Reload** on the ReviewPort card in `chrome://extensions` after selecting the new unzipped folder.

## What v5.4.0 does

| Capability | What it helps you do |
|---|---|
| Local review scan | Start a scan from the TikTok Shop product page you chose, with a page limit of up to 100 pages. |
| Pause and stop controls | Pause or stop the scan when your research task changes. |
| Five-point rating view | Read reviews through the extension’s five-point rating organisation. |
| Review Studio | Inspect the locally saved review set before deciding what to do next. |
| Local exports | Create local CSV or Markdown output, or select an available Shopify review-app export format where your own product mapping is complete. |
| Verification-safe workflow | Pause for a TikTok verification request; ReviewPort does not bypass verification. |

## Local processing and retention

ReviewPort acts only after you start a scan on a supported TikTok Shop product page. Review data and preferences are kept in Chrome extension storage on your device. You can clear saved results, and the extension is designed to clean up saved review data after seven days.

ReviewPort does not require an account, API key, ReviewPort cloud service, AI service, translation service, or remote review database. Any export, spreadsheet import, or external AI handoff is a separate action that you choose and control.

## Permissions

| Permission | Why ReviewPort needs it |
|---|---|
| `activeTab` | Work with the TikTok Shop tab you actively select. |
| `scripting` | Connect the local extension workflow to the active page. |
| `storage` | Keep local settings and saved scan records in your browser. |
| `alarms` | Run the scheduled local cleanup for saved records. |
| `https://shop.tiktok.com/*` | Limit the page workflow to supported TikTok Shop URLs. |

Read [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for the data boundary and [CHANGELOG.md](CHANGELOG.md) for confirmed version history.

## Support

For reproducible bugs, open a [GitHub Issue](https://github.com/leochanbizs-rgb/reviewport/issues) with the ReviewPort version, Chrome version, page type, steps, and visible error. Do not include personal orders, customer data, account credentials, or private URLs.

For setup questions, email [leochanbizs@gmail.com](mailto:leochanbizs@gmail.com).

## License

ReviewPort is available under the [MIT License](LICENSE).
