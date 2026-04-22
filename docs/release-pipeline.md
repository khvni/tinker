# Release Pipeline

Tag pushes that match `v*` trigger [`.github/workflows/release.yml`](../.github/workflows/release.yml). The workflow validates that the tag matches the desktop app version, creates or reuses a draft GitHub Release, then builds and uploads four desktop bundles:

- macOS arm64 (`aarch64-apple-darwin`, `.app` + `.dmg`)
- macOS x64 (`x86_64-apple-darwin`, `.app` + `.dmg`)
- Windows x64 (`x86_64-pc-windows-msvc`, NSIS installer)
- Linux x64 (`x86_64-unknown-linux-gnu`, AppImage)

The workflow generates a temporary `apps/desktop/src-tauri/tauri.release.conf.json` file in CI so release builds can enable updater artifacts without changing local `pnpm --filter @tinker/desktop build` behavior.

## Required GitHub configuration

Repository variable:

- `TAURI_UPDATER_PUBLIC_KEY` — updater public key embedded into release builds. This value is public and can live in GitHub Variables instead of Secrets.

Repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`
- `APPLE_PROVIDER_SHORT_NAME` (optional; only needed when the Apple ID belongs to multiple teams)

Generate the updater keypair with the Tauri CLI before you configure the repository:

```bash
pnpm --filter @tinker/desktop exec tauri signer generate -- -w ~/.tauri/tinker.key
```

Store the generated private key and password in GitHub Secrets. Store the matching public key in `TAURI_UPDATER_PUBLIC_KEY`.

## Release flow

1. Bump `apps/desktop/package.json` and `apps/desktop/src-tauri/tauri.conf.json` to the same version.
2. Merge the version bump to `main`.
3. Push a matching tag such as `v0.1.0`.
4. Wait for the `Release` workflow to finish.
5. Review the draft GitHub Release, then publish it manually.

## Notes

- The build matrix runs one target at a time so the final `latest.json` updater manifest includes every uploaded platform bundle.
- macOS signing and notarization use the standard Tauri environment variables documented by the Tauri v2 distribution guides.
