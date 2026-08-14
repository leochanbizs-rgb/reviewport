# TikTok Shop 評論頁實際結構觀察

**來源 URL：** https://shop.tiktok.com/us/pdp/indoor-electric-grill-aoran-kitchen-1000w-non-stick-bbq-with-5-temp-settings/1730975501023219782  
**環境：** 使用者已登入的 My Browser，2026-08-13。

## 公開可見結構

頁面以繁體／簡體中文顯示評論區。可見文案包含「排序方式」、「篩選條件」、「全部」、「包括視覺素材」、「已驗證購買」、「顯示 5598 則評論 (總計 5598 則)」與「重設篩選條件」。評論分布在公開頁面中顯示為 5 星 4081、4 星 416、3 星 246、2 星 153、1 星 702。

每張可見評論卡片在可讀內容中呈現遮罩 username、已驗證購買標記、地區、正文、`商品:` 後的 SKU／variant 和 `YYYY-MM-DD` 日期；公開 DOM 內容同時顯示「上一個」、「1」、「2」至「1866」、「下一個」的分頁資訊。這支持以**已確認的原生星等篩選**為前提，對可見首批評論進行安全解析，但不可把未確認的 SSR 全部評論誤當成單星資料。

## 單星問題診斷意義

使用者截圖顯示 TikTok 原生篩選控制可呈現 `★ 1`，而 extension 過去可能只接受裸數字，造成已選取篩選仍被視為未確認。當前頁面在重新導覽後顯示預設「全部」；因此未在本次觀察中透過瀏覽器點選改變篩選，避免干擾使用者現有操作。首批資料的可靠策略應是：只有 `getNativeRatingSelection()` 已明確認定所選星等，且可見評論卡片的 rating 也符合該星等時，才把該批卡片加入 review store；後續頁仍由受限 first-party review-list response 處理。

## 限制

瀏覽器可讀文字和可視標註未提供穩定的 card `data-*` review ID 或完整 React props。實作必須使用受限的 review-area container、可見卡片、時間／SKU／rating 規則和內容 hash 生成只限本機的 fallback fingerprint；不得擴大為任意全頁文字掃描或將資料外傳。
