# ReviewPort：Shopify 評論應用程式 CSV 匯入格式研究與實作規格建議

**研究日期：2026-08-13**  
**範圍：** Shopify App Store 上具代表性的評論應用程式，以及其公開的官方 CSV 匯入／遷移文件。  
**結論狀態：** 本文件是**研究與規格確認稿**。除已完成的 ReviewPort v4.9.2 預設深色模式外，本文列出的新 App 匯出格式尚未寫入擴充功能。

## 執行摘要

ReviewPort 現有資料可可靠提供評論者顯示名稱、星等、內文、SKU／變體、評論日期、評論 ID 與多張公開圖片 URL。因此，**Loox、Okendo、Opinew 及 Ryviu**最適合作為第一批新增的「官方模板直接匯出」格式：它們的核心必填欄位大多能由現有資料對應，或只需使用者補上 Shopify 商品 handle／產品匹配資訊。尤其 Okendo 接受 SKU 作為三種商品比對方法之一，與 ReviewPort 目前資料模型最相容。[1] [2] [3] [4]

Yotpo 與 Stamped 也有完整官方匯入格式，但要求更多商品目錄欄位或評論者資料。Yotpo 的產品評論需產品 ID，且日期、評論內文、星等、電子郵件及國別為必填；Stamped 則要求產品 ID、產品 URL、產品主圖 URL、產品標題等資料。因此兩者適合列為第二批「進階匯出」，前提是 ReviewPort 先建立一個明確的商品設定與使用者補填工作區。[5] [6]

> **重要限制：** 多個目標應用程式只接受 JPG／JPEG／PNG 公開圖片 URL；TikTok 來源圖片可能是 WebP 或含有暫時性 CDN 參數。ReviewPort 不應把不相容的 URL 偽裝為可匯入圖片。第一版應在匯出前驗證副檔名、顯示警示，並保留原始 URL；若目標 App 不接受，使用者須改用其可公開存取且相容的圖片 URL。Loox 與 Judge.me 都明確列出圖片格式限制。[2] [7]

| 建議層級 | 格式 | 主要原因 | 是否可直接開始實作 |
|---|---|---|---|
| **第一批** | Loox | 嚴格模板、核心資料直接對應、圖片與日期規則清楚 | 是；需 product handle 欄位 |
| **第一批** | Okendo | 可使用既有 SKU 商品匹配；官方模板和日期／圖片規則清楚 | 是；需商品匹配策略 UI |
| **第一批** | Opinew | 現有 SKU 可符合「至少一種商品識別」；固定欄位順序公開 | 是；需 `state=published` 選項與日期格式化 |
| **第一批** | Ryviu | 核心欄位少，且官方直接支援 Loox、Judge.me 來源格式 | 是；需 product handle 欄位 |
| **第二批** | Yotpo | 欄位可對應，但產品 ID、Email、Country 是產品評論必填資料 | 是，但需要明確資料補填／確認步驟 |
| **第二批** | Stamped | 模板完整但要求產品 URL、產品圖片 URL、產品標題與 ID | 是，但需要商品資料設定面板 |
| **維持並修正** | Judge.me | 已有匯出；官方文件確認較精確的日期與圖片限制 | 應先修正日期格式與圖片驗證 |
| **延後** | Fera | 官方採彈性欄位匹配，公開文章未完整列出 template schema | 先做 mapping assistant，不應聲稱 fixed direct-template export |

## 1. ReviewPort 現有資料與共通映射能力

ReviewPort 目前可用的來源欄位為：`username`、`rating`、`description`、`sku`、`date`、`review_id` 與多張 `photo_urls`。在不連接外部服務的前提下，另可建立本機短標題，或在使用者明確確認後建立唯一、不會投遞的 `@reviewport.local` 技術 placeholder。

| ReviewPort 原始資料 | 可安全映射的常見目標欄位 | 注意事項 |
|---|---|---|
| `username` | `author`、`name`、`reviewer_name`、`Display Name` | 必須保留 TikTok 顯示的遮罩名稱；**不可補造真人姓名**。 |
| `rating` | `rating`、`Review Score` | 驗證為 1–5 整數。 |
| `description` | `body`、`Review Content`、`body_text` | 需檢查目標 App 的最長字數與「不可空白」規則。 |
| `date` | `created_at`、`review_date`、`dateCreated`、`Date` | 每種 App 格式不同，應由各 exporter 專責轉換。 |
| `sku` | `sku`、`SKU`、有時可用作商品比對 | SKU 不等於 Shopify product handle 或數字 product ID；不能無條件互換。 |
| `photo_urls` | `picture_urls`、`photo_url`、`imageUrls` 等 | 常見規則是逗號分隔；上限與格式限制依 App 而異。 |
| 使用者輸入 | `product_handle`、`product_id`、產品 URL、產品主圖 URL、產品標題、國別 | 應集中於「商品匹配設定」而非散落於每種匯出按鈕。 |

