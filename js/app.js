const SIDES = ["TOP", "BOTTOM"];
const PROJECT_FILE = "project.json";
const DEFAULT_IMAGE_SIZES = {TOP:{w:1024,h:768}, BOTTOM:{w:1024,h:768}};
const MAX_HISTORY = 200;
const MIN_COMPONENT_SIZE = 18;
const MIN_COMPONENT_AREA = 520;
const MAX_PROJECT_NAME = 40;
const MAX_GROUP_NAME = 40;
const MAX_STAGE_NAME = 40;
const MAX_REF_NAME = 24;
const {
  unitsForRef: verificationUnitsForRef,
  parseNumber: parseVerificationNumber,
  parseTolerance: parseVerificationTolerance,
  parseNominal: parseVerificationNominal,
  calculateControl: calculateVerificationControl,
  formatNumber: formatVerificationNumber,
  formatBaseValue: formatVerificationBaseValue,
  normalizeRecord: normalizeVerificationRecord,
  normalizeMap: normalizeVerificationMap,
  matchesFilter: matchesVerificationFilter,
  summarize: summarizeVerification
} = window.SolderMapVerification;
let projectHandle = null;
let project = null;
let currentSide = "TOP";
let appMode = "editor";
let markMode = false;
let selectedKey = "";
let dragStart = null;
let draftBox = null;
let saveTimer = null;
let imageUrls = {TOP:"", BOTTOM:""};
let undoStack = [];
let redoStack = [];
let activeGeometryEdit = null;
let imagePickerSide = "TOP";
let imagePickerPath = "";
let imagePickerParentPath = "";
let browserMode = "image";
let currentFolderHasProject = false;
let browserItems = [];
let browserSearch = "";
let browserSort = "name";
let lastImagePickerPath = "";
let browserSearchTimer = null;
let verificationKey = "";
let contextComponentKey = "";

const projectGate = document.getElementById("projectGate");
const startOpenProjectBtn = document.getElementById("startOpenProjectBtn");
const startNewProjectBtn = document.getElementById("startNewProjectBtn");
const newProjectName = document.getElementById("newProjectName");
const projectList = document.getElementById("projectList");
const projectRootPath = document.getElementById("projectRootPath");
const modeTitle = document.getElementById("modeTitle");
const modeHint = document.getElementById("modeHint");
const backToProjectsBtn = document.getElementById("backToProjectsBtn");
const saveGoSolderBtn = document.getElementById("saveGoSolderBtn");
const backToEditorBtn = document.getElementById("backToEditorBtn");
const board = document.getElementById("board");
const boardImg = document.getElementById("boardImg");
const boardwrap = document.getElementById("boardwrap");
const list = document.getElementById("list");
const componentInspector = document.getElementById("componentInspector");
const search = document.getElementById("search");
const stageFilter = document.getElementById("stageFilter");
const groupFilter = document.getElementById("groupFilter");
const verificationFilter = document.getElementById("verificationFilter");
const verificationOverview = document.getElementById("verificationOverview");
const btnTop = document.getElementById("btnTop");
const btnBottom = document.getElementById("btnBottom");
const resetBtn = document.getElementById("resetBtn");
const markModeBtn = document.getElementById("markModeBtn");
const topFilePicker = document.getElementById("topFilePicker");
const bottomFilePicker = document.getElementById("bottomFilePicker");
const topFile = document.getElementById("topFile");
const bottomFile = document.getElementById("bottomFile");
const topFileMeta = document.getElementById("topFileMeta");
const bottomFileMeta = document.getElementById("bottomFileMeta");
const imagePickerModal = document.getElementById("imagePickerModal");
const imagePickerBackdrop = document.getElementById("imagePickerBackdrop");
const imagePickerTitle = document.getElementById("imagePickerTitle");
const imagePickerCloseBtn = document.getElementById("imagePickerCloseBtn");
const imagePickerPlaces = document.getElementById("imagePickerPlaces");
const imagePickerUpBtn = document.getElementById("imagePickerUpBtn");
const imagePickerPathText = document.getElementById("imagePickerPathText");
const openCurrentFolderBtn = document.getElementById("openCurrentFolderBtn");
const browserSearchInput = document.getElementById("browserSearch");
const browserSortSelect = document.getElementById("browserSort");
const imagePickerGrid = document.getElementById("imagePickerGrid");
const clearDoneBtn = document.getElementById("clearDoneBtn");
const projectStatus = document.getElementById("projectStatus");
const newStageName = document.getElementById("newStageName");
const addStageBtn = document.getElementById("addStageBtn");
const stageList = document.getElementById("stageList");
const newGroupName = document.getElementById("newGroupName");
const addGroupBtn = document.getElementById("addGroupBtn");
const groupList = document.getElementById("groupList");
const windowMinimizeBtn = document.getElementById("windowMinimizeBtn");
const windowMaximizeBtn = document.getElementById("windowMaximizeBtn");
const windowCloseBtn = document.getElementById("windowCloseBtn");
const confirmModal = document.getElementById("confirmModal");
const confirmBackdrop = document.getElementById("confirmBackdrop");
const confirmTitle = document.getElementById("confirmTitle");
const confirmText = document.getElementById("confirmText");
const confirmCloseBtn = document.getElementById("confirmCloseBtn");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const confirmAcceptBtn = document.getElementById("confirmAcceptBtn");
const verificationModal = document.getElementById("verificationModal");
const verificationBackdrop = document.getElementById("verificationBackdrop");
const verificationTitle = document.getElementById("verificationTitle");
const verificationCloseBtn = document.getElementById("verificationCloseBtn");
const verificationForm = document.getElementById("verificationForm");
const verificationBomValue = document.getElementById("verificationBomValue");
const verificationTolerance = document.getElementById("verificationTolerance");
const verificationManualReference = document.getElementById("verificationManualReference");
const verificationReferenceValue = document.getElementById("verificationReferenceValue");
const verificationReferenceError = document.getElementById("verificationReferenceError");
const verificationReferenceUnit = document.getElementById("verificationReferenceUnit");
const verificationNumeric = document.getElementById("verificationNumeric");
const verificationUnsupported = document.getElementById("verificationUnsupported");
const verificationActualValue = document.getElementById("verificationActualValue");
const verificationActualError = document.getElementById("verificationActualError");
const verificationUnit = document.getElementById("verificationUnit");
const verificationComment = document.getElementById("verificationComment");
const verificationChecked = document.getElementById("verificationChecked");
const verificationResult = document.getElementById("verificationResult");
const verificationSaveStatus = document.getElementById("verificationSaveStatus");
const verificationDoneBtn = document.getElementById("verificationDoneBtn");
const componentContextMenu = document.getElementById("componentContextMenu");
const contextVerificationBtn = document.getElementById("contextVerificationBtn");

