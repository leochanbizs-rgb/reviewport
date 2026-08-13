# ReviewPort GitHub Release Checklist

Use this checklist before updating the public ReviewPort repository or publishing a new downloadable extension ZIP.

## Release package

- [x] The ZIP has been opened and its integrity check passes.
- [x] The ZIP root contains `manifest.json`, `popup.html`, `review-explorer.html`, `js/`, `css/`, and `images/`.
- [x] Every JavaScript file passes a syntax check before packaging.
- [x] The extension version in `manifest.json` matches the release filename and public documentation.

## Public documentation

- [x] `README.md` explains direct ZIP download, extraction, `chrome://extensions`, Developer mode, and Load unpacked.
- [x] `PRIVACY_POLICY.md` describes local processing, local storage, and the seven-day cleanup behaviour.
- [x] `CSV_EXPLORER_SPEC.md` is included for export-field reference.
- [x] The direct ZIP download link responds successfully before publication.

## Repository posture

- [x] Repository visibility is public so users can obtain the free release.
- [x] The repository contains no account credentials, database records, or deployment secrets.
- [ ] A software licence has been deliberately selected. The current repository is publicly downloadable but does **not** declare an open-source licence.

## Final review

- [x] The current public release is `v4.5.0`.
- [x] The website download page links to the public GitHub repository and direct release ZIP.
- [ ] Re-run this checklist for every new release.
