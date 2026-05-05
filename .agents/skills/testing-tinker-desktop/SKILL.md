---
name: testing-tinker-desktop
description: Boot and test the Tinker desktop app end-to-end. Use when verifying UI changes, MCP connections, Settings, or workspace features.
---

# Testing Tinker Desktop App

## Prerequisites

### System Dependencies (Ubuntu/Debian)

Tauri v2 requires WebKit2 GTK and related libraries:

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  libsoup-3.0-dev \
  libayatana-appindicator3-dev
```

### Rust Toolchain

Tinker requires Rust 1.85+ (edition2024 feature). If the build fails with `feature edition2024 is required`:

```bash
rustup update stable
rustc --version  # should be 1.85+
```

### Node Dependencies

```bash
pnpm install
```

### X11 Display

The Tauri app needs a display. Verify `DISPLAY=:0` is set. The app renders via WebKit2 GTK.

### Window Management

Install `wmctrl` for window manipulation during testing:

```bash
sudo apt-get install -y wmctrl
wmctrl -r "Tinker" -b add,maximized_vert,maximized_horz  # maximize
wmctrl -a "Tinker"  # bring to front
```

## Launching the App

```bash
cd /home/ubuntu/repos/tinker
DISPLAY=:0 pnpm dev:desktop
```

**First build takes 5-10 minutes** (full Rust crate compilation). Subsequent builds are faster (~30s for incremental changes).

The Vite dev server starts first at `http://127.0.0.1:1420`, then Tauri compiles the Rust backend and opens the desktop window.

### What to expect on launch

1. Vite ready message appears quickly
2. Cargo compilation runs (many crates)
3. App window opens — may show folder picker
4. Select any folder to initialize the workspace
5. OpenCode sidecar starts and connects
6. Built-in MCP tools begin connecting (qmd, smart-connections, exa)

## Navigating to Key Features

### Settings → Connections (MCP testing)

1. Click the **gear icon** in the bottom-left sidebar
2. Settings pane opens with tabs: Account, Model, Memory, **Connections**
3. Click **Connections** in the left sidebar

### What you'll see in Connections

- **Built-in tools** section: qmd, smart-connections, exa with StatusDots
- **Custom tools** section (if any custom MCPs added): user-added entries with Remove buttons
- **"+ Add tool"** button at the bottom

## Known Issues

### auth.rs spawn tuple order

The Tauri shell plugin API changed the return order of `Command::spawn()` from `(CommandChild, Receiver)` to `(Receiver, CommandChild)`. If you see compilation errors about `pid()` or `kill()` not found on `Receiver<CommandEvent>`, swap the destructuring in `src-tauri/src/commands/auth.rs`:

```rust
// Before (broken):
let (child, receiver) = sidecar.spawn()...;
// After (fixed):
let (receiver, child) = sidecar.spawn()...;
```

Note: `opencode.rs` already uses the correct order.

### Built-in tool status shows "Checking..."

Built-in tools may show "Checking..." status if the OpenCode sidecar hasn't fully connected MCP servers. This is normal in dev/test environments and does not affect custom MCP UI testing.

### Accessibility warning

You may see `dbind-WARNING: AT-SPI: Error retrieving accessibility bus address`. This is a harmless GTK accessibility warning on headless/remote Linux environments.

## Devin Secrets Needed

- **Composio test API key** (for testing Composio MCP catalog entry): The key format is `ck_...`. Ask the user for a test key if needed.

## Testing Tips

- Run the app in background (`run_in_background: true`) so you can monitor the shell output for errors
- Use `wmctrl -l` to verify the Tinker window is listed
- The app title in the window list is "Tinker"
- Screenshots capture the full desktop including the Tinker native window
- Custom MCP entries persist in workspace preferences (SQLite) — remove them during testing to reset state
- The catalog modal resets to catalog view when closed and reopened (form state is not preserved)
