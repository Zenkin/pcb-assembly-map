const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("projectApi", {
  listProjects: () => ipcRenderer.invoke("projects:list"),
  createProjectFolder: name => ipcRenderer.invoke("projects:create", name),
  deleteProjectFolder: folderPath => ipcRenderer.invoke("projects:delete", folderPath),
  selectDirectory: () => ipcRenderer.invoke("project:select-directory"),
  readProject: folderPath => ipcRenderer.invoke("project:read", folderPath),
  writeProject: (folderPath, project) => ipcRenderer.invoke("project:write", folderPath, project),
  saveImage: (folderPath, fileName, bytes) => ipcRenderer.invoke("project:save-image", folderPath, fileName, bytes),
  copyImage: (folderPath, sourcePath, fileName) => ipcRenderer.invoke("project:copy-image", folderPath, sourcePath, fileName),
  imageUrl: (folderPath, fileName) => ipcRenderer.invoke("project:image-url", folderPath, fileName),
  exportVerificationReport: payload => ipcRenderer.invoke("report:export", payload)
});

contextBridge.exposeInMainWorld("fileBrowserApi", {
  places: () => ipcRenderer.invoke("file-browser:places"),
  list: folderPath => ipcRenderer.invoke("file-browser:list", folderPath)
});

contextBridge.exposeInMainWorld("windowControls", {
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  close: () => ipcRenderer.send("window:close")
});
