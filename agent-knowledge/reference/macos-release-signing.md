---
type: reference
tags: [release, macos, signing, notarization, tauri, post-mvp]
status: current
last_verified: '2026-04-21'
---

# macOS release signing

- `[2026-04-21]` TIN-164 adds upstream macOS release plumbing in [`.github/workflows/release-macos.yml`](../../.github/workflows/release-macos.yml) plus [`apps/desktop/scripts/notarize-macos-release.sh`](../../apps/desktop/scripts/notarize-macos-release.sh).
- `[2026-04-21]` Current Tauri version in this repo signs the macOS app bundle during `tauri build`, but DMG notarization still needs an explicit `xcrun notarytool submit` step after the build. Keep that step in-repo until the bundled Tauri version closes upstream gap `tauri-apps/tauri#7533`.
- `[2026-04-21]` Release workflow builds `--target universal-apple-darwin --bundles app,dmg` to ship one signed `.app` and one signed `.dmg` for both Apple Silicon and Intel.
- `[2026-04-21]` Required GitHub Actions secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_BASE64`.
- `[2026-04-21]` Certificate import uses a temporary keychain on the runner and extracts the `Developer ID Application` signing identity dynamically. Do not hardcode the identity string in repo config.
- `[2026-04-21]` Post-build order is: build signed app+dmg → notarize dmg → staple app → staple dmg → upload artifacts. This matches Apple-distribution expectations better than app-only notarization.