## 2. 主流應用程式與官方格式比較

下表的 Shopify App Store 評價與評價數，是研究日從官方 App Store 頁面觀察到的公開數值；這類數字會變動，僅用於排序與產品覆蓋範圍判斷，不是永久排名。[8] [9] [10] [11] [12] [13] [14] [15]

| App | App Store 公開訊號（研究日） | 官方模板／匯入模型 | 核心必填欄位 | 商品匹配 | 圖片規則 | 與 ReviewPort 的相容性 |
|---|---:|---|---|---|---|---|
| Judge.me | 5.0／43,293 reviews | 固定 CSV 模板 | `body`、`rating` | `product_url`、`product_id`、`product_handle` 均可留空作為 store review | 最多 5 張、逗號分隔、公開 JPG/JPEG/PNG | **高**；既有格式需修正日期與圖片驗證 |
| Loox | 4.9／8,957 reviews | 固定 CSV 模板 | `product_handle`、`rating`、`author`、`body`、`created_at` | `product_handle` 為主，`product_Id` fallback | 最多 5 張、逗號分隔、公開 JPG/JPEG/PNG | **高**；只需 handle |
| Yotpo | 4.8／4,395 reviews | 欄位對應式 CSV | Product ID、Date、Review Content、Review Score、Email、Customer Country | Product ID；空白即 site review | Published／Unpublished Image/Video URL 欄位 | **中**；必填 email 與 country 需設定 |
| Stamped | 4.7／3,403 reviews | 固定 Google Sheet／CSV template | product ID、產品 URL、產品主圖 URL、產品標題、rating、author、body、created_at | product ID，可選 product handle | 最多 3 圖、逗號分隔；最多 1 影片 | **中低**；需完整商品資料 |
| Okendo | 4.9／1,317 reviews | 固定 CSV template | `name`、`body`、`rating`、`dateCreated`；`handle`／`productId`／`sku` 至少一個 | 推薦 productId，也接受 handle 或 SKU | 公開 URL、多張以逗號分隔 | **高**；SKU 可直接使用 |
| Fera | 4.8／1,980 reviews | 彈性欄位匹配與官方 sample file | 公開文章未列完整必填 schema | 產品 handle 或 ID 必須匹配店內產品 | 文件未列固定 schema | **中**；適合 mapping assistant，不適合 fixed exporter |
| Opinew | 4.7／602 reviews | 固定順序 custom CSV | `body`、`rating`、`review_date`、`state`、`reviewer_name`，以及至少一個商品識別 | product ID、handle、SKU、barcode 任一 | 單一 URL 或逗號分隔多 URL | **高**；SKU 已有，state 可提供預設 |
| Ryviu | 4.9／485 reviews | 固定 CSV template | `product_handle`、`rating`、`author` | product handle | 多張逗號分隔直接圖片 URL | **高**；只需 handle |

## 3. 各格式的建議輸出規格

### 3.1 Loox：建議第一批直接匯出

Loox 的固定欄位為：

```text
product_handle,product_Id,rating,author,email,body,created_at,photo_url,reply,replied_at,verified_purchase,incentivized
```

ReviewPort 應輸出 `product_handle`（使用者輸入）、空白 `product_Id`、原始遮罩 `username` 至 `author`、`rating`、`description`、轉換為 `YYYY-MM-DD` 的 `created_at`。`email` 為選填，預設可留空；不需要為 Loox 自動建立 email。`photo_url` 僅應包含通過格式檢查的公開 JPG/JPEG/PNG URL，最多 5 張、用逗號串接。[2]

### 3.2 Okendo：建議第一批直接匯出

Okendo 固定模板欄位為：

```text
name,body,handle,productId,rating,sku,dateCreated,countryCode,email,imageUrls,isApproved,isIncentivized,isRecommended,rejectedImageUrls,reply,replyDateCreated,replyIsPublic,title,videoUrls,isVerifiedBuyer,variantId,status
```

ReviewPort 可將現有 `sku` 填入 `sku`，這已滿足「handle、productId、sku 三者至少一項」的官方產品匹配規則。第一版的保守預設應為 `isApproved=false` 或 `status=pending`，讓商家在目標 App 內審核後再公開；若使用者啟用「直接發布」才輸出 `isApproved=true`／`status=approved`。不可將 TikTok 評論自動標記為已驗證買家（`isVerifiedBuyer=false`）。[4]

### 3.3 Opinew：建議第一批直接匯出

