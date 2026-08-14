# ReviewPort v4.9.0 Visual QA Notes

## Desktop report page

Verified on 2026-08-13 through the temporary static preview of `review-explorer.html`.

| Area | Result | Notes |
|---|---|---|
| Header | Pass | Review Signal Port icon, local-only indicator, Refresh, and primary Export actions render cleanly. |
| Information hierarchy | Pass | Local review context is followed by exactly three KPI cards: Saved reviews, With photos, and Needs attention. |
| Table-first layout | Pass | The review table appears before the Export & Analyze section. |
| Export disclosure | Pass | The `details`-based Export drawer is visually present but initially closed. |
| Empty state | Pass | With no Chrome storage data in the static preview, the table gives a clear non-error empty state. |
| Visual system | Pass | Harbor Signal deep navy/electric blue styling, restrained shadows, borders, and spacing are readable at desktop width. |

The temporary preview cannot exercise `chrome.storage` because it is not running as an installed extension. Functional behavior was covered separately by Node regression tests.

## Export drawer interaction

The primary **Export** action in the fixed header was clicked in the live preview. It opened `#exportDrawer` and exposed the custom CSV controls, Shopify product-handle field, disabled-until-data export actions, local-only Markdown explanation, and the collapsed bug-report section. This verifies the intended progressive-disclosure path from report review to export configuration.

## Chrome Web Store promo asset — correction required

The legacy promo image was visually inconsistent with the new icon and was replaced with a Harbor Signal layout. Initial inspection of the replacement identified that the generated icon carried a visible checkerboard-style background into the static promo composition. The icon needs a deterministic alpha cleanup before the promo image and icon-size derivatives can be accepted for release.

## Chrome Web Store promo asset — final

After deterministic alpha cleanup and a chip-label rendering correction, the final `chrome-web-store-promo-440x280.png` was visually rechecked. The Review Signal Port icon has no checkerboard background, and the Custom CSV, LLM Markdown, and Judge.me CSV labels are legible. The asset now aligns with the Harbor Signal palette and is suitable for the release package.

## Chrome toolbar icon

The final 48px `icon-48.png` was checked after alpha cleanup. Its star, review-card body, and export-arrow signal remain recognizable at toolbar scale, with transparent corners and no residual checkerboard background.

## Toolbar icon scale update

The Review Signal Port source was re-framed from its alpha bounding box with only 5.5% safety padding before regenerating all Chrome icon sizes. The final 16px asset occupies materially more of its canvas than the prior release while preserving transparent corners and a distinct white star / blue export signal.

## v4.9.1 workspace colour and theme QA

The revised light workspace was rendered in the browser. It now uses a blue-grey canvas, concise KPI cards with blue/teal/warm alert accents, a blue-tinted review panel header, stronger key numbers, and a compact export summary; the visible hierarchy is materially less white and more legible than v4.9.0.

The header theme control was then switched to dark mode. The label changed from `Dark` to `Light`, the control title changed to offer the reverse action, and the report rendered with a dark navy canvas, readable bright text, blue/teal/warm KPI accents, and maintained table/export contrast. This confirms the visual theme behaviour in a browser preview.

## v4.9.1 export settings QA

With the Export drawer open in dark mode, the page keeps only a compact local-export notice, CSV columns, Judge.me product match, three export actions, and the bug-report entry. The Judge.me product match control remains closed by default and is visibly labelled `Only for Judge.me CSV`, keeping non-Judge.me users out of unnecessary settings while making the relevant destination clear.

The `Judge.me product match` section was expanded in the browser. It shows the product-handle input plus a concise URL-based example: `yourstore.com/products/electric-bbq` maps to `electric-bbq`, and it explicitly states that the default can be left unchanged when Judge.me is not used. The explanation is readable in dark mode.

## v4.9.2 default dark mode QA

The report page was loaded through a fresh query URL with no saved browser preference available to the preview. It rendered immediately with the dark navy workspace, and the header control displayed `Light` with the hint `Switch to light mode`. This verifies that dark is now the default while a previously selected light preference can still be restored from local extension storage.

## Shopify multi-format export workspace QA

The v5 preview opened in the default dark workspace with the report table still visually primary. The Export drawer remained closed until the header action was selected. Once opened, the new `Shopify review app export` section appeared as a separate, still-collapsed settings item beside the existing custom CSV controls; its first visible badge identified the default Judge.me format. This preserves the two-stage scan → inspect → export workflow without forcing non-export readers through merchant settings.

The expanded Shopify settings panel rendered in dark mode with a single visible format selector listing Judge.me, Loox, Okendo, Opinew, Ryviu, Yotpo, Stamped, and Fera sample mapping. The default status is visibly `Keep pending / unpublished`; product handle and product ID are concise primary fields; Stamped and Yotpo requirements remain separately collapsed. The explanatory product-handle URL example is visible without overwhelming the drawer.

## v5.0.0 deep/light contrast inspection

The expanded Shopify settings surface was inspected in dark mode: primary text is light against navy panels, form fields use dark fill with light text, and status/action controls retain visible borders. No light text was observed on a white card.

The same surface was switched to light mode and inspected from the report summary through the Export drawer. Light mode uses dark navy/grey text on blue-grey or white surfaces; format labels, input labels, explanatory copy, badges, validation message, and the three export buttons remain visually distinct. No white or pale text was observed on a white background in the inspected desktop states.

