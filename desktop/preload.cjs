const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ieltsDesktop", {
  isDesktop: true,
  platform: process.platform,
  store: {
    restore: (values) => ipcRenderer.sendSync("study-store:restore", values),
    snapshot: () => ipcRenderer.sendSync("study-store:snapshot"),
    get: (key) => ipcRenderer.sendSync("study-store:get", key),
    set: (key, value) => ipcRenderer.sendSync("study-store:set", { key, value }),
  },
  openExternal: (url) => ipcRenderer.invoke("desktop:open-external", url),
  openLocalDocument: (url) => ipcRenderer.invoke("desktop:open-local-document", url),
});
