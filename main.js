const {app, BrowserWindow, Menu, dialog, ipcMain} = require("electron");
const path = require("path");
const fs = require("fs/promises");
const {pathToFileURL} = require("url");

const PROJECT_FILE = "project.json";
const PROJECTS_ROOT_NAME = "SolderMap Projects";
const MAX_PROJECT_NAME = 40;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"]);

function projectStorePath() {
  return path.join(app.getPath("documents"), PROJECTS_ROOT_NAME);
}

function sanitizeFolderName(name) {
  return String(name || "New Project")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, MAX_PROJECT_NAME) || "New Project";
}

async function uniqueProjectFolder(rootPath, name) {
  const base = sanitizeFolderName(name);
  let folderPath = path.join(rootPath, base);
  let index = 2;
  while (true) {
    try {
      await fs.access(folderPath);
      folderPath = path.join(rootPath, `${base} ${index++}`);
    } catch {
      return folderPath;
    }
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    frame: false,
    icon: path.join(__dirname, "assets", "app-icon.ico"),
    backgroundColor: "#eef2f5",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.on("window:minimize", event => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on("window:toggle-maximize", event => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.on("window:close", event => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle("projects:list", async () => {
  const rootPath = projectStorePath();
  await fs.mkdir(rootPath, {recursive: true});
  const entries = await fs.readdir(rootPath, {withFileTypes: true});
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folderPath = path.join(rootPath, entry.name);
    const projectPath = path.join(folderPath, PROJECT_FILE);
    try {
      const [content, stat] = await Promise.all([
        fs.readFile(projectPath, "utf8"),
        fs.stat(projectPath)
      ]);
      const data = JSON.parse(content);
      projects.push({
        path: folderPath,
        name: data?.name || entry.name,
        folderName: entry.name,
        updatedAt: stat.mtimeMs
      });
    } catch {
      projects.push({
        path: folderPath,
        name: entry.name,
        folderName: entry.name,
        updatedAt: 0,
        empty: true
      });
    }
  }
  return {
    rootPath,
    projects: projects.sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name))
  };
});

ipcMain.handle("projects:create", async (_event, name) => {
  const rootPath = projectStorePath();
  await fs.mkdir(rootPath, {recursive: true});
  const folderPath = await uniqueProjectFolder(rootPath, name);
  await fs.mkdir(folderPath, {recursive: true});
  return {
    path: folderPath,
    name: path.basename(folderPath)
  };
});

ipcMain.handle("projects:delete", async (_event, folderPath) => {
  const rootPath = path.resolve(projectStorePath());
  const targetPath = path.resolve(String(folderPath || ""));
  const relativePath = path.relative(rootPath, targetPath);
  if (!targetPath || relativePath.startsWith("..") || path.isAbsolute(relativePath) || relativePath === "") {
    throw new Error("Project path is outside the projects folder.");
  }
  await fs.rm(targetPath, {recursive: true, force: true});
  return {ok: true};
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("project:select-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const folderPath = result.filePaths[0];
  return {
    path: folderPath,
    name: path.basename(folderPath)
  };
});

ipcMain.handle("project:read", async (_event, folderPath) => {
  const content = await fs.readFile(path.join(folderPath, PROJECT_FILE), "utf8");
  return JSON.parse(content);
});

ipcMain.handle("project:write", async (_event, folderPath, project) => {
  await fs.mkdir(folderPath, {recursive: true});
  await fs.writeFile(path.join(folderPath, PROJECT_FILE), JSON.stringify(project, null, 2), "utf8");
});

ipcMain.handle("project:save-image", async (_event, folderPath, fileName, bytes) => {
  await fs.mkdir(folderPath, {recursive: true});
  await fs.writeFile(path.join(folderPath, fileName), Buffer.from(bytes));
});

ipcMain.handle("project:image-url", async (_event, folderPath, fileName) => {
  const imagePath = path.join(folderPath, fileName);
  const stat = await fs.stat(imagePath);
  return `${pathToFileURL(imagePath).href}?v=${Math.round(stat.mtimeMs)}`;
});

ipcMain.handle("project:copy-image", async (_event, folderPath, sourcePath, fileName) => {
  await fs.mkdir(folderPath, {recursive: true});
  await fs.copyFile(sourcePath, path.join(folderPath, fileName));
});

ipcMain.handle("file-browser:places", async () => {
  const homePath = app.getPath("home");
  const candidates = [
    {name:"Изображения", path:app.getPath("pictures")},
    {name:"Рабочий стол", path:app.getPath("desktop")},
    {name:"Загрузки", path:app.getPath("downloads")},
    {name:"Документы", path:app.getPath("documents")},
    {name:"Пользователь", path:homePath},
    {name:"Yandex.Disk", path:path.join(homePath, "Yandex.Disk")},
    {name:"Проекты", path:projectStorePath()}
  ];
  const places = [];
  for (const item of candidates) {
    try {
      await fs.access(item.path);
      places.push(item);
    } catch {
      // skip unavailable well-known folders
    }
  }
  return places;
});

ipcMain.handle("file-browser:list", async (_event, folderPath) => {
  const entries = await fs.readdir(folderPath, {withFileTypes: true});
  const parentPath = path.dirname(folderPath);
  let hasProject = false;
  try {
    await fs.access(path.join(folderPath, PROJECT_FILE));
    hasProject = true;
  } catch {
    hasProject = false;
  }
  const items = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      let folderHasProject = false;
      try {
        await fs.access(path.join(fullPath, PROJECT_FILE));
        folderHasProject = true;
      } catch {
        folderHasProject = false;
      }
      const stat = await fs.stat(fullPath);
      items.push({type:"folder", name:entry.name, path:fullPath, hasProject:folderHasProject, modifiedAt:stat.mtimeMs});
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (entry.isFile() && (IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext))) {
      const stat = await fs.stat(fullPath);
      items.push({
        type:IMAGE_EXTENSIONS.has(ext) ? "image" : "video",
        name:entry.name,
        path:fullPath,
        url:IMAGE_EXTENSIONS.has(ext) ? pathToFileURL(fullPath).href : "",
        modifiedAt:stat.mtimeMs
      });
    }
  }
  return {
    path:folderPath,
    parentPath:parentPath !== folderPath ? parentPath : "",
    hasProject,
    items:items.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
  };
});
