import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";
import { DurableStudyStore } from "./data-store.mjs";
import { startLocalServer } from "./local-server.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const name = "IELTS Speaking Studio";
app.setName(name);
if (!app.isPackaged) app.setPath("userData", path.join(root, "work", process.env.IELTS_QA_PROFILE === "1" ? "speaking-qa-profile" : "speaking-profile"));
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  let service;
  let window;
  const createWindow = async () => {
    window = new BrowserWindow({ width: 1280, height: 920, minWidth: 760, minHeight: 650,
      title: name, backgroundColor: "#f8f7f3", autoHideMenuBar: true,
      webPreferences: { preload: path.join(root, "desktop", "preload.cjs"),
        contextIsolation: true, nodeIntegration: false, sandbox: true } });
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url) && new URL(url).origin !== service.origin) void shell.openExternal(url);
      return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
      if (new URL(url).origin !== service.origin) { event.preventDefault(); if (/^https?:/i.test(url)) void shell.openExternal(url); }
    });
    await window.loadURL(service.origin);
    window.on("closed", () => { window = null; });
  };
  app.whenReady().then(async () => {
    const store = new DurableStudyStore(app.getPath("userData"));
    ipcMain.on("study-store:get", (event, key) => { event.returnValue = store.get(key); });
    ipcMain.on("study-store:restore", (event, values) => { event.returnValue = store.restore(values); });
  ipcMain.on("study-store:snapshot", (event) => { event.returnValue = store.snapshot(); });
    ipcMain.on("study-store:set", (event, payload) => {
      try { event.returnValue = typeof payload?.key === "string" && store.set(payload.key, payload.value); }
      catch { event.returnValue = false; }
    });
    try {
      // A fixed origin keeps imported media and recordings in the same IndexedDB across launches.
      service = await startLocalServer({ distDirectory: path.join(root, "speaking-app", "dist"),
        resourcesDirectory: root, userDataDirectory: app.getPath("userData"), port: !app.isPackaged && process.env.IELTS_QA_PROFILE === "1" ? 17847 : 17846 });
      const localMediaRequest = (contents, permission) => contents?.getURL().startsWith(service.origin + "/") && permission === "media";
      session.defaultSession.setPermissionCheckHandler((contents, permission) => !!localMediaRequest(contents, permission));
      session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
        callback(!!localMediaRequest(contents, permission) && !(details.mediaTypes || []).includes("video"));
      });
      await createWindow();
      app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) void createWindow(); });
    } catch (error) {
      dialog.showErrorBox("口语软件无法启动", error.code === "EADDRINUSE"
        ? "本地端口 17846 被占用。请关闭占用该端口的程序后重试。学习数据仍保留在本机。"
        : error.message);
      app.quit();
    }
  });
  app.on("second-instance", () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
  app.on("before-quit", () => { if (service) void service.close(); });
}
