const {app, BrowserWindow, Menu, dialog, ipcMain} = require("electron");
const path = require("path");
const fs = require("fs/promises");
const {pathToFileURL} = require("url");
const report = require("./js/report.js");

const PROJECT_FILE = "project.json";
const PROJECTS_ROOT_NAME = "SolderMap Projects";
const MAX_PROJECT_NAME = 40;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"]);
const REPORT_FORMATS = Object.freeze({
  csv:{extension:"csv", label:"CSV", filter:"CSV"},
  xlsx:{extension:"xlsx", label:"Excel", filter:"Excel"},
  pdf:{extension:"pdf", label:"PDF", filter:"PDF"}
});
const MAX_REPORT_ROWS = 100000;
const MAX_REPORT_CELL_LENGTH = 20000;
const MAX_REPORT_TOTAL_LENGTH = 50000000;

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

function sanitizeReportFileName(name) {
  return String(name || "PCB project")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "PCB project";
}

function normalizeReportRows(value) {
  if (!Array.isArray(value) || value.length > MAX_REPORT_ROWS) {
    throw new Error("Invalid report rows.");
  }
  let totalLength = 0;
  return value.map(row => Object.fromEntries(
    report.COLUMNS.map(column => {
      const cell = String(row?.[column.key] ?? "").slice(0, MAX_REPORT_CELL_LENGTH);
      totalLength += cell.length;
      if (totalLength > MAX_REPORT_TOTAL_LENGTH) throw new Error("Report data is too large.");
      return [column.key, cell];
    })
  ));
}

function escapeReportHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#039;"
  })[character]);
}

function reportHtml(projectName, generatedAt, rows) {
  const headers = report.COLUMNS.map(column => `<th>${escapeReportHtml(column.label)}</th>`).join("");
  const body = rows.map(row => `<tr>${report.COLUMNS.map(column => (
    `<td>${escapeReportHtml(row[column.key])}</td>`
  )).join("")}</tr>`).join("");
  const dateText = new Intl.DateTimeFormat("ru-RU", {
    dateStyle:"long",
    timeStyle:"short"
  }).format(generatedAt);
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${escapeReportHtml(projectName)} — проверка компонентов</title>
<style>
  @page { size:A4 landscape; margin:14mm 8mm 15mm; }
  * { box-sizing:border-box; }
  body { margin:0; color:#111827; font-family:Arial,sans-serif; font-size:8px; }
  h1 { margin:0 0 3mm; font-size:16px; }
  .meta { margin:0 0 4mm; color:#475467; font-size:9px; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  thead { display:table-header-group; }
  tr { break-inside:avoid; page-break-inside:avoid; }
  th,td { padding:2mm 1.3mm; border:0.25mm solid #9aa4b2; text-align:left; vertical-align:top; overflow-wrap:anywhere; }
  th { background:#e8edf3; font-size:7px; }
  th:nth-child(1),td:nth-child(1) { width:8%; }
  th:nth-child(2),td:nth-child(2) { width:8%; }
  th:nth-child(3),td:nth-child(3) { width:9%; }
  th:nth-child(4),td:nth-child(4) { width:6%; }
  th:nth-child(5),td:nth-child(5) { width:9%; }
  th:nth-child(6),td:nth-child(6) { width:10%; }
  th:nth-child(7),td:nth-child(7) { width:9%; }
  th:nth-child(8),td:nth-child(8) { width:12%; }
  th:nth-child(9),td:nth-child(9) { width:8%; }
  th:nth-child(10),td:nth-child(10) { width:10%; }
  th:nth-child(11),td:nth-child(11) { width:11%; }
</style>
</head>
<body>
  <h1>Отчёт о проверке компонентов — ${escapeReportHtml(projectName)}</h1>
  <div class="meta">Сформирован: ${escapeReportHtml(dateText)} · Компонентов: ${rows.length}</div>
  <table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>
</body>
</html>`;
}

async function createExcelReport(rows, projectName, generatedAt) {
  return report.toXlsxBuffer(rows, {projectName, generatedAt});
}

async function createPdfReport(rows, projectName, generatedAt) {
  const reportWindow = new BrowserWindow({
    show:false,
    webPreferences:{
      contextIsolation:true,
      nodeIntegration:false,
      sandbox:true
    }
  });
  try {
    const html = reportHtml(projectName, generatedAt, rows);
    await reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await reportWindow.webContents.printToPDF({
      pageSize:"A4",
      landscape:true,
      printBackground:true,
      displayHeaderFooter:true,
      headerTemplate:"<div></div>",
      footerTemplate:"<div style=\"width:100%;padding:0 8mm;color:#667085;font:8px Arial;text-align:right\"><span class=\"pageNumber\"></span> / <span class=\"totalPages\"></span></div>",
      preferCSSPageSize:true,
      margins:{top:0.55, bottom:0.59, left:0.31, right:0.31}
    });
  } finally {
    if (!reportWindow.isDestroyed()) reportWindow.destroy();
  }
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

ipcMain.handle("report:export", async (event, payload) => {
  const format = String(payload?.format || "");
  const formatInfo = REPORT_FORMATS[format];
  if (!formatInfo) throw new Error("Unsupported report format.");

  const projectName = sanitizeReportFileName(payload?.projectName);
  const rows = normalizeReportRows(payload?.rows);
  const generatedAt = new Date();
  const datePart = generatedAt.toISOString().slice(0, 10);
  const defaultName = `${projectName} - проверка компонентов - ${datePart}.${formatInfo.extension}`;
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  const dialogOptions = {
    title:`Экспорт отчёта ${formatInfo.label}`,
    defaultPath:defaultName,
    buttonLabel:"Сохранить",
    filters:[{name:formatInfo.filter, extensions:[formatInfo.extension]}],
    properties:["showOverwriteConfirmation"]
  };
  const result = parentWindow
    ? await dialog.showSaveDialog(parentWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);
  if (result.canceled || !result.filePath) return {canceled:true};

  let content;
  if (format === "csv") content = report.toCsv(rows);
  if (format === "xlsx") content = await createExcelReport(rows, projectName, generatedAt);
  if (format === "pdf") content = await createPdfReport(rows, projectName, generatedAt);
  await fs.writeFile(result.filePath, content);
  return {canceled:false, filePath:result.filePath};
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