function enforceInputLimit(input, max, label) {
  const raw = String(input.value || "");
  if (raw.length > max) {
    const next = raw.slice(0, max);
    input.value = next;
    input.classList.add("inputError");
    notify(`${label}: максимум ${max} символов.`, "warning");
    setTimeout(() => input.classList.remove("inputError"), 1200);
  }
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function cloneData(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}
function truncateText(value, max) {
  return String(value || "").trim().slice(0, max);
}
function notify(message, tone = "info") {
  let el = document.getElementById("appToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "appToast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `appToast show ${tone}`;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => el.classList.remove("show"), 2600);
}
function showBrowserLoading() {
  imagePickerGrid.innerHTML = `
    <div class="imagePickerLoading" role="status" aria-live="polite">
      <span class="loaderRing" aria-hidden="true"></span>
      <span>Загрузка папки...</span>
    </div>
  `;
}
function openConfirmDialog({title, text, action = "Удалить"}) {
  return new Promise(resolve => {
    confirmTitle.textContent = title;
    confirmText.textContent = text;
    confirmAcceptBtn.textContent = action;
    confirmModal.hidden = false;
    confirmCancelBtn.focus();

    const cleanup = result => {
      confirmModal.hidden = true;
      confirmAcceptBtn.removeEventListener("click", accept);
      confirmCancelBtn.removeEventListener("click", cancel);
      confirmCloseBtn.removeEventListener("click", cancel);
      confirmBackdrop.removeEventListener("click", cancel);
      window.removeEventListener("keydown", onKey);
      resolve(result);
    };
    const accept = () => cleanup(true);
    const cancel = () => cleanup(false);
    const onKey = ev => {
      if (ev.key === "Escape") cleanup(false);
      if (ev.key === "Enter") cleanup(true);
    };

    confirmAcceptBtn.addEventListener("click", accept);
    confirmCancelBtn.addEventListener("click", cancel);
    confirmCloseBtn.addEventListener("click", cancel);
    confirmBackdrop.addEventListener("click", cancel);
    window.addEventListener("keydown", onKey);
  });
}
function formatDate(ms) {
  if (!ms) return "";
  return new Intl.DateTimeFormat("ru-RU", {day:"2-digit", month:"2-digit", year:"2-digit"}).format(new Date(ms));
}
function fileKindLabel(type) {
  if (type === "video") return "Видео";
  if (type === "folder") return "Папка";
  return "Изображение";
}
function normalizePathForCompare(value) {
  return String(value || "").replace(/[\\/]+$/g, "").toLowerCase();
}
function isSameFilePath(a, b) {
  return normalizePathForCompare(a) === normalizePathForCompare(b);
}
function renderPickerPlaces(places, activePath) {
  const normalizedActivePath = normalizePathForCompare(activePath);
  imagePickerPlaces.innerHTML = places.map(place => {
    const isActive = normalizePathForCompare(place.path) === normalizedActivePath;
    return `<button class="placeBtn ${isActive ? "active" : ""}" type="button" data-path="${escapeHtml(place.path)}">${escapeHtml(place.name)}</button>`;
  }).join("");
}
function syncActivePickerPlace(activePath) {
  const normalizedActivePath = normalizePathForCompare(activePath);
  imagePickerPlaces.querySelectorAll(".placeBtn").forEach(btn => {
    btn.classList.toggle("active", normalizePathForCompare(btn.dataset.path) === normalizedActivePath);
  });
}
function isElectronApp() {
  return Boolean(window.projectApi);
}
function ensureFileSystemAccess() {
  if (isElectronApp()) return true;
  if (!window.showDirectoryPicker) {
    notify("Для папок проекта нужен Chrome или Edge с поддержкой File System Access API.", "warning");
    return false;
  }
  return true;
}
function createBlankProject(name) {
  return {
    version: 3,
    name: name || "PCB project",
    images: {TOP:null, BOTTOM:null},
    imageSizes: cloneData(DEFAULT_IMAGE_SIZES),
    stages: [],
    groups: [],
    components: [],
    doneMap: {},
    verificationMap: {}
  };
}
function normalizeProject(data, folderName) {
  const normalized = createBlankProject(data?.name || folderName);
  if (data && typeof data === "object") {
    normalized.version = 3;
    normalized.images = Object.assign(normalized.images, data.images || {});
    normalized.imageSizes = Object.assign(normalized.imageSizes, data.imageSizes || {});
    normalized.components = Array.isArray(data.components) ? data.components : [];
    normalized.doneMap = data.doneMap || {};
    normalized.verificationMap = normalizeVerificationMap(data.verificationMap);
    normalized.groups = Array.isArray(data.groups) ? data.groups : [];
    normalized.stages = Array.isArray(data.stages) ? data.stages : [];
  }
  const derivedGroups = normalized.components.map(c => c.group).filter(Boolean);
  const derivedStages = normalized.components.map(c => c.stage).filter(Boolean);
  normalized.groups = [...new Set([...normalized.groups, ...derivedGroups])].sort((a,b)=>a.localeCompare(b));
  normalized.stages = normalizeStages([...normalized.stages, ...derivedStages]);
  return normalized;
}
function normalizeStages(stages) {
  const seen = new Set();
  return stages
    .map((stage, index) => typeof stage === "object" ? stage : {id:String(stage), name:String(stage), order:index + 1})
    .filter(stage => {
      if (!stage.id || seen.has(String(stage.id))) return false;
      seen.add(String(stage.id));
      return true;
    })
    .map((stage, index) => ({id:String(stage.id), name:String(stage.name || stage.id), order:Number(stage.order) || index + 1}))
    .sort((a,b)=>a.order - b.order || a.name.localeCompare(b.name));
}
function compKey(c) {
  return `${c.side}:${c.ref}`;
}
function componentByKey(key) {
  return project.components.find(c => compKey(c) === key);
}
function isDone(c) {
  return !!project.doneMap[compKey(c)];
}
function verificationUnits(c) {
  return verificationUnitsForRef(c?.ref);
}
function verificationRecord(c) {
  const saved = project.verificationMap[compKey(c)];
  return normalizeVerificationRecord(saved);
}
function isVerified(c) {
  return verificationRecord(c).checked === true;
}
function componentTolerance(c) {
  const explicit = parseVerificationTolerance(c?.tolerance, true);
  return explicit ?? parseVerificationTolerance(c?.value);
}
function componentReference(c, record = verificationRecord(c)) {
  const parsed = parseVerificationNominal(c?.value, c?.ref);
  if (parsed.valid) return {...parsed, source:"bom"};
  const baseValue = record.referenceValue === null || record.referenceValue === undefined
    ? null
    : parseVerificationNominal(`${record.referenceValue} ${record.referenceUnit}`, c?.ref).baseValue;
  if (baseValue !== null && Number.isFinite(baseValue)) {
    return {
      valid:true,
      value:record.referenceValue,
      unit:record.referenceUnit,
      baseValue,
      source:"manual"
    };
  }
  return {valid:false, value:null, unit:"", baseValue:null, source:"missing"};
}
function verificationControl(c, record = verificationRecord(c)) {
  const reference = componentReference(c, record);
  return calculateVerificationControl({
    actualValue:record.actualValue,
    actualUnit:record.unit,
    referenceValue:reference.valid ? reference.value : null,
    referenceUnit:reference.valid ? reference.unit : "",
    tolerancePercent:componentTolerance(c)
  });
}
function verificationRow(c) {
  const record = verificationRecord(c);
  return {
    checked:record.checked,
    status:verificationControl(c, record).status,
    comment:record.comment
  };
}
function verificationStatusLabel(status) {
  return ({
    no_measurement:"Нет измерения",
    not_comparable:"Сравнение невозможно",
    no_tolerance:"Без допуска",
    in_tolerance:"В допуске",
    out_of_tolerance:"Вне допуска"
  })[status] || "Сравнение невозможно";
}
function renderVerificationResult(c, record = verificationRecord(c)) {
  const control = verificationControl(c, record);
  const details = [];
  if (Number.isFinite(control.deltaBase)) {
    const sign = control.deltaBase > 0 ? "+" : "";
    details.push(`<span>Отклонение: <strong>${sign}${escapeHtml(formatVerificationBaseValue(control.deltaBase, c.ref, record.unit))}</strong></span>`);
  }
  if (Number.isFinite(control.percentDelta)) {
    const sign = control.percentDelta > 0 ? "+" : "";
    details.push(`<span>В процентах: <strong>${sign}${escapeHtml(formatVerificationNumber(control.percentDelta))} %</strong></span>`);
  }
  if (Number.isFinite(control.lowerBase) && Number.isFinite(control.upperBase)) {
    const reference = componentReference(c, record);
    details.push(`<span>Допустимый диапазон: <strong>${escapeHtml(formatVerificationBaseValue(control.lowerBase, c.ref, reference.unit))} — ${escapeHtml(formatVerificationBaseValue(control.upperBase, c.ref, reference.unit))}</strong></span>`);
  }
  verificationResult.className = `verificationResult ${control.status}`;
  verificationResult.innerHTML = `
    <div class="verificationResultHead">
      <strong>Результат контроля</strong>
      <span class="verificationResultBadge">${verificationStatusLabel(control.status)}</span>
    </div>
    ${details.length ? `<div class="verificationResultDetails">${details.join("")}</div>` : ""}
  `;
}
function setVerificationSaveStatus(text, tone = "") {
  if (!verificationSaveStatus || verificationModal.hidden) return;
  verificationSaveStatus.textContent = text;
  verificationSaveStatus.className = tone;
}
function saveVerificationDraft() {
  const c = componentByKey(verificationKey);
  if (!c) return false;
  const units = verificationUnits(c);
  const parsed = parseVerificationNumber(verificationActualValue.value);
  const parsedReference = parseVerificationNumber(verificationReferenceValue.value);
  const numericSupported = units.length > 0;
  const bomReference = parseVerificationNominal(c.value, c.ref);
  const manualReferenceNeeded = numericSupported && !bomReference.valid;
  const actualValid = !numericSupported || parsed.valid;
  const referenceValid = !manualReferenceNeeded || parsedReference.valid;
  verificationActualValue.classList.toggle("inputError", !actualValid);
  verificationActualError.hidden = actualValid;
  verificationReferenceValue.classList.toggle("inputError", !referenceValid);
  verificationReferenceError.hidden = referenceValid;
  const previous = verificationRecord(c);
  const record = {
    checked: verificationChecked.checked,
    actualValue: previous.actualValue ?? null,
    unit: previous.unit || "",
    comment: String(verificationComment.value || ""),
    referenceValue: previous.referenceValue ?? null,
    referenceUnit: previous.referenceUnit || ""
  };
  if (!numericSupported) {
    record.actualValue = null;
    record.unit = "";
  } else if (actualValid) {
    record.actualValue = parsed.value;
    record.unit = !parsed.empty ? (units.includes(verificationUnit.value) ? verificationUnit.value : units[0]) : "";
  }
  if (manualReferenceNeeded && referenceValid) {
    record.referenceValue = parsedReference.value;
    record.referenceUnit = !parsedReference.empty
      ? (units.includes(verificationReferenceUnit.value) ? verificationReferenceUnit.value : units[0])
      : "";
  }
  project.verificationMap[verificationKey] = record;
  const allValid = actualValid && referenceValid;
  setVerificationSaveStatus(allValid ? "Сохранение…" : "Некорректное значение не сохранено", allValid ? "" : "error");
  scheduleSave();
  renderVerificationResult(c, record);
  renderList();
  renderHotspots();
  renderVerificationOverview();
  return allValid;
}
function openVerification(c) {
  if (!c) return;
  hideComponentContextMenu();
  verificationKey = compKey(c);
  const record = verificationRecord(c);
  const units = verificationUnits(c);
  const bomReference = parseVerificationNominal(c.value, c.ref);
  const tolerance = componentTolerance(c);
  verificationTitle.textContent = c.ref;
  verificationBomValue.textContent = c.value || "Не указан";
  verificationTolerance.textContent = tolerance === null ? "Не задан" : `±${formatVerificationNumber(tolerance)} %`;
  verificationNumeric.hidden = units.length === 0;
  verificationUnsupported.hidden = units.length > 0;
  verificationManualReference.hidden = units.length === 0 || bomReference.valid;
  verificationUnit.innerHTML = units.map(unit => `<option value="${escapeHtml(unit)}">${escapeHtml(unit)}</option>`).join("");
  verificationReferenceUnit.innerHTML = units.map(unit => `<option value="${escapeHtml(unit)}">${escapeHtml(unit)}</option>`).join("");
  verificationActualValue.value = record.actualValue === null || record.actualValue === undefined ? "" : String(record.actualValue).replace(".", ",");
  verificationUnit.value = units.includes(record.unit) ? record.unit : (units[0] || "");
  verificationReferenceValue.value = record.referenceValue === null || record.referenceValue === undefined ? "" : String(record.referenceValue).replace(".", ",");
  verificationReferenceUnit.value = units.includes(record.referenceUnit) ? record.referenceUnit : (units[0] || "");
  verificationComment.value = record.comment || "";
  verificationChecked.checked = record.checked === true;
  verificationActualValue.classList.remove("inputError");
  verificationActualError.hidden = true;
  verificationReferenceValue.classList.remove("inputError");
  verificationReferenceError.hidden = true;
  verificationSaveStatus.textContent = "";
  verificationSaveStatus.className = "";
  renderVerificationResult(c, record);
  verificationModal.hidden = false;
  (units.length && !bomReference.valid ? verificationReferenceValue : (units.length ? verificationActualValue : verificationComment)).focus();
}
function closeVerification() {
  if (verificationModal.hidden) return;
  saveVerificationDraft();
  if (!verificationActualError.hidden || !verificationReferenceError.hidden) {
    const c = componentByKey(verificationKey);
    const record = c ? verificationRecord(c) : {};
    verificationActualValue.value = record.actualValue === null || record.actualValue === undefined ? "" : String(record.actualValue).replace(".", ",");
    verificationReferenceValue.value = record.referenceValue === null || record.referenceValue === undefined ? "" : String(record.referenceValue).replace(".", ",");
    verificationActualValue.classList.remove("inputError");
    verificationReferenceValue.classList.remove("inputError");
    verificationActualError.hidden = true;
    verificationReferenceError.hidden = true;
  }
  verificationModal.hidden = true;
  verificationKey = "";
  renderAll();
}
function showComponentContextMenu(ev, c) {
  ev.preventDefault();
  contextComponentKey = compKey(c);
  componentContextMenu.hidden = false;
  const width = 220;
  const height = 48;
  componentContextMenu.style.left = `${Math.min(ev.clientX, window.innerWidth - width - 8)}px`;
  componentContextMenu.style.top = `${Math.min(ev.clientY, window.innerHeight - height - 8)}px`;
  contextVerificationBtn.focus();
}
function hideComponentContextMenu() {
  componentContextMenu.hidden = true;
  contextComponentKey = "";
}
function pushUndoState() {
  if (!project) return;
  undoStack.push({project:cloneData(project), selectedKey, currentSide});
  redoStack = [];
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
}
function undoLastChange() {
  const state = undoStack.pop();
  if (!state) return;
  redoStack.push({project:cloneData(project), selectedKey, currentSide});
  if (redoStack.length > MAX_HISTORY) redoStack.shift();
  project = state.project;
  selectedKey = state.selectedKey;
  currentSide = state.currentSide;
  scheduleSave();
  setSide(currentSide);
  renderAll();
}
function redoLastChange() {
  const state = redoStack.pop();
  if (!state) return;
  undoStack.push({project:cloneData(project), selectedKey, currentSide});
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  project = state.project;
  selectedKey = state.selectedKey;
  currentSide = state.currentSide;
  scheduleSave();
  setSide(currentSide);
  renderAll();
}
function isEditableTextTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}
function setSaveStatus(text) {
  if (!project) return;
  const top = project.images.TOP ? "TOP выбран" : "TOP не выбран";
  const bottom = project.images.BOTTOM ? "BOTTOM выбран" : "BOTTOM не выбран";
  projectStatus.textContent = `Проект: ${project.name}\nИзображения: ${top}, ${bottom}\nКомпонентов: ${project.components.length}. ${text}`;
  projectStatus.title = projectStatus.textContent;
}
async function saveProjectNow() {
  if (!projectHandle || !project) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    setSaveStatus("Сохранение...");
    if (isElectronApp()) {
      await window.projectApi.writeProject(projectHandle.path, project);
      setSaveStatus("Автосохранено.");
      if (verificationActualError.hidden && verificationReferenceError.hidden) setVerificationSaveStatus("Сохранено", "saved");
      return;
    }
    const fileHandle = await projectHandle.getFileHandle(PROJECT_FILE, {create:true});
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(project, null, 2));
    await writable.close();
    setSaveStatus("Автосохранено.");
    if (verificationActualError.hidden && verificationReferenceError.hidden) setVerificationSaveStatus("Сохранено", "saved");
  } catch(e) {
    console.error(e);
    setSaveStatus("Ошибка автосохранения.");
    setVerificationSaveStatus("Ошибка сохранения", "error");
  }
}
function scheduleSave() {
  setSaveStatus("Есть изменения.");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveProjectNow, 350);
}
async function readProjectFile(handle) {
  const fileHandle = await handle.getFileHandle(PROJECT_FILE);
  const file = await fileHandle.getFile();
  return JSON.parse(await file.text());
}
async function openProjectDirectory(directory) {
  projectHandle = directory;
      project = normalizeProject(await window.projectApi.readProject(directory.path), directory.name);
      selectedKey = "";
      undoStack = [];
      redoStack = [];
  await loadProjectImages();
  await openWorkspace();
  scheduleSave();
}
async function loadProjectCards() {
  if (!isElectronApp()) {
    projectList.innerHTML = `<div class="projectShelfEmpty">Откройте проект через папку.</div>`;
    projectRootPath.textContent = "";
    return;
  }
  try {
    const result = await window.projectApi.listProjects();
    projectRootPath.textContent = `Папка проектов: ${result.rootPath}`;
    if (!result.projects.length) {
      projectList.innerHTML = `<div class="projectShelfEmpty">Проектов пока нет. Создайте первый проект выше.</div>`;
      return;
    }
    projectList.innerHTML = result.projects.map(item => `
      <div class="projectCard" role="button" tabindex="0" data-path="${escapeHtml(item.path)}" data-name="${escapeHtml(item.name)}">
        <span class="projectCardIcon" aria-hidden="true"></span>
        <span class="projectCardText">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.folderName || item.path)}</span>
        </span>
        <button class="projectDeleteBtn" type="button" title="Удалить проект" aria-label="Удалить проект ${escapeHtml(item.name)}">×</button>
      </div>
    `).join("");
  } catch(e) {
    console.error(e);
    projectRootPath.textContent = "";
    projectList.innerHTML = `<div class="projectShelfEmpty">Не удалось загрузить список проектов.</div>`;
  }
}
async function createProject() {
  if (!ensureFileSystemAccess()) return;
  if (isElectronApp()) {
    enforceInputLimit(newProjectName, MAX_PROJECT_NAME, "Название проекта");
    const projectName = truncateText(newProjectName.value, MAX_PROJECT_NAME) || "Новый проект";
    const directory = await window.projectApi.createProjectFolder(projectName);
    projectHandle = directory;
    project = createBlankProject(directory.name);
    project.name = projectName;
    selectedKey = "";
    undoStack = [];
    redoStack = [];
    await saveProjectNow();
    await loadProjectCards();
    await openWorkspace();
    newProjectName.value = "";
    return;
  }
  projectHandle = await showDirectoryPicker({mode:"readwrite"});
  project = createBlankProject(projectHandle.name);
  selectedKey = "";
  undoStack = [];
  redoStack = [];
  await saveProjectNow();
  await openWorkspace();
}
async function openProject() {
  if (!ensureFileSystemAccess()) return;
  if (isElectronApp()) {
    await openProjectPicker();
    return;
  }
  try {
    projectHandle = await showDirectoryPicker({mode:"readwrite"});
    project = normalizeProject(await readProjectFile(projectHandle), projectHandle.name);
    selectedKey = "";
    undoStack = [];
    redoStack = [];
    await loadProjectImages();
    await openWorkspace();
    scheduleSave();
  } catch(e) {
    console.error(e);
    notify(`В выбранной папке не найден ${PROJECT_FILE} или файл поврежден.`, "warning");
  }
}
async function loadProjectImages() {
  revokeImageUrls();
  for (const side of SIDES) {
    const image = project.images[side];
    imageUrls[side] = "";
    if (!image?.file) continue;
    try {
      if (isElectronApp()) {
        imageUrls[side] = await window.projectApi.imageUrl(projectHandle.path, image.file);
        continue;
      }
      const fileHandle = await projectHandle.getFileHandle(image.file);
      const file = await fileHandle.getFile();
      imageUrls[side] = URL.createObjectURL(file);
    } catch(e) {
      console.warn(`Image not found for ${side}`, e);
    }
  }
}
function revokeImageUrls() {
  SIDES.forEach(side => {
    if (imageUrls[side] && !imageUrls[side].startsWith("file:")) URL.revokeObjectURL(imageUrls[side]);
    imageUrls[side] = "";
  });
}
async function openWorkspace() {
  document.body.classList.add("project-open");
  search.value = "";
  stageFilter.value = "";
  groupFilter.value = "";
  topFile.value = "";
  bottomFile.value = "";
  currentSide = "TOP";
  setMode("editor");
  setSide("TOP");
  renderAll();
  setSaveStatus("Автосохранено.");
}
async function closeWorkspaceToProjects() {
  if (project) await saveProjectNow();
  document.body.classList.remove("project-open", "editor-mode", "solder-mode");
  markMode = false;
  selectedKey = "";
  project = null;
  projectHandle = null;
  undoStack = [];
  redoStack = [];
  revokeImageUrls();
  await loadProjectCards();
}
function setMode(mode) {
  appMode = mode;
  markMode = false;
  markModeBtn.textContent = "Добавить элементы";
  markModeBtn.classList.remove("active");
  document.body.classList.toggle("editor-mode", mode === "editor");
  document.body.classList.toggle("solder-mode", mode === "solder");
  modeTitle.textContent = mode === "editor" ? "Редактор проекта" : "Пайка по монтажной карте";
  modeHint.textContent = mode === "editor"
    ? "Выберите изображения, создайте группы, расставьте элементы и заполните поля."
    : "Отмечайте компоненты как припаянные в порядке этапов.";
  renderAll();
}
function setSide(side) {
  currentSide = side;
  btnTop.classList.toggle("active", side === "TOP");
  btnBottom.classList.toggle("active", side === "BOTTOM");
  syncBoardImage();
  renderHotspots();
}
function syncBoardImage() {
  const size = project?.imageSizes?.[currentSide] || DEFAULT_IMAGE_SIZES[currentSide];
  board.style.width = `${size.w}px`;
  board.style.height = `${size.h}px`;
  boardImg.style.width = `${size.w}px`;
  boardImg.style.height = `${size.h}px`;
  if (imageUrls[currentSide]) {
    board.classList.remove("empty");
    boardImg.src = imageUrls[currentSide];
  } else {
    board.classList.add("empty");
    boardImg.removeAttribute("src");
  }
  applyZoom();
}
function applyZoom() {
  if (!project) return;
  const availableW = Math.max(boardwrap.clientWidth - 18, 320);
  const availableH = Math.max(boardwrap.clientHeight - 18, 240);
  const size = project.imageSizes[currentSide] || DEFAULT_IMAGE_SIZES[currentSide];
  const z = Math.min(1.8, availableW / size.w, availableH / size.h);
  const scaledW = Math.ceil(size.w * z);
  const scaledH = Math.ceil(size.h * z);
  boardwrap.style.maxWidth = "100%";
  board.style.transform = `scale(${z})`;
  board.style.left = `${Math.max(8, (boardwrap.clientWidth - scaledW) / 2)}px`;
  board.style.top = `${Math.max(8, (boardwrap.clientHeight - scaledH) / 2)}px`;
  board.dataset.zoom = String(z);
}
function matches(c) {
  const q = search.value.trim().toLowerCase();
  const st = stageFilter.value;
  const gf = groupFilter.value;
  const hay = `${c.ref} ${c.side} ${c.stage} ${c.group} ${c.value} ${c.note}`.toLowerCase();
  return (!q || hay.includes(q))
    && (!st || String(c.stage) === st)
    && (!gf || c.group === gf)
    && matchesVerificationFilter(verificationRow(c), verificationFilter.value);
}
function visibleComponents() {
  return project.components.filter(matches);
}
function stageName(stageId) {
  return project.stages.find(stage => stage.id === String(stageId))?.name || "Без этапа";
}
function stageOrder(stageId) {
  return project.stages.find(stage => stage.id === String(stageId))?.order || 9999;
}
function updateStageFilterOptions() {
  const selected = stageFilter.value;
  stageFilter.innerHTML = `<option value="">Все этапы</option>` + project.stages.map(stage => `<option value="${escapeHtml(stage.id)}">${escapeHtml(stage.name)}</option>`).join("");
  stageFilter.value = project.stages.some(stage => stage.id === selected) ? selected : "";
}
function updateGroupFilterOptions() {
  const selected = groupFilter.value;
  groupFilter.innerHTML = `<option value="">Все группы</option>` + project.groups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  groupFilter.value = project.groups.includes(selected) ? selected : "";
}
function renderGroups() {
  groupList.innerHTML = project.groups.length
    ? project.groups.map(g => `<span class="groupChip">${escapeHtml(g)}<button type="button" class="chipDelete" data-group="${escapeHtml(g)}" title="Удалить группу">×</button></span>`).join("")
    : `<div class="emptyLine">Группы пока не созданы.</div>`;
}
function renderStages() {
  stageList.innerHTML = project.stages.length
    ? project.stages.map(stage => `<span class="groupChip">${escapeHtml(stage.name)}<button type="button" class="chipDelete" data-stage="${escapeHtml(stage.id)}" title="Удалить этап">×</button></span>`).join("")
    : `<div class="emptyLine">Этапы пока не созданы.</div>`;
}
function renderFilePickers() {
  const topName = project.images.TOP?.originalName || project.images.TOP?.file || "";
  const bottomName = project.images.BOTTOM?.originalName || project.images.BOTTOM?.file || "";
  topFileMeta.textContent = topName || "Выбрать изображение";
  bottomFileMeta.textContent = bottomName || "Выбрать изображение";
  topFilePicker.classList.toggle("hasFile", Boolean(topName));
  bottomFilePicker.classList.toggle("hasFile", Boolean(bottomName));
}
function renderVerificationOverview() {
  const summary = summarizeVerification(project.components.map(verificationRow));
  const metrics = [
    ["Всего", summary.total, ""],
    ["Проверено", summary.verified, ""],
    ["В допуске", summary.inTolerance, "in_tolerance"],
    ["Вне допуска", summary.outOfTolerance, "out_of_tolerance"],
    ["Без допуска", summary.noTolerance, ""],
    ["С комментариями", summary.comments, ""]
  ];
  verificationOverview.innerHTML = metrics.map(([label, value, tone]) => `
    <div class="verificationMetric ${tone}">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `).join("");
}
function renderHotspots() {
  board.querySelectorAll(".hotspot").forEach(e => e.remove());
  if (!project) return;
  project.components.filter(c => c.side === currentSide && matches(c)).forEach(c => {
    const d = document.createElement("div");
    d.className = "hotspot stage" + c.stage + (isDone(c) ? " done" : "") + (selectedKey === compKey(c) ? " active" : "");
    d.dataset.ref = c.ref;
    d.dataset.side = c.side;
    Object.assign(d.style, {left:`${c.x}px`, top:`${c.y}px`, width:`${c.w}px`, height:`${c.h}px`});
    d.title = `${c.ref} - ${c.value || ""}`;
    d.innerHTML = `<span class="tag">${escapeHtml(c.ref)}</span>${isVerified(c) ? `<span class="verificationMark" title="Проверен" aria-label="Проверен">✓</span>` : ""}<span class="resizeHandle" aria-hidden="true"></span>`;
    d.addEventListener("mousedown", ev => startGeometryEdit(ev, c, d));
    d.addEventListener("click", ev => {
      ev.stopPropagation();
      if (ev.detail >= 2) {
        openVerification(c);
        return;
      }
      selectedKey = compKey(c);
      renderAll();
      selectRef(c.ref, c.side);
    });
    d.addEventListener("contextmenu", ev => showComponentContextMenu(ev, c));
    board.appendChild(d);
  });
}
function renderInspector() {
  if (appMode !== "editor") return;
  const c = componentByKey(selectedKey);
  if (!c) {
    componentInspector.innerHTML = `<div class="inspectorEmpty">Выберите компонент на плате или в списке, чтобы отредактировать его параметры.</div>`;
    return;
  }
  const groupOptions = [`<option value="">Без группы</option>`]
    .concat(project.groups.map(g => `<option value="${escapeHtml(g)}" ${c.group === g ? "selected" : ""}>${escapeHtml(g)}</option>`))
    .join("");
  const stageOptions = [`<option value="">Без этапа</option>`]
    .concat(project.stages.map(stage => `<option value="${escapeHtml(stage.id)}" ${String(c.stage) === stage.id ? "selected" : ""}>${escapeHtml(stage.name)}</option>`))
    .join("");
  componentInspector.innerHTML = `<form class="inspectorForm" data-key="${escapeHtml(compKey(c))}">
    <div class="inspectorHead">
      <div><div class="eyebrow">Компонент</div><strong>${escapeHtml(c.ref)}</strong></div>
      <button class="deleteCompBtn dangerBtn" type="button">Удалить</button>
    </div>
    <label>Обозначение<input name="ref" autocomplete="off" value="${escapeHtml(c.ref)}"></label>
    <div class="grid2">
      <label>Сторона<select name="side"><option value="TOP" ${c.side === "TOP" ? "selected" : ""}>TOP</option><option value="BOTTOM" ${c.side === "BOTTOM" ? "selected" : ""}>BOTTOM</option></select></label>
      <label>Номинал / деталь<input name="value" autocomplete="off" placeholder="100 нФ, STM32..." value="${escapeHtml(c.value)}"></label>
    </div>
    <label>Группа<select name="group">${groupOptions}</select></label>
    <label>Этап пайки<select name="stage">${stageOptions}</select></label>
    <label class="doneToggle"><input name="done" type="checkbox" value="1" ${isDone(c) ? "checked" : ""}> Припаяно</label>
    <label>Комментарий<textarea name="note" placeholder="Что важно проверить при пайке">${escapeHtml(c.note)}</textarea></label>
    <details class="geometryPanel">
      <summary>Положение на изображении</summary>
      <div class="grid4">
        <label>X<input name="x" type="number" value="${escapeHtml(c.x)}"></label>
        <label>Y<input name="y" type="number" value="${escapeHtml(c.y)}"></label>
        <label>W<input name="w" type="number" min="1" value="${escapeHtml(c.w)}"></label>
        <label>H<input name="h" type="number" min="1" value="${escapeHtml(c.h)}"></label>
      </div>
    </details>
    <div class="autoSaveNote">Поля сохраняются автоматически.</div>
  </form>`;
}
function renderList() {
  updateStageFilterOptions();
  updateGroupFilterOptions();
  list.innerHTML = "";
  const shown = visibleComponents();
  const byStage = {};
  shown.forEach(c => {
    if (!byStage[c.stage]) byStage[c.stage] = [];
    byStage[c.stage].push(c);
  });
  Object.keys(byStage).sort((a,b)=>stageOrder(a)-stageOrder(b) || stageName(a).localeCompare(stageName(b))).forEach(st => {
    const title = document.createElement("div");
    title.className = "stageTitle";
    title.textContent = stageName(st);
    list.appendChild(title);
    byStage[st].forEach(c => {
      const card = document.createElement("div");
      card.className = "card" + (isDone(c) ? " done" : "") + (selectedKey === compKey(c) ? " active" : "");
      card.dataset.ref = c.ref;
      card.dataset.side = c.side;
      const solderButton = appMode === "solder" ? `<button class="solderBtn ${isDone(c) ? "done" : ""}" type="button">${isDone(c) ? "✓ Припаяно" : "○ Не припаяно"}</button>` : "";
      const record = verificationRecord(c);
      const control = verificationControl(c, record);
      const actualValue = record.actualValue === null || record.actualValue === undefined ? "" : `${record.actualValue} ${record.unit || ""}`.trim();
      card.innerHTML = `<div class="ref">${escapeHtml(c.ref)}</div><div class="meta">${escapeHtml(c.side)} · ${escapeHtml(c.group || "Без группы")} · ${escapeHtml(c.value || "Без номинала")}</div><div class="verificationSummaryRow"><div class="verificationSummary ${isVerified(c) ? "verified" : ""}">${isVerified(c) ? "✓ Проверен" : "○ Не проверен"}${actualValue ? ` · ${escapeHtml(actualValue)}` : ""}</div><span class="verificationControlBadge ${control.status}">${verificationStatusLabel(control.status)}</span></div>${record.comment ? `<div class="verificationComment">${escapeHtml(record.comment)}</div>` : ""}<div class="note">${escapeHtml(c.note)}</div><button class="verificationBtn" type="button">Проверка</button>${solderButton}`;
      card.addEventListener("click", ev => {
        if (ev.target.closest("button")) return;
        selectedKey = compKey(c);
        renderAll();
        selectRef(c.ref, c.side);
      });
      const solderBtn = card.querySelector(".solderBtn");
      if (solderBtn) solderBtn.addEventListener("click", ev => {
        ev.stopPropagation();
        setDone(c, !isDone(c));
      });
      card.querySelector(".verificationBtn").addEventListener("click", ev => {
        ev.stopPropagation();
        openVerification(c);
      });
      card.addEventListener("contextmenu", ev => showComponentContextMenu(ev, c));
      list.appendChild(card);
    });
  });
  updateProgress();
}
function renderAll() {
  if (!project) return;
  renderFilePickers();
  renderStages();
  renderGroups();
  renderVerificationOverview();
  renderList();
  renderHotspots();
  renderInspector();
  setSaveStatus(saveTimer ? "Есть изменения." : "Автосохранено.");
}
function updateProgress() {
  const shown = visibleComponents();
  const done = shown.filter(isDone).length;
  const total = shown.length;
  const percent = total ? Math.round(done * 100 / total) : 0;
  document.getElementById("progressText").innerHTML = `<b>Припаяно:</b> ${done} / ${total} (${percent}%)`;
  document.getElementById("progressFill").style.width = `${percent}%`;
}
function selectRef(ref, side) {
  if (side !== currentSide) setSide(side);
  document.querySelectorAll(".hotspot,.card").forEach(e => e.classList.remove("active"));
  document.querySelectorAll(`[data-ref="${CSS.escape(ref)}"][data-side="${CSS.escape(side)}"]`).forEach(e => e.classList.add("active"));
  document.querySelector(`.card[data-ref="${CSS.escape(ref)}"][data-side="${CSS.escape(side)}"]`)?.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
}
function boardPoint(ev) {
  const rect = board.getBoundingClientRect();
  const size = project.imageSizes[currentSide] || DEFAULT_IMAGE_SIZES[currentSide];
  return {
    x: Math.max(0, Math.min(size.w, Math.round((ev.clientX - rect.left) * size.w / rect.width))),
    y: Math.max(0, Math.min(size.h, Math.round((ev.clientY - rect.top) * size.h / rect.height)))
  };
}
function drawDraftBox(a, b) {
  if (!draftBox) {
    draftBox = document.createElement("div");
    draftBox.className = "hotspot active";
    board.appendChild(draftBox);
  }
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.max(1, Math.abs(a.x - b.x));
  const h = Math.max(1, Math.abs(a.y - b.y));
  Object.assign(draftBox.style, {left:`${x}px`, top:`${y}px`, width:`${w}px`, height:`${h}px`});
}
function startGeometryEdit(ev, c, element) {
  if (appMode !== "editor" || ev.button !== 0) return;
  ev.preventDefault();
  ev.stopPropagation();
  selectedKey = compKey(c);
  const rect = element.getBoundingClientRect();
  const mode = ev.clientX >= rect.right - 14 && ev.clientY >= rect.bottom - 14 ? "resize" : "move";
  pushUndoState();
  activeGeometryEdit = {
    c,
    element,
    mode,
    start:boardPoint(ev),
    original:{x:c.x, y:c.y, w:c.w, h:c.h}
  };
  element.classList.add("active");
  renderInspector();
}
function applyGeometryEdit(point) {
  if (!activeGeometryEdit) return;
  const {c, element, mode, start, original} = activeGeometryEdit;
  const size = project.imageSizes[c.side] || DEFAULT_IMAGE_SIZES[c.side];
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  if (mode === "resize") {
    c.w = Math.max(12, Math.min(size.w - c.x, original.w + dx));
    c.h = Math.max(12, Math.min(size.h - c.y, original.h + dy));
  } else {
    c.x = Math.max(0, Math.min(size.w - c.w, original.x + dx));
    c.y = Math.max(0, Math.min(size.h - c.h, original.y + dy));
  }
  Object.assign(element.style, {left:`${c.x}px`, top:`${c.y}px`, width:`${c.w}px`, height:`${c.h}px`});
}
function nextRef(side) {
  return (side === "TOP" ? "T" : "B") + (project.components.filter(c => c.side === side).length + 1);
}
function addComponentFromBox(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const rawW = Math.abs(a.x - b.x);
  const rawH = Math.abs(a.y - b.y);
  if (rawW < MIN_COMPONENT_SIZE || rawH < MIN_COMPONENT_SIZE || rawW * rawH < MIN_COMPONENT_AREA) {
    notify("Выделите область компонента крупнее.", "warning");
    return;
  }
  const w = Math.max(MIN_COMPONENT_SIZE, rawW);
  const h = Math.max(MIN_COMPONENT_SIZE, rawH);
  pushUndoState();
  const c = {ref: nextRef(currentSide), side: currentSide, stage: project.stages[0]?.id || "", group: "", value: "", x, y, w, h, note: ""};
  project.components.push(c);
  selectedKey = compKey(c);
  scheduleSave();
  renderAll();
  selectRef(c.ref, c.side);
}
async function saveProjectImage(file, side) {
  if (!file || !projectHandle) return;
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const fileName = `${side.toLowerCase()}.${ext}`;
  const image = new Image();
  const blobUrl = URL.createObjectURL(file);
  image.onload = async () => {
    try {
      if (isElectronApp()) {
        const bytes = await file.arrayBuffer();
        await window.projectApi.saveImage(projectHandle.path, fileName, bytes);
        if (imageUrls[side] && !imageUrls[side].startsWith("file:")) URL.revokeObjectURL(imageUrls[side]);
        imageUrls[side] = await window.projectApi.imageUrl(projectHandle.path, fileName);
        URL.revokeObjectURL(blobUrl);
        project.images[side] = {file:fileName, originalName:file.name};
        project.imageSizes[side] = {w:image.naturalWidth || 1024, h:image.naturalHeight || 768};
        if (currentSide === side) syncBoardImage();
        scheduleSave();
        renderAll();
        return;
      }
      const imageHandle = await projectHandle.getFileHandle(fileName, {create:true});
      const writable = await imageHandle.createWritable();
      await writable.write(file);
      await writable.close();
      if (imageUrls[side] && !imageUrls[side].startsWith("file:")) URL.revokeObjectURL(imageUrls[side]);
      imageUrls[side] = blobUrl;
      project.images[side] = {file:fileName, originalName:file.name};
      project.imageSizes[side] = {w:image.naturalWidth || 1024, h:image.naturalHeight || 768};
      if (currentSide === side) syncBoardImage();
      scheduleSave();
      renderAll();
    } catch(e) {
      URL.revokeObjectURL(blobUrl);
      console.error(e);
      notify("Не удалось сохранить изображение в папку проекта.", "warning");
    }
  };
  image.onerror = () => {
    URL.revokeObjectURL(blobUrl);
    notify("Не удалось прочитать изображение.", "warning");
  };
  image.src = blobUrl;
}
async function saveProjectImageFromPath(sourcePath, originalName, side) {
  if (!sourcePath || !projectHandle) return;
  const ext = (originalName.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const fileName = `${side.toLowerCase()}.${ext}`;
  try {
    const targetPath = `${projectHandle.path}\\${fileName}`;
    if (!isSameFilePath(sourcePath, targetPath)) {
      await window.projectApi.copyImage(projectHandle.path, sourcePath, fileName);
    }
    if (imageUrls[side] && !imageUrls[side].startsWith("file:")) URL.revokeObjectURL(imageUrls[side]);
    imageUrls[side] = await window.projectApi.imageUrl(projectHandle.path, fileName);
    await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        project.images[side] = {file:fileName, originalName};
        project.imageSizes[side] = {w:image.naturalWidth || 1024, h:image.naturalHeight || 768};
        resolve();
      };
      image.onerror = reject;
      image.src = imageUrls[side];
    });
    currentSide = side;
    setSide(side);
    scheduleSave();
    renderAll();
  } catch(e) {
    console.error(e);
    notify(`Не удалось заменить изображение ${side}.`, "warning");
  }
}
function closeImagePicker() {
  imagePickerModal.hidden = true;
  imagePickerGrid.innerHTML = "";
  browserSearch = "";
  browserItems = [];
  browserSearchInput.value = "";
}
async function openImagePicker(side) {
  if (!window.fileBrowserApi) {
    (side === "TOP" ? topFile : bottomFile).click();
    return;
  }
  browserMode = "image";
  imagePickerSide = side;
  openCurrentFolderBtn.hidden = true;
  imagePickerPlaces.hidden = false;
  imagePickerTitle.textContent = `Выберите изображение ${side}`;
  imagePickerModal.hidden = false;
  browserSearchInput.value = "";
  browserSortSelect.value = browserSort;
  const places = await window.fileBrowserApi.places();
  const start = lastImagePickerPath || places[0]?.path || "";
  renderPickerPlaces(places, start);
  await browseImageFolder(start);
}
async function openProjectPicker() {
  if (!window.fileBrowserApi) return;
  browserMode = "project";
  openCurrentFolderBtn.hidden = false;
  imagePickerPlaces.hidden = false;
  imagePickerTitle.textContent = "Выберите папку проекта";
  imagePickerModal.hidden = false;
  browserSearchInput.value = "";
  browserSortSelect.value = browserSort;
  const places = await window.fileBrowserApi.places();
  const start = places.find(place => place.name === "Проекты")?.path || places[0]?.path || "";
  renderPickerPlaces(places, start);
  await browseImageFolder(start);
}
async function browseImageFolder(folderPath) {
  if (!folderPath) return;
  showBrowserLoading();
  try {
    const result = await window.fileBrowserApi.list(folderPath);
    imagePickerPath = result.path;
    if (browserMode === "image") lastImagePickerPath = result.path;
    syncActivePickerPlace(result.path);
    imagePickerParentPath = result.parentPath;
    currentFolderHasProject = Boolean(result.hasProject);
    imagePickerPathText.textContent = result.path;
    imagePickerUpBtn.disabled = !result.parentPath;
    openCurrentFolderBtn.disabled = browserMode === "project" && !currentFolderHasProject;
    openCurrentFolderBtn.textContent = currentFolderHasProject ? "Открыть эту папку" : "Нет project.json";
    browserItems = browserMode === "project" ? result.items.filter(item => item.type === "folder") : result.items;
    renderBrowserItems();
  } catch(e) {
    console.error(e);
    imagePickerGrid.innerHTML = `<div class="imagePickerEmpty">Не удалось открыть папку.</div>`;
  }
}
function renderBrowserItems() {
  const q = browserSearch.trim().toLowerCase();
  let items = browserItems.filter(item => !q || item.name.toLowerCase().includes(q));
  items = items.slice().sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    if (browserSort === "dateDesc") return (b.modifiedAt || 0) - (a.modifiedAt || 0) || a.name.localeCompare(b.name);
    if (browserSort === "dateAsc") return (a.modifiedAt || 0) - (b.modifiedAt || 0) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });
  if (!items.length) {
    imagePickerGrid.innerHTML = `<div class="imagePickerEmpty">${browserSearch ? "Ничего не найдено." : (browserMode === "project" ? "В этой папке нет вложенных папок." : "В этой папке нет изображений.")}</div>`;
    return;
  }
  imagePickerGrid.innerHTML = items.map(item => {
    const preview = item.type === "folder"
      ? `<span class="folderIcon"></span>`
      : item.type === "video"
        ? `<span class="videoIcon"></span>`
        : `<img src="${escapeHtml(item.url)}" alt="">`;
    const previewClass = item.type === "folder" ? "imageTilePreview folderPreview" : item.type === "video" ? "imageTilePreview videoPreview" : "imageTilePreview";
    const badge = item.hasProject ? `<span class="imageTileBadge">Проект</span>` : `<span class="imageTileDate">${escapeHtml(formatDate(item.modifiedAt))}</span>`;
    return `
      <button class="imageTile" type="button" title="${escapeHtml(item.name)}" data-type="${escapeHtml(item.type)}" data-path="${escapeHtml(item.path)}" data-name="${escapeHtml(item.name)}">
        <span class="${previewClass}">${preview}</span>
        <span class="imageTileName">${escapeHtml(item.name)}</span>
        <span class="imageTileKind">${escapeHtml(fileKindLabel(item.type))}</span>
        ${badge}
      </button>
    `;
  }).join("");
}
function updateComponentFromForm(form, shouldRender = true) {
  const c = componentByKey(form.dataset.key);
  if (!c) return;
  const data = new FormData(form);
  const oldKey = compKey(c);
  const doneChecked = data.get("done") === "1";
  c.ref = truncateText(data.get("ref"), MAX_REF_NAME) || c.ref;
  c.side = data.get("side") === "BOTTOM" ? "BOTTOM" : "TOP";
  c.stage = String(data.get("stage") || "");
  c.group = String(data.get("group") || "");
  c.value = String(data.get("value") || "");
  c.note = String(data.get("note") || "");
  c.x = Math.max(0, Number(data.get("x")) || 0);
  c.y = Math.max(0, Number(data.get("y")) || 0);
  c.w = Math.max(1, Number(data.get("w")) || 1);
  c.h = Math.max(1, Number(data.get("h")) || 1);
  if (oldKey !== compKey(c)) {
    delete project.doneMap[oldKey];
    if (project.verificationMap[oldKey]) {
      project.verificationMap[compKey(c)] = project.verificationMap[oldKey];
      delete project.verificationMap[oldKey];
    }
  }
  if (doneChecked) project.doneMap[compKey(c)] = true;
  else delete project.doneMap[compKey(c)];
  selectedKey = compKey(c);
  form.dataset.key = selectedKey;
  scheduleSave();
  if (shouldRender) {
    renderAll();
    selectRef(c.ref, c.side);
  }
}
function setDone(c, val) {
  if (val) project.doneMap[compKey(c)] = true;
  else delete project.doneMap[compKey(c)];
  scheduleSave();
  renderAll();
}
function deleteComponent(c) {
  if (!c) return;
  pushUndoState();
  delete project.doneMap[compKey(c)];
  delete project.verificationMap[compKey(c)];
  project.components.splice(project.components.indexOf(c), 1);
  selectedKey = "";
  scheduleSave();
  renderAll();
}
function addGroup() {
  enforceInputLimit(newGroupName, MAX_GROUP_NAME, "Название группы");
  const name = truncateText(newGroupName.value, MAX_GROUP_NAME);
  if (!name) return;
  if (project.groups.includes(name)) {
    newGroupName.value = "";
    renderAll();
    return;
  }
  pushUndoState();
  project.groups.push(name);
  project.groups.sort((a,b)=>a.localeCompare(b));
  newGroupName.value = "";
  scheduleSave();
  renderAll();
}
function addStage() {
  enforceInputLimit(newStageName, MAX_STAGE_NAME, "Название этапа");
  const name = truncateText(newStageName.value, MAX_STAGE_NAME);
  if (!name) return;
  pushUndoState();
  const baseId = name.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "") || "stage";
  let id = baseId;
  let index = 2;
  while (project.stages.some(stage => stage.id === id)) {
    id = `${baseId}-${index++}`;
  }
  project.stages.push({id, name, order: project.stages.length + 1});
  newStageName.value = "";
  scheduleSave();
  renderAll();
}
function deleteGroup(name) {
  pushUndoState();
  project.groups = project.groups.filter(group => group !== name);
  project.components.forEach(c => {
    if (c.group === name) c.group = "";
  });
  if (groupFilter.value === name) groupFilter.value = "";
  scheduleSave();
  renderAll();
}
function deleteStage(id) {
  const stage = project.stages.find(item => item.id === id);
  if (!stage) return;
  pushUndoState();
  project.stages = project.stages.filter(item => item.id !== id);
  project.components.forEach(c => {
    if (String(c.stage) === id) c.stage = "";
  });
  if (stageFilter.value === id) stageFilter.value = "";
  scheduleSave();
  renderAll();
}
function canStartSoldering() {
  if (!project.images.TOP || !project.images.BOTTOM) {
    notify("Для перехода к пайке выберите изображения TOP и BOTTOM.", "warning");
    return false;
  }
  if (!project.components.length) {
    notify("Для перехода к пайке добавьте хотя бы один компонент.", "warning");
    return false;
  }
  if (!project.stages.length) {
    notify("Для перехода к пайке создайте хотя бы один этап пайки.", "warning");
    return false;
  }
  return true;
}