## Getting-started guide QA

The new standalone guide rendered with a concise Scan → Review → Export progression in the default dark theme. Its hero, three step cards, manual-verification note, Shopify-import note, and report action were visible without crowding the page. After the Light toggle, the same sections used navy/dark text on pale or white surfaces; no light-text-on-white issue appeared. Both themes retained clear colored step markers and high-contrast primary actions.

## Contrast and icon remediation QA

After the readability update, the dark Getting started page shows substantially brighter body text and micro-notes on the step cards. The prior blank Scan, Review, and Export symbol blocks now render recognizable high-contrast SVG monitor, report, and download icons. The colored safety and Shopify note icon containers likewise use visible SVG strokes. This directly resolves the blank-icon issue observed in the supplied screenshot.

## Near-black dark theme and simplified Shopify export QA

The Getting started page now renders on a near-black canvas with charcoal cards and only small blue, teal, and rose accents for step identity and actions. The Full Review Report also uses black/charcoal background and layered surfaces instead of the previous large deep-blue fields. In the opened Export drawer, the general Custom CSV and Markdown downloads now appear in a separate Quick download card before the distinct Shopify review-app section, reducing the choice overload visible in the previous single-panel layout.

The expanded Shopify section was checked in the near-black report. It presents a clear three-step rail (Choose app, Match product, Download CSV), then places the app selector, required product guidance, optional advanced details, and final CSV download in separate visual groups. This removes the prior ambiguity where format, product fields, publish status, and actions competed in one flat panel.

## Dual review/export workspace QA

At desktop width, the report displays the review table in the main left work area and the collapsed Export panel in a fixed right work area on the same screen. Selecting the header Export action opens the right panel in place; it does not scroll the report away from the review list. The opened panel constrains its own content area, so Custom CSV, Markdown, Shopify app export, and bug-report controls remain accessible through the panel rather than requiring page-bottom navigation.

## Review Studio visual QA

The new `review-studio.html` renders a single full-width review list rather than a permanent three-column layout. Summary cards use short labels and explicitly state that low ratings mean `1–2 out of 5`. The Export Center is not visible until the user selects **Export files**; it then opens as a focused right-side overlay, preserving the table width underneath. The visible export language is shortened to **CSV spreadsheet**, **Markdown for AI**, **N columns**, and **Judge.me import**.

The first Review Studio light-mode inspection exposed a theme-token mismatch: the page canvas became light while Studio cards stayed charcoal. The Studio token definitions were corrected so light mode uses white and pale-grey surfaces while dark mode retains the near-black palette. A fresh page load defaults to dark when no local Chrome preference is available; the light mode is rechecked after an explicit toggle in the next verification step.

After the token correction, Review Studio light mode renders white cards on a pale-grey canvas with dark text. The Export Center also uses a white surface, dark labels, and a visible dark `N columns` badge. Both the base report and opened Export Center now remain readable in light mode; no dark-surface carryover was observed.

## v5.5.0 audit hardening visual check — Review Studio

- 在重新啟動的靜態預覽中，以桌面寬度檢視 `review-studio.html` 的近黑主題。頁首操作、Local 狀態、Guide／Light／Refresh／Export files 按鈕、Saved reviews 摘要與全寬評論表均可見且文字與背景分層清楚。
- 無資料狀態顯示「Total reviews / With buyer photos / Low ratings」三個摘要卡及「rated 1–2 out of 5」明確數字化 rating 說明；此狀態沒有出現淺色文字搭近似背景或匯出面板常駐擠壓表格的問題。
- 在此靜態預覽沒有 Chrome extension storage，因此不含真實已保存評論、可選取列、詳情 overlay 或 exporter 執行資料；這些部分已由對應的結構／單元回歸測試覆蓋，並將於發布前完整回歸再次驗證。

- 開啟 Export files 後，Export Center 以固定右側 overlay 呈現；左側主表格仍保留其可讀寬度。匯出內容依序分為 local-only 說明、CSV columns、一般下載、Shopify import file 及 Report a bug，沒有將商品匹配或長說明常駐於主頁。
- 空資料狀態中 CSV spreadsheet 與 Markdown for AI 按鈕按設計保持 disabled；Export Center 清楚顯示 `0 reviews ready`，不會讓使用者誤以為已輸出資料。

- 在淺色模式下開啟 Export Center 時，右側面板使用白色／淺灰 surface 與深色文字；主要頁面以 overlay 降低對比作為 modal focus，而 Export Center 的 title、local-only 说明、CSV columns、一般下載、Shopify import file 與 bug-report 仍清晰可讀。主題切換按鈕同步改為 `Dark`，表示下一次操作會回到近黑模式。

## v5.6 review-target and Variant visual verification

- Popup visual inspection at the sandbox preview confirmed the primary control is **Reviews to collect**, with the old user-facing page limit removed. The exact-rating tooltip, target tooltip, Photos only tooltip, and Pause/Stop controls remain visible and readable on the popup's light surface.
- Review Studio visual inspection confirmed the near-black default theme, high-contrast header controls, numeric score column, and user-facing **Variant** table header. The empty-state table and scan-context message remain legible without saved data.
- These static extension-page checks do not replace the final real-PDP scan verification after the user reloads the v5.6 extension package.
