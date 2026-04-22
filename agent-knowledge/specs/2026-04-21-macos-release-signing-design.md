---
type: concept
tags: [spec, release, macos, signing, notarization, post-mvp]
status: implemented
---

# macOS release signing + notarization

Execution design for Linear `TIN-164` ("Release — macOS signing + notarization").

## Goal

Ship a repo-native macOS release workflow that produces:

- one signed universal `.app`
- one signed `.dmg`
- notarized release artifacts
- stapled `.app` and `.dmg`

The workflow must run on GitHub Actions with repository secrets only. No local-manual release steps are required beyond triggering the workflow or pushing a version tag.

## Scope

- GitHub Actions workflow for macOS release builds
- temporary keychain certificate import on runner
- universal Tauri build (`universal-apple-darwin`)
- explicit DMG notarization with `xcrun notarytool`
- stapling + artifact upload
- operator docs for required secrets and workflow usage

## Non-goals

- Windows signing
- Linux packaging
- GitHub Release asset publishing
- auto-update metadata
- Apple App Store distribution

## Constraints

- Keep default local `pnpm build` behavior unchanged for non-release flows.
- Do not hardcode signing identities in repo config; extract `Developer ID Application` dynamically from the imported certificate.
- Keep signing material ephemeral to the runner.
- Use primary Tauri distribution primitives already in the stack; no extra release framework.

## Implementation

1. Add `.github/workflows/release-macos.yml`.
2. Build with `pnpm --filter @tinker/desktop tauri build --target universal-apple-darwin --bundles app,dmg`.
3. Import `Developer ID Application` certificate from `APPLE_CERTIFICATE` into a temporary keychain.
4. Write App Store Connect API key from `APPLE_API_KEY_BASE64` to a temporary `.p8` file.
5. Run post-build `apps/desktop/scripts/notarize-macos-release.sh`:
   - locate built `.app` + `.dmg`
   - notarize DMG via `notarytool submit --wait`
   - staple app
   - staple dmg
   - validate stapled artifacts
6. Upload artifacts from the workflow.

## Required secrets

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `KEYCHAIN_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_ISSUER`
- `APPLE_API_KEY_BASE64`

## Verification

- `bash -n apps/desktop/scripts/notarize-macos-release.sh`
- `actionlint .github/workflows/release-macos.yml`
- `pnpm -r typecheck`
- `pnpm -r test`

## Notes

- Current Tauri in this repo still needs explicit DMG notarization after build. Keep the manual `notarytool submit` step until the bundled Tauri version closes that gap upstream.