startOpenProjectBtn.addEventListener("click", openProject);
startNewProjectBtn.addEventListener("click", createProject);
newProjectName.addEventListener("keydown", ev => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    createProject();
  }
});
newProjectName.addEventListener("input", () => enforceInputLimit(newProjectName, MAX_PROJECT_NAME, "Название проекта"));
projectList.addEventListener("click", async ev => {
  const deleteBtn = ev.target.closest(".projectDeleteBtn");
  if (deleteBtn) {
    ev.stopPropagation();
    const cardToDelete = deleteBtn.closest(".projectCard");
    if (!cardToDelete) return;
    const confirmed = await openConfirmDialog({
      title: `Удалить проект "${cardToDelete.dataset.name}"?`,
      text: "Папка проекта и все файлы внутри будут удалены.",
      action: "Удалить"
    });
    if (!confirmed) return;
    try {
      await window.projectApi.deleteProjectFolder(cardToDelete.dataset.path);
      await loadProjectCards();
      newProjectName.focus();
      notify("Проект удален.");
    } catch(e) {
      console.error(e);
      notify("Не удалось удалить проект.", "warning");
    }
    return;
  }
  const card = ev.target.closest(".projectCard");
  if (!card) return;
  try {
    await openProjectDirectory({path:card.dataset.path, name:card.dataset.name});
  } catch(e) {
    console.error(e);
    notify("Не удалось открыть проект. Проверьте project.json в папке проекта.", "warning");
    await loadProjectCards();
  }
});
projectList.addEventListener("keydown", ev => {
  if (ev.key !== "Enter" && ev.key !== " ") return;
  const card = ev.target.closest(".projectCard");
  if (!card || ev.target.closest(".projectDeleteBtn")) return;
  ev.preventDefault();
  card.click();
});
windowMinimizeBtn.addEventListener("click", () => window.windowControls?.minimize());
windowMaximizeBtn.addEventListener("click", () => window.windowControls?.toggleMaximize());
windowCloseBtn.addEventListener("click", () => window.windowControls?.close());
backToProjectsBtn.addEventListener("click", closeWorkspaceToProjects);
saveGoSolderBtn.addEventListener("click", async () => {
  if (!canStartSoldering()) return;
  await saveProjectNow();
  setMode("solder");
});
backToEditorBtn.addEventListener("click", () => setMode("editor"));
btnTop.addEventListener("click", () => setSide("TOP"));
btnBottom.addEventListener("click", () => setSide("BOTTOM"));
resetBtn.addEventListener("click", () => {
  selectedKey = "";
  renderAll();
});
markModeBtn.addEventListener("click", () => {
  if (appMode !== "editor") return;
  if (!imageUrls[currentSide]) {
    notify("Сначала выберите изображение для текущей стороны платы.", "warning");
    return;
  }
  markMode = !markMode;
  markModeBtn.textContent = markMode ? "Добавление включено" : "Добавить элементы";
  markModeBtn.classList.toggle("active", markMode);
});
topFilePicker.addEventListener("click", () => openImagePicker("TOP"));
bottomFilePicker.addEventListener("click", () => openImagePicker("BOTTOM"));
topFile.addEventListener("change", () => saveProjectImage(topFile.files[0], "TOP"));
bottomFile.addEventListener("change", () => saveProjectImage(bottomFile.files[0], "BOTTOM"));
imagePickerCloseBtn.addEventListener("click", closeImagePicker);
imagePickerBackdrop.addEventListener("click", closeImagePicker);
imagePickerUpBtn.addEventListener("click", () => browseImageFolder(imagePickerParentPath));
browserSearchInput.addEventListener("input", () => {
  browserSearch = browserSearchInput.value;
  clearTimeout(browserSearchTimer);
  browserSearchTimer = setTimeout(renderBrowserItems, 80);
});
browserSortSelect.addEventListener("change", () => {
  browserSort = browserSortSelect.value;
  renderBrowserItems();
});
openCurrentFolderBtn.addEventListener("click", async () => {
  if (browserMode !== "project" || !currentFolderHasProject) return;
  try {
    await openProjectDirectory({path:imagePickerPath, name:imagePickerPath.split(/[\\/]/).pop() || "Project"});
    closeImagePicker();
  } catch(e) {
    console.error(e);
    notify("Не удалось открыть проект. Проверьте project.json в выбранной папке.", "warning");
  }
});
imagePickerPlaces.addEventListener("click", ev => {
  const btn = ev.target.closest(".placeBtn");
  if (!btn) return;
  browseImageFolder(btn.dataset.path);
});
imagePickerGrid.addEventListener("click", async ev => {
  const tile = ev.target.closest(".imageTile");
  if (!tile) return;
  if (tile.dataset.type === "folder") {
    await browseImageFolder(tile.dataset.path);
    return;
  }
  if (browserMode !== "image") return;
  if (tile.dataset.type !== "image") {
    notify("Для стороны платы можно выбрать только изображение.", "warning");
    return;
  }
  await saveProjectImageFromPath(tile.dataset.path, tile.dataset.name, imagePickerSide);
  closeImagePicker();
});
clearDoneBtn.addEventListener("click", () => {
  project.doneMap = {};
  scheduleSave();
  renderAll();
});
addStageBtn.addEventListener("click", addStage);
newStageName.addEventListener("keydown", ev => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    addStage();
  }
});
newStageName.addEventListener("input", () => enforceInputLimit(newStageName, MAX_STAGE_NAME, "Название этапа"));
addGroupBtn.addEventListener("click", addGroup);
newGroupName.addEventListener("keydown", ev => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    addGroup();
  }
});
newGroupName.addEventListener("input", () => enforceInputLimit(newGroupName, MAX_GROUP_NAME, "Название группы"));
stageList.addEventListener("click", ev => {
  const btn = ev.target.closest(".chipDelete");
  if (!btn?.dataset.stage) return;
  deleteStage(btn.dataset.stage);
});
groupList.addEventListener("click", ev => {
  const btn = ev.target.closest(".chipDelete");
  if (!btn?.dataset.group) return;
  deleteGroup(btn.dataset.group);
});
[search, stageFilter, groupFilter, verificationFilter].forEach(el => {
  el.addEventListener("input", renderAll);
  el.addEventListener("change", renderAll);
});
componentInspector.addEventListener("submit", ev => {
  if (!ev.target.classList.contains("inspectorForm")) return;
  ev.preventDefault();
  updateComponentFromForm(ev.target);
});
componentInspector.addEventListener("input", ev => {
  const form = ev.target.closest(".inspectorForm");
  if (!form) return;
  updateComponentFromForm(form, false);
});
componentInspector.addEventListener("change", ev => {
  const form = ev.target.closest(".inspectorForm");
  if (!form) return;
  if (ev.target.matches("input[name='ref'], input[name='value'], textarea[name='note']")) {
    updateComponentFromForm(form, false);
    return;
  }
  updateComponentFromForm(form);
});
componentInspector.addEventListener("click", ev => {
  if (!ev.target.classList.contains("deleteCompBtn")) return;
  const form = ev.target.closest(".inspectorForm");
  const c = form && componentByKey(form.dataset.key);
  deleteComponent(c);
});
verificationForm.addEventListener("input", ev => {
  if (ev.target === verificationActualValue || ev.target === verificationReferenceValue || ev.target === verificationComment) {
    saveVerificationDraft();
  }
});
verificationForm.addEventListener("change", saveVerificationDraft);
verificationCloseBtn.addEventListener("click", closeVerification);
verificationDoneBtn.addEventListener("click", closeVerification);
verificationBackdrop.addEventListener("click", closeVerification);
contextVerificationBtn.addEventListener("click", () => {
  const c = componentByKey(contextComponentKey);
  openVerification(c);
});
document.addEventListener("pointerdown", ev => {
  if (!componentContextMenu.hidden && !ev.target.closest(".componentContextMenu")) {
    hideComponentContextMenu();
  }
});
board.addEventListener("mousedown", ev => {
  if (appMode !== "editor" || !markMode || !imageUrls[currentSide] || ev.button !== 0 || ev.target.closest(".hotspot")) return;
  ev.preventDefault();
  dragStart = boardPoint(ev);
  drawDraftBox(dragStart, dragStart);
});
window.addEventListener("mousemove", ev => {
  if (activeGeometryEdit) {
    applyGeometryEdit(boardPoint(ev));
    return;
  }
  if (dragStart) drawDraftBox(dragStart, boardPoint(ev));
});
window.addEventListener("mouseup", ev => {
  if (activeGeometryEdit) {
    applyGeometryEdit(boardPoint(ev));
    const {c, original} = activeGeometryEdit;
    const changed = c.x !== original.x || c.y !== original.y || c.w !== original.w || c.h !== original.h;
    if (!changed) undoStack.pop();
    activeGeometryEdit = null;
    if (changed) scheduleSave();
    renderAll();
    return;
  }
  if (!dragStart) return;
  const end = boardPoint(ev);
  if (draftBox) {
    draftBox.remove();
    draftBox = null;
  }
  addComponentFromBox(dragStart, end);
  dragStart = null;
});
document.getElementById("markVisibleDone").addEventListener("click", () => {
  visibleComponents().forEach(c => project.doneMap[compKey(c)] = true);
  scheduleSave();
  renderAll();
});
document.getElementById("clearVisibleDone").addEventListener("click", () => {
  visibleComponents().forEach(c => delete project.doneMap[compKey(c)]);
  scheduleSave();
  renderAll();
});
window.addEventListener("keydown", ev => {
  if (ev.key === "Escape" && !verificationModal.hidden) {
    ev.preventDefault();
    closeVerification();
    return;
  }
  if (ev.key === "Escape" && !componentContextMenu.hidden) {
    hideComponentContextMenu();
    return;
  }
  if (!project || isEditableTextTarget(ev.target)) return;
  const isUndoKey = ev.code === "KeyZ" || ev.key.toLowerCase() === "z" || ev.key.toLowerCase() === "я";
  if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && isUndoKey) {
    ev.preventDefault();
    redoLastChange();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && isUndoKey) {
    ev.preventDefault();
    undoLastChange();
    return;
  }
  if (ev.key === "Delete" || ev.key === "Backspace") {
    const c = componentByKey(selectedKey);
    if (!c || appMode !== "editor") return;
    ev.preventDefault();
    deleteComponent(c);
  }
});
window.addEventListener("resize", applyZoom);
loadProjectCards();