Opinew 要求欄位順序精確：

```text
body,rating,review_date,state,reviewer_name,reviewer_email,product_id,product_handle,reply,reply_date,picture_urls,SKU,barcode,region
```

ReviewPort 可將 `sku` 填入 `SKU`，使其符合至少一個商品識別欄位的要求。`state` 應在 UI 中由使用者選擇 `published` 或 `unpublished`，安全預設是 `unpublished`；不應默認把未審核的來源評論公開。日期轉為 `YYYY-MM-DD HH:MM:SS UTC`，圖片以逗號分隔。官方要求順序精確，因此此 exporter 不應讓使用者改欄位順序。[3]

### 3.4 Ryviu：建議第一批直接匯出

Ryviu 格式為：

```text
product_handle,rating,author,title,body_text,email,photo_urls,created_at,status,featured
```

需要一個使用者輸入的 `product_handle`。可從本機內文建立 `title`，但應標記為「本機短標題」，不應聲稱為原始 TikTok 標題。日期轉為 `YYYY-MM-DD HH:MM`，圖片逗號分隔。`status` 應提供 `enable`／`disable` 選擇並預設為 `disable`；`featured` 預設 `0`。[7]

### 3.5 Yotpo：第二批進階匯出

Yotpo 使用欄位對應模式，欄位名稱與順序不需要完全相同；它會自動匹配，但使用者應在 Yotpo 匯入步驟人工確認。產品評論必須提供有效 Product ID，且 Date、Review Content、Review Score、Email、Customer Country 為必填。[5]

ReviewPort 應把此格式設計成「**Yotpo mapping CSV**」而不是假裝唯一官方模板。需要增加三個明確設定：產品 ID、預設國別、email policy。由於原始來源沒有電子郵件，建議預設阻擋匯出並要求使用者選擇：

| 選項 | 建議 |
|---|---|
| 使用真實 customer email | **不建議**；ReviewPort 未取得這項資料。 |
| 使用唯一的 `@reviewport.local` 技術 placeholder | 只有使用者明確確認後才可用，並在 UI 說明它不是真實可驗證電子郵件。 |
| 不輸出 Yotpo | 安全預設；避免 CSV 因缺少必填 email／country 失敗。 |

### 3.6 Stamped：第二批進階匯出

Stamped 有固定 template，且官方列出多項目前 ReviewPort 未收集的必填商品資料：數字 `product_id`、`productUrl`、`productImageUrl`、`productTitle`。此外，每則評論最多三張圖片，日期為 `YYYY-MM-DD HH:MM:SS`。[6]

因此 Stamped exporter 應放到「進階商品設定」完成後才推出。使用者須提供每一個目標商品的 ID、URL、主圖 URL、名稱，或上傳本機 SKU-to-product mapping CSV。不能用 TikTok 的商品 URL 或評論圖片 URL 充當 Shopify 產品頁／產品主圖 URL。

### 3.7 Judge.me：保留但應修正規格

ReviewPort 已有 Judge.me 匯出，但應根據目前官方文件作以下調整：

| 項目 | 現行行為 | 建議修正 |
|---|---|---|
| `review_date` | 目前輸出 UTC datetime 字串 | 改為官方模板要求的 `dd/mm/yyyy`。 |
| 圖片 | 僅切到 5 張並逗號分隔 | 加入副檔名／公開 URL 警示，Judge.me 僅列 JPG/JPEG/PNG。 |
| 商品識別 | 使用 product handle | 保留，並允許使用者選擇 product handle、ID、URL 或 store review。 |
| `curated` | 未輸出 | 加入選擇：`ok`、`not-yet`、`spam`；安全預設建議 `not-yet`。 |
| 影片 | 不處理 | 維持不處理；官方 CSV 匯入不支援影片。 |

### 3.8 Fera：延後為 mapping assistant

Fera 官方公開文件確認它以欄位匹配介面匯入 CSV，並提供 sample template，但文章本身未公開完整、固定且可穩定依賴的欄位 schema。[16] 因此第一階段不應在 UI 中提供宣稱「官方 Fera direct import」的固定按鈕。較好的選項是：讓使用者下載 ReviewPort custom CSV，再依 Fera 匯入器映射欄位，或待取得官方完整 sample schema 並再次驗證後才加 direct format。

## 4. 建議的產品設計：一個資料設定層，避免八套重複表單

不要為每一種 App 直接新增一堆散落的 input。建議在 Export drawer 內加入一個獨立且預設收合的 **Shopify import settings** 區域，並依格式顯示必要欄位。

