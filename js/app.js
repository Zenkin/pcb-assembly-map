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
const {
  buildRows: buildVerificationReportRows
} = window.SolderMapReport;
const {
  parseBom,
  planUpdate: planBomUpdate,
  createBackup: createVerificationBackup,
  compareBackup: compareVerificationBackup,
  restoreBackup: restoreVerificationBackup
} = window.SolderMapBom;
const {
  runDocument: runMatchingDocument
} = window.SolderMapMatchingFormat;
const {
  parsePickAndPlace
} = window.SolderMapPickAndPlace;
const {
  parseRecognition
} = window.SolderMapRecognitionImport;
const {
  resolveResult: resolveMatchingResult
} = window.SolderMapMatchingResolution;
const {
  buildViewModel: buildMatchingViewModel
} = window.SolderMapMatchingView;
const {
  createCalibrationRows,
  fitSideCalibration,
  createApplicationPlan: createMatchingApplicationPlan,
  applyApplicationPlan: applyMatchingApplicationPlan,
  planForSide: matchingPlanForSide,
  skipReasonLabel: matchingSkipReasonLabel
} = window.SolderMapMatchingWorkflow;
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
let pendingBomPlan = null;
let pendingBomSource = null;
let selectedBackupId = "";
let pendingMatchingRun = null;
let pendingMatchingSources = {placement:null, recognition:null};
let matchingWorkflowState = null;

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
const verificationExportStatus = document.getElementById("verificationExportStatus");
const verificationExportButtons = [...document.querySelectorAll("[data-report-format]")];
const bomStatus = document.getElementById("bomStatus");
const importBomBtn = document.getElementById("importBomBtn");
const openBackupsBtn = document.getElementById("openBackupsBtn");
const backupCount = document.getElementById("backupCount");
const bomFileInput = document.getElementById("bomFileInput");
const matchingStatus = document.getElementById("matchingStatus");
const importPlacementBtn = document.getElementById("importPlacementBtn");
const importRecognitionBtn = document.getElementById("importRecognitionBtn");
const runMatchingBtn = document.getElementById("runMatchingBtn");
const placementSourceStatus = document.getElementById("placementSourceStatus");
const recognitionSourceStatus = document.getElementById("recognitionSourceStatus");
const placementFileInput = document.getElementById("placementFileInput");
const recognitionFileInput = document.getElementById("recognitionFileInput");
const importMatchingBtn = document.getElementById("importMatchingBtn");
const matchingFileInput = document.getElementById("matchingFileInput");
const matchingModal = document.getElementById("matchingModal");
const matchingBackdrop = document.getElementById("matchingBackdrop");
const matchingCloseBtn = document.getElementById("matchingCloseBtn");
const matchingSummary = document.getElementById("matchingSummary");
const matchingResults = document.getElementById("matchingResults");
const matchingDetails = document.getElementById("matchingDetails");
const matchingCalibrateBtn = document.getElementById("matchingCalibrateBtn");
const matchingDoneBtn = document.getElementById("matchingDoneBtn");
const matchingWorkflowModal = document.getElementById("matchingWorkflowModal");
const matchingWorkflowBackdrop = document.getElementById("matchingWorkflowBackdrop");
const matchingWorkflowCloseBtn = document.getElementById("matchingWorkflowCloseBtn");
const matchingWorkflowCancelBtn = document.getElementById("matchingWorkflowCancelBtn");
const matchingWorkflowTopBtn = document.getElementById("matchingWorkflowTopBtn");
const matchingWorkflowBottomBtn = document.getElementById("matchingWorkflowBottomBtn");
const matchingResidualLimit = document.getElementById("matchingResidualLimit");
const matchingControlPoints = document.getElementById("matchingControlPoints");
const matchingAddPointBtn = document.getElementById("matchingAddPointBtn");
const matchingFitBtn = document.getElementById("matchingFitBtn");
const matchingCalibrationStatus = document.getElementById("matchingCalibrationStatus");
const matchingPlanSummary = document.getElementById("matchingPlanSummary");
const matchingPreviewSide = document.getElementById("matchingPreviewSide");
const matchingPickHint = document.getElementById("matchingPickHint");
const matchingPreviewViewport = document.getElementById("matchingPreviewViewport");
const matchingPreviewStage = document.getElementById("matchingPreviewStage");
const matchingPreviewImage = document.getElementById("matchingPreviewImage");
const matchingPreviewOverlay = document.getElementById("matchingPreviewOverlay");
const matchingPreviewEmpty = document.getElementById("matchingPreviewEmpty");
const matchingPlanList = document.getElementById("matchingPlanList");
const matchingWorkflowDetails = document.getElementById("matchingWorkflowDetails");
const matchingApplyBtn = document.getElementById("matchingApplyBtn");
const bomModal = document.getElementById("bomModal");
const bomBackdrop = document.getElementById("bomBackdrop");
const bomCloseBtn = document.getElementById("bomCloseBtn");
const bomSummary = document.getElementById("bomSummary");
const bomChangeList = document.getElementById("bomChangeList");
const bomConflictConfirm = document.getElementById("bomConflictConfirm");
const bomConflictCheckbox = document.getElementById("bomConflictCheckbox");
const bomExportOldBtn = document.getElementById("bomExportOldBtn");
const bomCancelBtn = document.getElementById("bomCancelBtn");
const bomApplyBtn = document.getElementById("bomApplyBtn");
const backupsModal = document.getElementById("backupsModal");
const backupsBackdrop = document.getElementById("backupsBackdrop");
const backupsCloseBtn = document.getElementById("backupsCloseBtn");
const backupList = document.getElementById("backupList");
const backupComparison = document.getElementById("backupComparison");
const backupRefs = document.getElementById("backupRefs");
const backupOverwriteCheckbox = document.getElementById("backupOverwriteCheckbox");
const restoreSelectedBtn = document.getElementById("restoreSelectedBtn");
const restoreAllBtn = document.getElementById("restoreAllBtn");
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
    version: 4,
    name: name || "PCB project",
    images: {TOP:null, BOTTOM:null},
    imageSizes: cloneData(DEFAULT_IMAGE_SIZES),
    stages: [],
    groups: [],
    components: [],
    doneMap: {},
    verificationMap: {},
    verificationBackups: [],
    bomMetadata: null
  };
}
function normalizeProject(data, folderName) {
  const normalized = createBlankProject(data?.name || folderName);
  if (data && typeof data === "object") {
    normalized.version = 4;
    normalized.images = Object.assign(normalized.images, data.images || {});
    normalized.imageSizes = Object.assign(normalized.imageSizes, data.imageSizes || {});
    normalized.components = Array.isArray(data.components) ? data.components : [];
    normalized.doneMap = data.doneMap || {};
    normalized.verificationMap = normalizeVerificationMap(data.verificationMap);
    normalized.verificationBackups = Array.isArray(data.verificationBackups)
      ? data.verificationBackups
        .filter(item => item && typeof item === "object" && item.id && item.createdAt)
        .slice(0, 10)
        .map(item => ({
          id:String(item.id),
          createdAt:String(item.createdAt),
          reason:String(item.reason || "Резервная копия"),
          verificationMap:normalizeVerificationMap(item.verificationMap)
        }))
      : [];
    normalized.bomMetadata = data.bomMetadata && typeof data.bomMetadata === "object"
      ? {
        fileName:String(data.bomMetadata.fileName || ""),
        updatedAt:String(data.bomMetadata.updatedAt || "")
      }
      : null;
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
  if (!projectHandle || !project) return false;
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    setSaveStatus("Сохранение...");
    if (isElectronApp()) {
      await window.projectApi.writeProject(projectHandle.path, project);
      setSaveStatus("Автосохранено.");
      if (verificationActualError.hidden && verificationReferenceError.hidden) setVerificationSaveStatus("Сохранено", "saved");
      return true;
    }
    const fileHandle = await projectHandle.getFileHandle(PROJECT_FILE, {create:true});
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(project, null, 2));
    await writable.close();
    setSaveStatus("Автосохранено.");
    if (verificationActualError.hidden && verificationReferenceError.hidden) setVerificationSaveStatus("Сохранено", "saved");
    return true;
  } catch(e) {
    console.error(e);
    setSaveStatus("Ошибка автосохранения.");
    setVerificationSaveStatus("Ошибка сохранения", "error");
    return false;
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
    if (!await saveProjectNow()) {
      notify("Не удалось сохранить новый проект.", "warning");
      return;
    }
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
  pendingMatchingRun = null;
  pendingMatchingSources = {placement:null, recognition:null};
  matchingWorkflowState = null;
  matchingStatus.className = "";
  matchingStatus.textContent = "Исходные данные не выбраны";
  placementSourceStatus.textContent = "Выбрать CSV/TSV";
  recognitionSourceStatus.textContent = "Выбрать JSON/CSV";
  runMatchingBtn.disabled = true;
  matchingCalibrateBtn.disabled = true;
  matchingModal.hidden = true;
  matchingWorkflowModal.hidden = true;
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
  pendingMatchingRun = null;
  pendingMatchingSources = {placement:null, recognition:null};
  matchingWorkflowState = null;
  matchingModal.hidden = true;
  matchingWorkflowModal.hidden = true;
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
async function exportVerificationReport(format) {
  if (!project || !window.projectApi?.exportVerificationReport) {
    notify("Экспорт доступен в настольном приложении SolderMap.", "warning");
    return;
  }
  verificationExportButtons.forEach(button => {
    button.disabled = true;
  });
  verificationExportStatus.className = "";
  verificationExportStatus.textContent = "Подготовка...";
  try {
    if (!await saveProjectNow()) throw new Error("Project save failed before export.");
    const result = await window.projectApi.exportVerificationReport({
      format,
      projectName:project.name,
      rows:buildVerificationReportRows(project)
    });
    if (result?.canceled) {
      verificationExportStatus.textContent = "Отменено";
      return;
    }
    const fileName = String(result?.filePath || "").split(/[\\/]/).pop();
    verificationExportStatus.textContent = fileName ? `Сохранено: ${fileName}` : "Отчёт сохранён";
    notify("Отчёт по проверке сохранён.", "success");
  } catch (error) {
    console.error(error);
    verificationExportStatus.className = "error";
    verificationExportStatus.textContent = "Ошибка экспорта";
    notify("Не удалось сохранить отчёт.", "warning");
  } finally {
    verificationExportButtons.forEach(button => {
      button.disabled = false;
    });
  }
}
function formatBackupDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Дата неизвестна";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle:"short",
    timeStyle:"medium"
  }).format(date);
}
function renderBomState() {
  const backups = project.verificationBackups || [];
  backupCount.textContent = String(backups.length);
  const metadata = project.bomMetadata;
  bomStatus.textContent = metadata?.updatedAt
    ? `${metadata.fileName || "BOM"} · ${formatBackupDate(metadata.updatedAt)}`
    : "BOM ещё не обновлялась";
}
function closeBomModal() {
  bomModal.hidden = true;
  pendingBomPlan = null;
  pendingBomSource = null;
  bomConflictCheckbox.checked = false;
}
function bomChangeLabel(kind) {
  return ({
    added:"Добавлен",
    removed:"Удалён",
    type:"Изменён тип",
    value:"Изменён номинал",
    tolerance:"Изменён допуск",
    type_and_value:"Тип и номинал",
    unchanged:"Без изменений"
  })[kind] || kind;
}
function bomItemText(item) {
  if (!item) return "—";
  const tolerance = item.tolerance === null || item.tolerance === undefined ? "" : ` ±${item.tolerance} %`;
  return `${item.type || "Тип не указан"} · ${item.value || "номинал не указан"}${tolerance}`;
}
function showBomPreview(source) {
  const parsed = parseBom(source.text);
  const plan = planBomUpdate(project.components, parsed.entries, project.verificationMap);
  pendingBomPlan = plan;
  pendingBomSource = {name:String(source.name || "BOM.csv")};
  const counts = plan.changes.reduce((result, change) => {
    result[change.kind] = (result[change.kind] || 0) + 1;
    return result;
  }, {});
  const affected = plan.changes.filter(change => change.kind !== "unchanged").length;
  bomSummary.textContent = [
    `Файл: ${pendingBomSource.name}`,
    `Позиций: ${parsed.entries.length}. Затронуто: ${affected}. Конфликтов: ${plan.conflicts.length}.`,
    `Новые: ${counts.added || 0}; удаляемые: ${counts.removed || 0}; сброс проверок: ${plan.resetRefs.length}.`,
    plan.conflicts.some(conflict => conflict.kind === "duplicate")
      ? "Дубликаты нужно исправить в исходной BOM до применения."
      : ""
  ].filter(Boolean).join("\n");
  const conflicts = new Set(plan.conflicts.map(item => `${item.ref}:${item.kind}`));
  bomChangeList.innerHTML = plan.changes.map(change => {
    const conflict = conflicts.has(`${change.ref}:${change.kind}`) || plan.conflicts.some(item => item.ref === change.ref);
    const reset = plan.resetRefs.includes(change.ref);
    return `<div class="dataChange ${conflict ? "conflict" : ""} ${reset ? "reset" : ""}">
      <strong>${escapeHtml(change.ref)}</strong>
      <span>${escapeHtml(bomChangeLabel(change.kind))}</span>
      <span>${escapeHtml(change.before || change.after
        ? `${bomItemText(change.before)} → ${bomItemText(change.after)}. ${change.label}`
        : change.label)}</span>
    </div>`;
  }).join("") || `<div class="emptyLine">Изменений нет.</div>`;
  if (plan.conflicts.length) {
    bomChangeList.insertAdjacentHTML("afterbegin", plan.conflicts
      .filter(conflict => conflict.kind === "duplicate")
      .map(conflict => `<div class="dataChange conflict"><strong>${escapeHtml(conflict.ref)}</strong><span>Конфликт</span><span>${escapeHtml(conflict.label)}</span></div>`)
      .join(""));
  }
  bomConflictConfirm.hidden = plan.conflicts.length === 0;
  bomConflictCheckbox.checked = false;
  bomApplyBtn.disabled = !plan.changed || plan.conflicts.some(conflict => conflict.kind === "duplicate");
  bomModal.hidden = false;
  bomApplyBtn.focus();
}
async function readBomFromBrowserFile(file) {
  if (!file) return null;
  if (file.size > 10 * 1024 * 1024) throw new Error("Файл BOM больше 10 МБ.");
  return {name:file.name, text:await file.text()};
}
async function selectBom() {
  try {
    if (window.projectApi?.selectBomFile) {
      const source = await window.projectApi.selectBomFile();
      if (source) showBomPreview(source);
      return;
    }
    bomFileInput.click();
  } catch (error) {
    console.error(error);
    notify(error?.message || "Не удалось прочитать BOM.", "warning");
  }
}
function closeMatchingResults() {
  matchingModal.hidden = true;
}
function matchingResolutionControl(row, index) {
  if (row.status === "matched_exact" || row.status === "matched_acceptable") {
    return `<span>Автоматически</span>`;
  }
  if (!row.resolutionCandidates.length) return `<span>Нет применимых кандидатов</span>`;
  return `<select class="matchingResolution ${row.operatorConfirmed ? "confirmed" : ""}"
    data-matching-resolution="${index}" aria-label="Решение для ${escapeHtml(row.ref)}">
    <option value="">Пропустить</option>
    ${row.resolutionCandidates.map(candidate => `
      <option value="${escapeHtml(candidate.id)}"
        ${row.operatorConfirmed && row.selectedFoundId === candidate.id ? "selected" : ""}>
        ${escapeHtml(candidate.id)} · ${matchingNumber(candidate.distance)} мм
      </option>
    `).join("")}
  </select>`;
}
function renderMatchingResults() {
  if (!pendingMatchingRun) return;
  const view = buildMatchingViewModel(
    pendingMatchingRun.sourceName,
    {
      document:pendingMatchingRun.document,
      session:pendingMatchingRun.session
    }
  );
  matchingStatus.className = "";
  matchingStatus.textContent = `${view.sourceName} · применимо ${view.summary.applicable}/${view.summary.total}`;
  matchingSummary.innerHTML = [
    ["Всего", view.summary.total, ""],
    ["Сопоставлено", view.summary.matched, "matched"],
    ["Подтверждено", view.summary.confirmed, "matched"],
    ["Неоднозначно", view.summary.ambiguous, "ambiguous"],
    ["Не найдено", view.summary.unmatched, "unmatched"]
  ].map(([label, value, tone]) => `
    <div class="matchingSummaryItem ${tone}">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `).join("");
  matchingResults.innerHTML = view.rows.map((row, index) => `
    <tr>
      <td><strong>${escapeHtml(row.ref || row.expectedId)}</strong></td>
      <td>${escapeHtml(row.side)}</td>
      <td><span class="matchingStatusBadge ${escapeHtml(row.tone)}">${escapeHtml(row.statusLabel)}</span></td>
      <td>${escapeHtml(row.selectedFoundId || "—")}</td>
      <td>${matchingResolutionControl(row, index)}</td>
    </tr>
  `).join("") || `<tr><td colspan="5">В сеансе нет ожидаемых посадочных мест.</td></tr>`;
  matchingDetails.textContent = [
    `${view.sourceName}`,
    `найденных мест: ${view.foundCount}`,
    `k = ${view.options.radiusScale}`,
    `радиус без геометрии: ${view.options.defaultRadiusMm} мм`
  ].join(" · ");
  matchingCalibrateBtn.disabled = view.summary.applicable === 0;
}
function showMatchingResults(source) {
  const run = runMatchingDocument(source.document ?? source.text);
  pendingMatchingRun = {
    sourceName:String(source.name || "matching-session.json"),
    document:run.document,
    session:run.session
  };
  renderMatchingResults();
  matchingModal.hidden = false;
  matchingDoneBtn.focus();
}
async function readMatchingFromBrowserFile(file) {
  if (!file) return null;
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Файл сеанса больше 10 МБ.");
  }
  return {name:file.name, text:await file.text()};
}
async function selectMatchingSession() {
  const previousStatus = matchingStatus.textContent;
  const previousStatusClass = matchingStatus.className;
  importMatchingBtn.disabled = true;
  matchingStatus.className = "";
  matchingStatus.textContent = "Чтение...";
  try {
    if (window.projectApi?.selectMatchingSessionFile) {
      const source = await window.projectApi.selectMatchingSessionFile();
      if (source) showMatchingResults(source);
      else {
        matchingStatus.className = previousStatusClass;
        matchingStatus.textContent = previousStatus;
      }
      return;
    }
    matchingFileInput.click();
    matchingStatus.className = previousStatusClass;
    matchingStatus.textContent = previousStatus;
  } catch (error) {
    console.error(error);
    matchingStatus.className = "error";
    matchingStatus.textContent = "Ошибка файла";
    notify(error?.message || "Не удалось открыть сеанс сопоставления.", "warning");
  } finally {
    importMatchingBtn.disabled = false;
  }
}
function updateMatchingSourceStatus() {
  const placement = pendingMatchingSources.placement;
  const recognition = pendingMatchingSources.recognition;
  placementSourceStatus.textContent = placement
    ? `${placement.name} · ${placement.expectedFootprints.length}`
    : "Выбрать CSV/TSV";
  recognitionSourceStatus.textContent = recognition
    ? `${recognition.name} · ${recognition.foundFootprints.length}`
    : "Выбрать JSON/CSV";
  runMatchingBtn.disabled = !(placement && recognition);
  if (placement && recognition) {
    matchingStatus.className = "";
    matchingStatus.textContent = "Данные готовы к сопоставлению";
  } else if (placement || recognition) {
    matchingStatus.className = "";
    matchingStatus.textContent = "Выберите второй файл";
  }
}
function useMatchingSource(kind, source) {
  if (!source) return;
  if (kind === "placement") {
    const parsed = parsePickAndPlace(source.text);
    pendingMatchingSources.placement = {
      name:String(source.name || "pick-and-place.csv"),
      expectedFootprints:parsed.expectedFootprints
    };
  } else if (kind === "recognition") {
    const parsed = parseRecognition(source.text);
    pendingMatchingSources.recognition = {
      name:String(source.name || "recognition.json"),
      foundFootprints:parsed.foundFootprints
    };
  } else throw new Error("Неизвестный тип исходного файла.");
  pendingMatchingRun = null;
  updateMatchingSourceStatus();
}
async function readMatchingSourceFromBrowserFile(file) {
  if (!file) return null;
  if (file.size > 10 * 1024 * 1024) throw new Error("Исходный файл больше 10 МБ.");
  return {name:file.name, text:await file.text()};
}
async function selectMatchingSource(kind) {
  const button = kind === "placement" ? importPlacementBtn : importRecognitionBtn;
  const fallbackInput = kind === "placement" ? placementFileInput : recognitionFileInput;
  button.disabled = true;
  try {
    if (window.projectApi?.selectMatchingSourceFile) {
      useMatchingSource(kind, await window.projectApi.selectMatchingSourceFile(kind));
      return;
    }
    fallbackInput.click();
  } catch (error) {
    console.error(error);
    matchingStatus.className = "error";
    matchingStatus.textContent = "Ошибка исходного файла";
    notify(error?.message || "Не удалось прочитать исходный файл.", "warning");
  } finally {
    button.disabled = false;
  }
}
function runImportedMatching() {
  const placement = pendingMatchingSources.placement;
  const recognition = pendingMatchingSources.recognition;
  if (!placement || !recognition) return;
  showMatchingResults({
    name:`${placement.name} + ${recognition.name}`,
    document:{
      format:"soldermap-matching-session",
      version:1,
      units:"mm",
      expectedFootprints:placement.expectedFootprints,
      foundFootprints:recognition.foundFootprints
    }
  });
}
function matchingSides() {
  if (!pendingMatchingRun) return [];
  return SIDES.filter(side => pendingMatchingRun.document.expectedFootprints
    .some(item => item.side === side));
}
function closeMatchingWorkflow(returnToResults = true) {
  matchingWorkflowModal.hidden = true;
  if (returnToResults && pendingMatchingRun) {
    matchingModal.hidden = false;
    matchingCalibrateBtn.focus();
  }
}
function openMatchingWorkflow() {
  if (!project || !pendingMatchingRun) {
    notify("Сначала откройте сеанс сопоставления.", "warning");
    return;
  }
  const sides = matchingSides();
  if (!sides.length) {
    notify("В сеансе нет ожидаемых посадочных мест.", "warning");
    return;
  }
  matchingWorkflowState = {
    side:sides.includes(currentSide) ? currentSide : sides[0],
    rows:Object.fromEntries(SIDES.map(side => [
      side,
      createCalibrationRows(
        pendingMatchingRun.document.expectedFootprints,
        side,
        project.components
      )
    ])),
    calibrations:{},
    plan:null,
    pickingIndex:null,
    calibrationMessages:{TOP:"", BOTTOM:""}
  };
  matchingResidualLimit.value = "2";
  matchingModal.hidden = true;
  matchingWorkflowModal.hidden = false;
  renderMatchingWorkflow();
  matchingFitBtn.focus();
}
function matchingNumber(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("ru-RU", {maximumFractionDigits:3})
    : "—";
}
function matchingFieldValue(value) {
  return value === null || value === undefined ? "" : String(value);
}
function matchingCoordinatePresent(value) {
  return value !== null
    && value !== undefined
    && String(value).trim() !== ""
    && Number.isFinite(Number(value));
}
function matchingRowInput(index, group, axis, value, label) {
  return `<label>${label}
    <input type="number" step="any" inputmode="decimal"
      data-matching-index="${index}" data-matching-group="${group}" data-matching-axis="${axis}"
      value="${escapeHtml(matchingFieldValue(value))}">
  </label>`;
}
function renderMatchingControlPoints() {
  if (!matchingWorkflowState) return;
  const side = matchingWorkflowState.side;
  const rows = matchingWorkflowState.rows[side];
  matchingControlPoints.innerHTML = rows.map((row, index) => {
    const isPicking = matchingWorkflowState.pickingIndex === index;
    const hasPixel = matchingCoordinatePresent(row.pixel.x)
      && matchingCoordinatePresent(row.pixel.y);
    return `<section class="matchingControlPoint">
      <div class="matchingControlPointHead">
        <strong>${escapeHtml(row.label || `Точка ${index + 1}`)}</strong>
        ${row.pixelSource === "project" ? `<span class="matchingPointSource">Из карты</span>` : ""}
        <button type="button" data-remove-matching-point="${index}" aria-label="Удалить точку"
          ${rows.length <= 3 ? "disabled" : ""}>×</button>
      </div>
      <div class="matchingControlPointGrid">
        ${matchingRowInput(index, "mm", "x", row.mm.x, "X, мм")}
        ${matchingRowInput(index, "mm", "y", row.mm.y, "Y, мм")}
        ${matchingRowInput(index, "pixel", "x", row.pixel.x, "X, px")}
        ${matchingRowInput(index, "pixel", "y", row.pixel.y, "Y, px")}
      </div>
      <button class="matchingPointPick ${isPicking ? "active" : ""}" type="button"
        data-pick-matching-point="${index}">
        ${isPicking ? "Щёлкните на изображении…" : hasPixel ? "Указать заново" : "Указать на изображении"}
      </button>
    </section>`;
  }).join("");
}
function renderMatchingPreview() {
  if (!matchingWorkflowState) return;
  const side = matchingWorkflowState.side;
  const size = project.imageSizes[side] || DEFAULT_IMAGE_SIZES[side];
  const imageUrl = imageUrls[side];
  matchingPreviewSide.textContent = side;
  matchingPreviewEmpty.hidden = Boolean(imageUrl);
  matchingPreviewStage.hidden = !imageUrl;
  matchingPreviewStage.style.aspectRatio = `${size.w} / ${size.h}`;
  if (imageUrl) matchingPreviewImage.src = imageUrl;
  else matchingPreviewImage.removeAttribute("src");

  const picking = matchingWorkflowState.pickingIndex;
  matchingPickHint.textContent = Number.isInteger(picking)
    ? `Укажите точку ${picking + 1} на изображении`
    : "Выберите опорную точку слева";
  matchingPickHint.classList.toggle("picking", Number.isInteger(picking));

  const sidePlan = matchingWorkflowState.plan
    ? matchingPlanForSide(matchingWorkflowState.plan, side)
    : {updates:[], skipped:[], entries:[], skipReasons:{}};
  const boxes = sidePlan.updates.flatMap(entry => {
    const before = entry.before;
    const after = entry.after;
    return [
      `<div class="matchingPreviewBox before" style="left:${before.x / size.w * 100}%;top:${before.y / size.h * 100}%;width:${before.w / size.w * 100}%;height:${before.h / size.h * 100}%"></div>`,
      `<div class="matchingPreviewBox after" style="left:${after.x / size.w * 100}%;top:${after.y / size.h * 100}%;width:${after.w / size.w * 100}%;height:${after.h / size.h * 100}%"><span>${escapeHtml(entry.ref)}</span></div>`
    ];
  });
  const points = matchingWorkflowState.rows[side].flatMap((row, index) => {
    if (!matchingCoordinatePresent(row.pixel.x) || !matchingCoordinatePresent(row.pixel.y)) {
      return [];
    }
    const x = Number(row.pixel.x);
    const y = Number(row.pixel.y);
    return [`<div class="matchingPreviewPoint" style="left:${x / size.w * 100}%;top:${y / size.h * 100}%"><span>${index + 1}</span></div>`];
  });
  matchingPreviewOverlay.innerHTML = boxes.concat(points).join("");

  matchingPlanList.innerHTML = sidePlan.entries.map(entry => entry.action === "update"
    ? `<div class="matchingPlanRow update"><strong>${escapeHtml(entry.ref)}</strong><span>Будет изменён</span><span>${entry.after.x}, ${entry.after.y}, ${entry.after.w} × ${entry.after.h} px</span></div>`
    : `<div class="matchingPlanRow skip"><strong>${escapeHtml(entry.ref || entry.expectedId)}</strong><span>Пропущен</span><span>${escapeHtml(matchingSkipReasonLabel(entry.reason))}</span></div>`
  ).join("") || `<div class="emptyLine" style="padding:12px">Для этой стороны план ещё не рассчитан.</div>`;
}
function renderMatchingPlanSummary() {
  if (!matchingWorkflowState?.plan) {
    matchingPlanSummary.innerHTML = "";
    matchingWorkflowDetails.textContent = "Сначала выполните калибровку хотя бы одной стороны.";
    matchingApplyBtn.disabled = true;
    return;
  }
  const {summary} = matchingWorkflowState.plan;
  matchingPlanSummary.innerHTML = `
    <div class="matchingPlanMetric update"><strong>${summary.updates}</strong><span>Будет обновлено</span></div>
    <div class="matchingPlanMetric skip"><strong>${summary.skipped}</strong><span>Будет пропущено</span></div>
  `;
  const calibratedSides = SIDES.filter(side => matchingWorkflowState.calibrations[side]);
  matchingWorkflowDetails.textContent = `Калибровано: ${calibratedSides.join(", ") || "—"} · изменений: ${summary.updates}`;
  matchingApplyBtn.disabled = summary.updates === 0;
}
function renderMatchingCalibrationStatus() {
  if (!matchingWorkflowState) return;
  const message = matchingWorkflowState.calibrationMessages[matchingWorkflowState.side];
  matchingCalibrationStatus.className = "matchingCalibrationStatus";
  if (!message) {
    matchingCalibrationStatus.textContent = "Заполните минимум три точки и рассчитайте преобразование.";
    return;
  }
  matchingCalibrationStatus.textContent = message.text;
  matchingCalibrationStatus.classList.add(message.tone);
}
function renderMatchingWorkflow() {
  if (!matchingWorkflowState) return;
  const sides = matchingSides();
  [matchingWorkflowTopBtn, matchingWorkflowBottomBtn].forEach(button => {
    const side = button.dataset.matchingSide;
    button.disabled = !sides.includes(side);
    button.classList.toggle("active", side === matchingWorkflowState.side);
  });
  renderMatchingControlPoints();
  renderMatchingCalibrationStatus();
  renderMatchingPlanSummary();
  renderMatchingPreview();
}
function rebuildMatchingPlan() {
  if (!matchingWorkflowState) return;
  matchingWorkflowState.plan = createMatchingApplicationPlan({
    components:project.components,
    imageSizes:project.imageSizes,
    session:pendingMatchingRun.session,
    calibrations:matchingWorkflowState.calibrations
  });
}
function fitCurrentMatchingSide() {
  if (!matchingWorkflowState) return;
  const side = matchingWorkflowState.side;
  try {
    const calibration = fitSideCalibration({
      side,
      rows:matchingWorkflowState.rows[side],
      maxResidualPx:matchingResidualLimit.value
    });
    matchingWorkflowState.calibrations[side] = calibration;
    matchingWorkflowState.calibrationMessages[side] = {
      tone:"success",
      text:[
        `Калибровка принята: ${calibration.controlPointCount} точек.`,
        `RMS ${matchingNumber(calibration.rmsResidualPx)} px; максимум ${matchingNumber(calibration.maxResidualPx)} px.`,
        calibration.mirrored ? "Преобразование зеркальное." : "Преобразование без отражения."
      ].join("\n")
    };
    matchingWorkflowState.pickingIndex = null;
    rebuildMatchingPlan();
    renderMatchingWorkflow();
  } catch (error) {
    invalidateMatchingSide(side);
    matchingWorkflowState.calibrationMessages[side] = {
      tone:"error",
      text:`Калибровка отклонена: ${error?.message || "проверьте точки"}`
    };
    renderMatchingWorkflow();
  }
}
function invalidateMatchingSide(side) {
  if (!matchingWorkflowState) return;
  delete matchingWorkflowState.calibrations[side];
  matchingWorkflowState.plan = Object.keys(matchingWorkflowState.calibrations).length
    ? createMatchingApplicationPlan({
      components:project.components,
      imageSizes:project.imageSizes,
      session:pendingMatchingRun.session,
      calibrations:matchingWorkflowState.calibrations
    })
    : null;
  matchingWorkflowState.calibrationMessages[side] = "";
}
function setMatchingSide(side) {
  if (!matchingWorkflowState || !matchingSides().includes(side)) return;
  matchingWorkflowState.side = side;
  matchingWorkflowState.pickingIndex = null;
  renderMatchingWorkflow();
}
function pickMatchingPreviewPoint(event) {
  if (!matchingWorkflowState || !Number.isInteger(matchingWorkflowState.pickingIndex)) return;
  const side = matchingWorkflowState.side;
  const size = project.imageSizes[side] || DEFAULT_IMAGE_SIZES[side];
  const rect = matchingPreviewStage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const row = matchingWorkflowState.rows[side][matchingWorkflowState.pickingIndex];
  row.pixel = {
    x:Math.max(0, Math.min(size.w, Math.round((event.clientX - rect.left) * size.w / rect.width * 10) / 10)),
    y:Math.max(0, Math.min(size.h, Math.round((event.clientY - rect.top) * size.h / rect.height * 10) / 10))
  };
  row.pixelSource = null;
  matchingWorkflowState.pickingIndex = null;
  invalidateMatchingSide(side);
  renderMatchingWorkflow();
}
async function applyMatchingWorkflow() {
  const plan = matchingWorkflowState?.plan;
  if (!plan || plan.summary.updates === 0) return;
  const confirmed = await openConfirmDialog({
    title:`Применить ${plan.summary.updates} изменений?`,
    text:`Положение компонентов будет обновлено по предпросмотру. Пропущено результатов: ${plan.summary.skipped}.`,
    action:"Применить"
  });
  if (!confirmed) return;
  try {
    pushUndoState();
    project.components = applyMatchingApplicationPlan(project.components, plan);
    if (!await saveProjectNow()) {
      renderAll();
      closeMatchingWorkflow(false);
      matchingModal.hidden = true;
      notify("Изменения применены в памяти, но проект не удалось сохранить.", "warning");
      return;
    }
    matchingStatus.className = "";
    matchingStatus.textContent = `${pendingMatchingRun.sourceName} · применено ${plan.summary.updates}`;
    matchingWorkflowState = null;
    closeMatchingWorkflow(false);
    matchingModal.hidden = true;
    renderAll();
    notify(`Обновлено компонентов: ${plan.summary.updates}.`, "success");
  } catch (error) {
    undoStack.pop();
    console.error(error);
    notify(`Предпросмотр устарел: ${error?.message || "пересчитайте план"}`, "warning");
  }
}
async function applyBomUpdate() {
  if (!pendingBomPlan || !pendingBomPlan.changed) return;
  if (pendingBomPlan.conflicts.some(conflict => conflict.kind === "duplicate")) {
    notify("Сначала устраните дубликаты обозначений в BOM.", "warning");
    return;
  }
  if (pendingBomPlan.conflicts.length && !bomConflictCheckbox.checked) {
    notify("Подтвердите конфликтные изменения.", "warning");
    return;
  }
  pushUndoState();
  const backupResult = createVerificationBackup(
    project.verificationBackups,
    project.verificationMap,
    `Перед обновлением BOM: ${pendingBomSource?.name || "BOM"}`
  );
  project.verificationBackups = backupResult.backups;
  project.components = pendingBomPlan.nextComponents;
  project.verificationMap = normalizeVerificationMap(pendingBomPlan.nextVerificationMap);
  const validKeys = new Set(project.components.map(compKey));
  project.doneMap = Object.fromEntries(Object.entries(project.doneMap || {}).filter(([key]) => validKeys.has(key)));
  project.bomMetadata = {
    fileName:pendingBomSource?.name || "BOM",
    updatedAt:new Date().toISOString()
  };
  selectedKey = "";
  if (!await saveProjectNow()) {
    closeBomModal();
    renderAll();
    notify("BOM применена в памяти, но проект не удалось сохранить.", "warning");
    return;
  }
  closeBomModal();
  renderAll();
  notify(`BOM обновлена. Резервных копий: ${project.verificationBackups.length}.`, "success");
}
function backupRefsValue() {
  return String(backupRefs.value || "")
    .split(/[\s,;]+/)
    .map(ref => ref.trim().toUpperCase())
    .filter(Boolean);
}
function selectedBackup() {
  return (project.verificationBackups || []).find(item => item.id === selectedBackupId) || null;
}
function renderBackupComparison() {
  const backup = selectedBackup();
  if (!backup) {
    backupComparison.textContent = "Выберите резервную копию.";
    restoreAllBtn.disabled = true;
    restoreSelectedBtn.disabled = true;
    return;
  }
  const refs = backupRefsValue();
  const changes = compareVerificationBackup(project.verificationMap, backup.verificationMap, refs.length ? refs : null);
  const changedRefs = [...new Set(changes.map(change => change.ref))];
  backupComparison.textContent = [
    formatBackupDate(backup.createdAt),
    backup.reason,
    refs.length
      ? `Для выбранных обозначений будет изменено записей: ${changes.length}.`
      : `При полном восстановлении будет изменено записей: ${changes.length}.`,
    changedRefs.length
      ? `Отличаются: ${changedRefs.slice(0, 20).join(", ")}${changedRefs.length > 20 ? "…" : ""}`
      : "Сохранённые и текущие данные совпадают."
  ].join("\n");
  restoreAllBtn.disabled = changes.length === 0;
  restoreSelectedBtn.disabled = refs.length === 0 || changes.length === 0;
}
function renderBackups() {
  const backups = project.verificationBackups || [];
  if (!backups.some(item => item.id === selectedBackupId)) selectedBackupId = backups[0]?.id || "";
  backupList.innerHTML = backups.length
    ? backups.map(item => `<button class="backupItem ${item.id === selectedBackupId ? "active" : ""}" type="button" data-backup-id="${escapeHtml(item.id)}">
        <strong>${escapeHtml(formatBackupDate(item.createdAt))}</strong>
        <span>${escapeHtml(item.reason)}</span>
      </button>`).join("")
    : `<div class="emptyLine">Резервных копий пока нет.</div>`;
  renderBackupComparison();
}
function openBackups() {
  backupRefs.value = "";
  backupOverwriteCheckbox.checked = false;
  selectedBackupId = project.verificationBackups?.[0]?.id || "";
  renderBackups();
  backupsModal.hidden = false;
}
function closeBackups() {
  backupsModal.hidden = true;
  selectedBackupId = "";
  backupOverwriteCheckbox.checked = false;
}
async function restoreFromSelectedBackup(partial) {
  const backup = selectedBackup();
  if (!backup) return;
  const refs = partial ? backupRefsValue() : null;
  if (partial && !refs.length) {
    notify("Введите позиционные обозначения для частичного восстановления.", "warning");
    return;
  }
  if (!backupOverwriteCheckbox.checked) {
    notify("Подтвердите перезапись текущих результатов.", "warning");
    return;
  }
  const changes = compareVerificationBackup(project.verificationMap, backup.verificationMap, refs);
  if (!changes.length) return;
  const currentBackup = createVerificationBackup(
    project.verificationBackups,
    project.verificationMap,
    `Перед восстановлением копии от ${formatBackupDate(backup.createdAt)}`
  );
  pushUndoState();
  project.verificationBackups = currentBackup.backups;
  project.verificationMap = normalizeVerificationMap(
    restoreVerificationBackup(project.verificationMap, backup.verificationMap, refs)
  );
  if (!await saveProjectNow()) {
    closeBackups();
    renderAll();
    notify("Данные восстановлены в памяти, но проект не удалось сохранить.", "warning");
    return;
  }
  closeBackups();
  renderAll();
  notify(partial ? `Восстановлено компонентов: ${refs.length}.` : "Резервная копия восстановлена.", "success");
}
function renderHotspots() {
  board.querySelectorAll(".hotspot").forEach(e => e.remove());
  if (!project) return;
  project.components.filter(c => !c.unplaced && c.side === currentSide && matches(c)).forEach(c => {
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
      card.innerHTML = `<div class="ref">${escapeHtml(c.ref)}${c.unplaced ? `<span class="unplacedBadge">Не размещён</span>` : ""}</div><div class="meta">${escapeHtml(c.side)} · ${escapeHtml(c.group || "Без группы")} · ${escapeHtml(c.value || "Без номинала")}</div><div class="verificationSummaryRow"><div class="verificationSummary ${isVerified(c) ? "verified" : ""}">${isVerified(c) ? "✓ Проверен" : "○ Не проверен"}${actualValue ? ` · ${escapeHtml(actualValue)}` : ""}</div><span class="verificationControlBadge ${control.status}">${verificationStatusLabel(control.status)}</span></div>${record.comment ? `<div class="verificationComment">${escapeHtml(record.comment)}</div>` : ""}<div class="note">${escapeHtml(c.note)}</div><button class="verificationBtn" type="button">Проверка</button>${solderButton}`;
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
  renderBomState();
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
  const selected = componentByKey(selectedKey);
  if (selected?.unplaced) {
    selected.side = currentSide;
    selected.x = x;
    selected.y = y;
    selected.w = w;
    selected.h = h;
    delete selected.unplaced;
    selectedKey = compKey(selected);
    scheduleSave();
    renderAll();
    selectRef(selected.ref, selected.side);
    notify(`${selected.ref} размещён на плате.`, "success");
    return;
  }
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
  const unplaced = project.components.filter(component => component.unplaced);
  if (unplaced.length) {
    notify(`Сначала разместите компоненты из BOM: ${unplaced.slice(0, 4).map(component => component.ref).join(", ")}${unplaced.length > 4 ? "…" : ""}.`, "warning");
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
  if (!await saveProjectNow()) {
    notify("Не удалось сохранить проект перед переходом к пайке.", "warning");
    return;
  }
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
verificationExportButtons.forEach(button => {
  button.addEventListener("click", () => exportVerificationReport(button.dataset.reportFormat));
});
importBomBtn.addEventListener("click", selectBom);
bomFileInput.addEventListener("change", async () => {
  try {
    const source = await readBomFromBrowserFile(bomFileInput.files[0]);
    bomFileInput.value = "";
    if (source) showBomPreview(source);
  } catch (error) {
    console.error(error);
    notify(error?.message || "Не удалось прочитать BOM.", "warning");
  }
});
importPlacementBtn.addEventListener("click", () => selectMatchingSource("placement"));
importRecognitionBtn.addEventListener("click", () => selectMatchingSource("recognition"));
runMatchingBtn.addEventListener("click", runImportedMatching);
placementFileInput.addEventListener("change", async () => {
  try {
    useMatchingSource(
      "placement",
      await readMatchingSourceFromBrowserFile(placementFileInput.files[0])
    );
  } catch (error) {
    console.error(error);
    notify(error?.message || "Не удалось прочитать Pick and Place.", "warning");
  } finally {
    placementFileInput.value = "";
  }
});
recognitionFileInput.addEventListener("change", async () => {
  try {
    useMatchingSource(
      "recognition",
      await readMatchingSourceFromBrowserFile(recognitionFileInput.files[0])
    );
  } catch (error) {
    console.error(error);
    notify(error?.message || "Не удалось прочитать результаты распознавания.", "warning");
  } finally {
    recognitionFileInput.value = "";
  }
});
importMatchingBtn.addEventListener("click", selectMatchingSession);
matchingFileInput.addEventListener("change", async () => {
  try {
    const source = await readMatchingFromBrowserFile(matchingFileInput.files[0]);
    if (source) showMatchingResults(source);
  } catch (error) {
    console.error(error);
    matchingStatus.className = "error";
    matchingStatus.textContent = "Ошибка файла";
    notify(error?.message || "Не удалось открыть сеанс сопоставления.", "warning");
  } finally {
    matchingFileInput.value = "";
  }
});
matchingResults.addEventListener("change", event => {
  const select = event.target.closest("[data-matching-resolution]");
  if (!select || !pendingMatchingRun) return;
  try {
    pendingMatchingRun.session = resolveMatchingResult(
      pendingMatchingRun.session,
      Number(select.dataset.matchingResolution),
      select.value
    );
    renderMatchingResults();
  } catch (error) {
    console.error(error);
    notify(error?.message || "Не удалось применить решение оператора.", "warning");
  }
});
matchingCloseBtn.addEventListener("click", closeMatchingResults);
matchingDoneBtn.addEventListener("click", closeMatchingResults);
matchingBackdrop.addEventListener("click", closeMatchingResults);
matchingCalibrateBtn.addEventListener("click", openMatchingWorkflow);
matchingWorkflowCloseBtn.addEventListener("click", () => closeMatchingWorkflow());
matchingWorkflowCancelBtn.addEventListener("click", () => closeMatchingWorkflow());
matchingWorkflowBackdrop.addEventListener("click", () => closeMatchingWorkflow());
matchingWorkflowTopBtn.addEventListener("click", () => setMatchingSide("TOP"));
matchingWorkflowBottomBtn.addEventListener("click", () => setMatchingSide("BOTTOM"));
matchingFitBtn.addEventListener("click", fitCurrentMatchingSide);
matchingAddPointBtn.addEventListener("click", () => {
  if (!matchingWorkflowState) return;
  const side = matchingWorkflowState.side;
  const rows = matchingWorkflowState.rows[side];
  rows.push({
    id:`manual:${side}:${Date.now()}`,
    label:`Точка ${rows.length + 1}`,
    mm:{x:null, y:null},
    pixel:{x:null, y:null}
  });
  invalidateMatchingSide(side);
  renderMatchingWorkflow();
});
matchingControlPoints.addEventListener("click", event => {
  if (!matchingWorkflowState) return;
  const pick = event.target.closest("[data-pick-matching-point]");
  if (pick) {
    const index = Number(pick.dataset.pickMatchingPoint);
    matchingWorkflowState.pickingIndex = matchingWorkflowState.pickingIndex === index ? null : index;
    renderMatchingWorkflow();
    return;
  }
  const remove = event.target.closest("[data-remove-matching-point]");
  if (!remove || remove.disabled) return;
  const side = matchingWorkflowState.side;
  matchingWorkflowState.rows[side].splice(Number(remove.dataset.removeMatchingPoint), 1);
  matchingWorkflowState.pickingIndex = null;
  invalidateMatchingSide(side);
  renderMatchingWorkflow();
});
matchingControlPoints.addEventListener("change", event => {
  if (!matchingWorkflowState || !event.target.matches("[data-matching-index]")) return;
  const side = matchingWorkflowState.side;
  const row = matchingWorkflowState.rows[side][Number(event.target.dataset.matchingIndex)];
  const group = event.target.dataset.matchingGroup;
  const axis = event.target.dataset.matchingAxis;
  row[group][axis] = event.target.value;
  if (group === "pixel") row.pixelSource = null;
  invalidateMatchingSide(side);
  renderMatchingCalibrationStatus();
  renderMatchingPlanSummary();
  renderMatchingPreview();
});
matchingResidualLimit.addEventListener("change", () => {
  if (!matchingWorkflowState) return;
  SIDES.forEach(invalidateMatchingSide);
  renderMatchingWorkflow();
});
matchingPreviewStage.addEventListener("click", pickMatchingPreviewPoint);
matchingApplyBtn.addEventListener("click", applyMatchingWorkflow);
bomCloseBtn.addEventListener("click", closeBomModal);
bomCancelBtn.addEventListener("click", closeBomModal);
bomBackdrop.addEventListener("click", closeBomModal);
bomApplyBtn.addEventListener("click", applyBomUpdate);
bomExportOldBtn.addEventListener("click", () => exportVerificationReport("xlsx"));
openBackupsBtn.addEventListener("click", openBackups);
backupsCloseBtn.addEventListener("click", closeBackups);
backupsBackdrop.addEventListener("click", closeBackups);
backupList.addEventListener("click", event => {
  const item = event.target.closest("[data-backup-id]");
  if (!item) return;
  selectedBackupId = item.dataset.backupId;
  backupOverwriteCheckbox.checked = false;
  renderBackups();
});
backupRefs.addEventListener("input", () => {
  backupOverwriteCheckbox.checked = false;
  renderBackupComparison();
});
restoreSelectedBtn.addEventListener("click", () => restoreFromSelectedBackup(true));
restoreAllBtn.addEventListener("click", () => restoreFromSelectedBackup(false));
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
  if (ev.key === "Escape" && !matchingWorkflowModal.hidden) {
    ev.preventDefault();
    closeMatchingWorkflow();
    return;
  }
  if (ev.key === "Escape" && !matchingModal.hidden) {
    ev.preventDefault();
    closeMatchingResults();
    return;
  }
  if (ev.key === "Escape" && !bomModal.hidden) {
    ev.preventDefault();
    closeBomModal();
    return;
  }
  if (ev.key === "Escape" && !backupsModal.hidden) {
    ev.preventDefault();
    closeBackups();
    return;
  }
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
