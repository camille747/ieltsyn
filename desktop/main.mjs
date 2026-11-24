import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { DurableStudyStore } from "./data-store.mjs";
import { startLocalServer } from "./local-server.mjs";

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(desktopDirectory);
let localService;
let mainWindow;
let appOrigin;

app.setName("IELTSyn");
// Development records stay with the project and do not mix with an installed app.
if (!app.isPackaged) app.setPath("userData", path.join(projectDirectory, "work", process.env.IELTS_QA_PROFILE === "1" ? "desktop-qa-profile" : "desktop-profile"));
if (!app.requestSingleInstanceLock()) app.quit();

function isPdfUrl(target) {
  try {
    const url = new URL(target);
    const requestedPath = url.searchParams.get("path") || url.pathname;
    return path.extname(requestedPath).toLowerCase() === ".pdf";
  } catch {
    return false;
  }
}

function createPdfWindow(target) {
  const window = createWindow({ width: 1320, height: 900, show: false });
  const url = `${appOrigin}/?desktopPdf=${encodeURIComponent(target)}`;
  window.loadURL(url);
  window.once("ready-to-show", () => window.show());
}

async function openLocalDocument(target) {
  try {
    let filePath = await localService.resolveLocalUrl(target);
    if (!filePath) return { opened: false, message: "资料文件不存在" };

    // Files declared in asarUnpack live beside app.asar. Native apps cannot
    // open Electron's virtual app.asar path, so hand them the physical path.
    if (app.isPackaged && filePath.includes(`${path.sep}app.asar${path.sep}`)) {
      const unpackedPath = filePath.replace(
        `${path.sep}app.asar${path.sep}`,
        `${path.sep}app.asar.unpacked${path.sep}`,
      );
      if (await fsExists(unpackedPath)) filePath = unpackedPath;
    }

    const message = await shell.openPath(filePath);
    return { opened: !message, message };
  } catch (error) {
    return { opened: false, message: error.message };
  }
}

async function fsExists(filePath) {
  try {
    const fs = await import("node:fs/promises");
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function configureNavigation(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if ([appOrigin, localService.origin].includes(new URL(url).origin)) {
      if (isPdfUrl(url)) createPdfWindow(url);
      else void openLocalDocument(url);
      return { action: "deny" };
    }
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if ([appOrigin, localService.origin].includes(new URL(url).origin)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) void shell.openExternal(url);
  });
}

function createWindow(options = {}) {
  const icon = app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(projectDirectory, "build", "icon.png");
  const window = new BrowserWindow({
    width: options.width || 1440,
    height: options.height || 900,
    minWidth: 1024,
    minHeight: 700,
    show: options.show ?? true,
    backgroundColor: "#fafafb",
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: path.join(desktopDirectory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  configureNavigation(window);
  return window;
}

app.whenReady().then(async () => {
  const studyStore = new DurableStudyStore(app.getPath("userData"));
  ipcMain.on("study-store:get", (event, key) => {
    event.returnValue = studyStore.get(key);
  });
  ipcMain.on("study-store:restore", (event, values) => { event.returnValue = studyStore.restore(values); });
  ipcMain.on("study-store:snapshot", (event) => { event.returnValue = studyStore.snapshot(); });
  ipcMain.on("study-store:set", (event, payload) => {
    try { event.returnValue = Boolean(payload?.key) && studyStore.set(payload.key, payload.value); } catch { event.returnValue = false; }
  });
  ipcMain.handle("desktop:open-external", async (_event, url) => {
    if (/^https?:/i.test(url)) await shell.openExternal(url);
  });
  ipcMain.handle("desktop:open-local-document", async (_event, url) => openLocalDocument(url));

  const distDirectory = path.join(app.getAppPath(), "dist");
  localService = await startLocalServer({
    distDirectory,
    resourcesDirectory: app.isPackaged ? process.resourcesPath : projectDirectory,
    userDataDirectory: app.getPath("userData"),
  });

  appOrigin = !app.isPackaged && process.env.IELTS_DEV_URL
    ? new URL(process.env.IELTS_DEV_URL).origin
    : localService.origin;
  mainWindow = createWindow();
  await mainWindow.loadURL(appOrigin);
  mainWindow.on("closed", () => { mainWindow = null; });

  app.on("activate", async () => {
    if (!BrowserWindow.getAllWindows().length) {
      mainWindow = createWindow();
      await mainWindow.loadURL(appOrigin);
    }
  });
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (localService) void localService.close();
});
