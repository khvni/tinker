# Distribution + signing

Tinker's macOS release flow lives in [`.github/workflows/release-macos.yml`](../.github/workflows/release-macos.yml).

## What it does

1. Builds a universal macOS Tauri bundle (`.app` + `.dmg`).
2. Signs both artifacts with a `Developer ID Application` certificate imported into a temporary keychain on the GitHub Actions runner.
3. Notarizes the generated `.dmg` with `xcrun notarytool`.
4. Staples both the `.dmg` and the contained `.app`.
5. Uploads the final artifacts as a GitHub Actions artifact named `tinker-macos-release`.

The workflow runs on manual dispatch and on pushed tags matching `v*`.

## Required GitHub Actions secrets

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` export of the `Developer ID Application` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` certificate |
| `KEYCHAIN_PASSWORD` | Temporary runner keychain password |
| `APPLE_API_KEY` | App Store Connect API key ID |
| `APPLE_API_ISSUER` | App Store Connect issuer ID |
| `APPLE_API_KEY_BASE64` | Base64-encoded contents of `AuthKey_<key-id>.p8` |

## Preparing secrets

Export the signing certificate:

```bash
openssl base64 -in developer-id-application.p12 -A
```

Encode the App Store Connect API key:

```bash
openssl base64 -in AuthKey_ABC123XYZ.p8 -A
```

## Local macOS release command

The workflow builds with:

```bash
pnpm --filter @tinker/desktop tauri build --target universal-apple-darwin --bundles app,dmg
```

CI then runs [`apps/desktop/scripts/notarize-macos-release.sh`](../apps/desktop/scripts/notarize-macos-release.sh) to notarize the DMG and staple both artifacts.

## Why notarize the DMG explicitly

Current Tauri in this repo signs macOS artifacts, but DMG notarization still needs an explicit post-build `notarytool submit` step. The workflow keeps that step in-repo so release output is deterministic until upstream DMG notarization lands in the bundled Tauri version.
