# ReviewPort CSV Explorer Specification

## Purpose

The **CSV Explorer** export is designed for Excel, Google Sheets, and manual review workflows. Every TikTok review remains one row. If the review has multiple photos, each direct photo URL is placed in its own column so the URLs do not remain combined in one long cell.

## CSV Explorer columns

| Group | Columns | Purpose |
|---|---|---|
| Review identity | `username`, `rating`, `rating_category`, `review_type` | Keep the TikTok-displayed username and make rating groups easy to filter. |
| Photo classification | `has_photos`, `photo_count`, `photo_category` | Quickly find text-only reviews, one-photo reviews, and multi-photo reviews. |
| Review detail | `description`, `sku`, `date` | Preserve the original review content and product option. |
| Separated photo URLs | `photo_url_1` through `photo_url_N` | One photo URL per Excel cell. `N` is calculated from the largest photo count in the selected export, so no captured photo is silently dropped. |

## Classification rules

| Rule | Value |
|---|---|
| Rating 5 | `5 stars — Excellent` |
| Rating 4 | `4 stars — Good` |
| Rating 3 | `3 stars — Mixed` |
| Rating 1–2 | `1–2 stars — Needs attention` |
| Zero photos | `No photos` / `Text review` |
| One photo | `1 photo` / `Photo review` |
| Two or three photos | `2–3 photos` / `Photo review` |
| Four or more photos | `4+ photos` / `Photo review` |

## Explorer popup improvements

The popup will add:

1. A **CSV Explorer — photos & categories** export option.
2. A keyword field to find a word or SKU within collected reviews.
3. Insight cards for total matches, reviews with photos, multi-photo reviews, and the 1–2 star count.
4. Clickable rating category chips to quickly switch between all, 5-star, 4-star, 3-star, and 1–2-star reviews.
5. Preview tags for rating category, photo count, SKU, and date.

All processing remains local in Chrome. Photo URLs are not downloaded, uploaded, or sent to another service.
