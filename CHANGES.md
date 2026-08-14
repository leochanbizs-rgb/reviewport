# Repository Changes

## v5.6.0 repository cleanup

The repository was reorganized so the Chrome extension runtime, technical evidence, and Chrome Web Store artwork have separate responsibilities.

| Change | Decision | Reason |
|---|---|---|
| Runtime source | Moved to `extension/` | The release ZIP can now contain only loadable Manifest V3 source. |
| Technical documents | Moved or consolidated in `docs/` | Page observations, CSV format research, QA notes, and release evidence are kept out of the runtime package. |
| Store artwork | Moved to `store-assets/` | Promo artwork and master branding files are available for store submission but never ship in the extension ZIP. |
| Legacy Review Explorer | Removed from runtime | `review-studio.html` owns the current report experience and its CSS no longer imports legacy Explorer styles. |
| Historical ZIPs | Removed from the working tree and no longer tracked | Binary releases belong in GitHub Releases, not the source tree. |
| Public Git history | Not rewritten | Old public ZIP blobs remain in historical commits. Rewriting public history would create unnecessary disruption for limited benefit. |

Future releases must package the **contents of `extension/` only**. Release binaries are attached to GitHub Releases and their SHA-256 is published in release notes.
