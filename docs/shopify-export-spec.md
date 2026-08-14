# ReviewPort Shopify 多格式匯出：實作規格

## 資料原則

1. 僅以本機已保存的 TikTok 評論資料生成檔案；不呼叫外部服務。
2. `username` 永遠保留 TikTok 原始顯示值（包含遮罩），不生成真人姓名。
3. 不偽造缺少的 Shopify 資料。需要的 product handle、產品 ID、URL、圖片 URL、產品名稱、國別等由使用者輸入或保留空白。
4. 只在 Yotpo 需要的情況下，且使用者明確勾選後，才建立唯一的 `@reviewport.local` 技術 placeholder；它不是真實 email，也不作驗證聲明。
5. 僅匯出公開 `http`／`https` 的 JPG、JPEG、PNG 圖片 URL 至 Shopify 評論 App 格式；略過 WebP／未知格式／不安全 URL，並回報略過數量。ReviewPort Custom CSV 不受此限制。
6. 新的 Shopify App 匯出預設為未發布／待審核；使用者明確選擇後才轉為 published／approved／enable。

## 共用設定

```text
productHandle, productId, productUrl, productImageUrl, productTitle,
publicationState (pending|published),
yotpoScope (product|site), yotpoCountry, yotpoUseTechnicalEmail
```

## 格式

| Format | Headers | 必須由 UI 驗證的設定 |
|---|---|---|
| Judge.me | title, body, rating, review_date, reviewer_name, reviewer_email, product_url, picture_urls, product_id, product_handle, reply, reply_date, ip_address, curated | 產品欄位可留空為 store review；body 必須存在；日期 dd/mm/yyyy；最多 5 圖；pending => `not-yet` |
| Loox | product_handle, product_Id, rating, author, email, body, created_at, photo_url, reply, replied_at, verified_purchase, incentivized | product handle；日期 YYYY-MM-DD；最多 5 圖 |
| Okendo | name, body, handle, productId, rating, sku, dateCreated, countryCode, email, imageUrls, isApproved, isIncentivized, isRecommended, rejectedImageUrls, reply, replyDateCreated, replyIsPublic, title, videoUrls, isVerifiedBuyer, variantId, status | 每列至少 handle/productId/SKU；日期 YYYY-MM-DD HH:mm:ss |
| Opinew | body, rating, review_date, state, reviewer_name, reviewer_email, product_id, product_handle, reply, reply_date, picture_urls, SKU, barcode, region | 每列至少 product ID/handle/SKU；日期 YYYY-MM-DD HH:mm:ss UTC |
| Ryviu | product_handle, rating, author, title, body_text, email, photo_urls, created_at, status, featured | product handle；日期 YYYY-MM-DD HH:mm；`disable` 預設 |
| Yotpo mapping CSV | Product ID, Date, Review Title, Review Content, Review Score, Display Name, Email, Customer Country, Published Image URL, Published | product scope 時 product ID；country；技術 placeholder 明確勾選；日期 YYYY-MM-DD |
| Stamped | product_id, product_handle, productUrl, productImageUrl, photoFilenames, videoFilenames, productTitle, rating, title, author, email, body, created_at, published, reply, replied_at, publishedReply, tags, recommended, votes_up, votes_down, location, featured | product ID、URL、主圖 URL、產品名稱；日期 YYYY-MM-DD HH:mm:ss；最多 3 圖 |
| Fera sample mapping | Product ID, Customer ID, Heading, Body, Rating, Customer Name, Customer Location, Customer Avatar, Created At, Updated At, Store Reply, Store Replied At, Customer Media 1, Customer Media 2 | product ID 選填（空白為 store review）；最多 2 個官方 sample media 欄位 |

## UI

Export drawer 保持收合。開啟後以一個 Review App format 選單與單一「Export Shopify CSV」按鈕選擇八種格式；所有商品與發布設定在收合的 Shopify import settings 內。格式說明會在選單變動時更新。

## 測試

1. 每種 exporter 測試 header 順序、必填欄位、日期格式、圖片上限、逗號分隔、待審核預設與公式注入保護。
2. 驗證不會生成姓名或未經確認的 email。
3. 驗證 Loox/Ryviu 缺 product handle、Stamped 缺商品資料、Yotpo 未確認 placeholder 時會阻擋匯出。
4. 迴歸驗證既有 ReviewPort CSV、Markdown、掃描、原生星等篩選、安全暫停與報告頁功能。
