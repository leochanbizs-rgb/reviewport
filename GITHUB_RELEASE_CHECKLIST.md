# ReviewPort GitHub Release Checklist

Use this checklist before replacing the public GitHub ZIP or describing a new extension version on the website. ReviewPort is currently distributed from GitHub only; it is not published in the Chrome Web Store.

## Package verification

- [x] The v5.4.0 ZIP was opened without executing its files.
- [x] The ZIP root contains `manifest.json`, extension HTML, `js/`, `css/`, and `images/`.
- [x] The manifest version is `5.4.0` and matches `reviewport-v5.4.0.zip`.
- [x] The archived v5.4.0 ZIP SHA-256 is `14da97b4383bf4bafc7c76490fb3a543045fae2c6e68d09ef1fa7b342b68e30b`.
- [ ] Review every changed JavaScript file in the source package and run the package’s applicable local verification before the next release.

## Public documentation

- [x] `README.md` explains the direct GitHub ZIP download, extraction, `chrome://extensions`, Developer mode, and Load unpacked installation.
- [x] `README.md` identifies GitHub as the only current distribution channel and avoids Chrome Web Store claims.
- [x] `README.md` and `PRIVACY_POLICY.md` use the public support email `leochanbizs@gmail.com`.
- [x] `PRIVACY_POLICY.md` explains local processing, local storage, cleanup, permissions, support, and non-affiliation.
- [x] `CHANGELOG.md` records the v5.4.0 manifest version and verified public package scope.

## Repository posture

- [x] The repository is public so users can obtain the free package.
- [x] The repository declares the MIT License in `LICENSE` and `README.md`.
- [ ] Confirm no account credentials, private customer data, or deployment secrets are present in the staged diff before every push.

## Website synchronization

- [ ] Confirm all public website download links, structured data and user-visible version references use the new GitHub ZIP.
- [ ] Confirm the website describes only features visible in the latest manifest/source package.
- [ ] Re-run this checklist for every new version.
