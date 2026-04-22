/* Tinker demo-flow · Electron shell.
 *
 * Thin wrapper that loads the Vite build inside a native BrowserWindow.
 * - `pnpm shell`         → runs Vite dev + Electron; hot-reload works.
 * - `pnpm shell:build`   → builds to dist/ and loads the packaged bundle.
 *
 * macOS uses `hiddenInset` so the native traffic-lights sit where the drawn
 * chrome expects them; other platforms fall back to a standard frame. */

const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

const isDev = !app.isPackaged;
const devUrl = process.env.TINKER_DEV_URL || "http://localhost:5280/";

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: "#fefcf8",
    title: "Tinker",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 18, y: 13 },
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  if (isDev) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