| 設定群組 | 欄位 | 使用格式 |
|---|---|---|
| Product matching | Product handle、Shopify product ID、SKU、product URL、product image URL、product title | Loox、Okendo、Opinew、Ryviu、Yotpo、Stamped、Judge.me |
| Review publishing | Publish now / import as pending | Judge.me、Okendo、Opinew、Ryviu、Stamped |
| Reviewer metadata | Country code、email handling policy | Yotpo；其他 App 多為選填 |
| Media validation | Keep only supported image URLs / export all original URLs | Loox、Judge.me、Stamped、Okendo、Opinew、Ryviu |
| Date conversion | 唯讀顯示 exporter 會採用的目標格式 | 所有 direct-template formats |

> **不變的資料原則：** ReviewPort 必須繼續保留 TikTok 顯示的遮罩 username；不得將其替換為假姓名。對於各 App 要求但來源未提供的欄位，應採用「使用者輸入」、「明示本機 technical placeholder」或「阻擋匯出並說明原因」三選一，而非暗中偽造資料。

## 5. 分階段實作建議

| 版本階段 | 內容 | 驗收條件 |
|---|---|---|
| **A. 規格修正** | 修正 Judge.me 日期；新增圖片 URL 相容性警示；新增匯出前 validation summary | 以官方 sample rows 做單元測試；不相容圖片有可理解提示。 |
| **B. 第一批格式** | Loox、Okendo、Opinew、Ryviu exporters；共用 Shopify import settings | 每種固定 schema 有 header-order、必填欄位、日期、照片上限與 CSV escaping 測試。 |
| **C. 進階格式** | Yotpo mapping CSV、Stamped exporter 與商品 mapping CSV 匯入 | 不允許缺少必填商品資料時靜默輸出；Yotpo 必填 email/country 有明確確認流程。 |
| **D. Fera** | Fera mapping assistant 或經再次驗證後的 direct exporter | 只有取得並固定官方 sample schema 後才提供 direct import 標籤。 |

## 6. 待你確認的實作決策

在開始新增匯出功能前，請確認以下四項產品決策：

1. **第一批格式範圍：** 是否同意先加入 **Loox、Okendo、Opinew、Ryviu**，並同步修正 Judge.me？
2. **公開狀態預設：** 是否同意所有新格式預設為 **pending / unpublished / disable**，由使用者明確選擇才直接發布？
3. **圖片策略：** 對於目標 App 不接受的 WebP 或非公開圖片 URL，是否應預設排除圖片並顯示警示，還是保留原 URL 讓使用者自行承擔匯入錯誤？
4. **Yotpo email policy：** 因 Yotpo 要求 Email 與 Customer Country，是否只在使用者明確勾選後才產生唯一的本機 `@reviewport.local` technical placeholder，否則不提供 Yotpo exporter？

## References

[1]: https://support.okendo.io/en/articles/2057320-importing-reviews-using-the-okendo-import-template "Okendo — Importing Reviews Using the Okendo Import Template"
[2]: https://help.loox.io/support/solutions/articles/501000162508-importing-reviews-using-a-custom-file "Loox — Importing Reviews Using a Custom File"
[3]: https://www.opinew.com/help-center/knowledge-base/how-can-i-migrate-reviews-to-opinew-from-a-custom-csv-file/ "Opinew — Migrate reviews from a custom CSV file"
[4]: https://docs.ryviu.com/en/articles/19-import-reviews-from-csv-file-for-your-products "Ryviu — Import Reviews from a CSV File for Your Products"
[5]: https://support.yotpo.com/docs/importing-reviews-to-yotpo "Yotpo — Importing Reviews to Yotpo"
[6]: https://stampedsupport.stamped.io/hc/en-us/articles/8839367004443-Managing-Reviews-Import-reviews-into-Stamped "Stamped — Managing Reviews: Import reviews into Stamped"
[7]: https://judge.me/help/en/articles/8415368-importing-reviews-using-judge-me-template "Judge.me — Importing reviews using Judge.me template"
[8]: https://apps.shopify.com/judgeme "Shopify App Store — Judge.me Product Reviews"
[9]: https://apps.shopify.com/loox "Shopify App Store — Loox"
[10]: https://apps.shopify.com/yotpo-social-reviews "Shopify App Store — Yotpo"
[11]: https://apps.shopify.com/product-reviews-addon "Shopify App Store — Stamped"
[12]: https://apps.shopify.com/okendo-reviews "Shopify App Store — Okendo"
[13]: https://apps.shopify.com/fera "Shopify App Store — Fera"
[14]: https://apps.shopify.com/photo-reviews "Shopify App Store — Opinew"
[15]: https://apps.shopify.com/ryviu "Shopify App Store — Ryviu"
[16]: https://help.fera.ai/en/articles/5894718-import-reviews-from-csv "Fera — Import Reviews From CSV"
