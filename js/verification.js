(function initVerification(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapVerification = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createVerificationApi() {
  function unitsForRef(ref) {
    const prefix = String(ref || "").trim().charAt(0).toUpperCase();
    if (prefix === "R") return ["Ом", "кОм", "МОм"];
    if (prefix === "C") return ["пФ", "нФ", "мкФ", "мФ"];
    return [];
  }

  function parseNumber(raw) {
    const value = String(raw ?? "").trim();
    if (!value) return {empty:true, valid:true, value:null};
    const normalized = value.replace(",", ".");
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
      return {empty:false, valid:false, value:null};
    }
    const number = Number(normalized);
    return {empty:false, valid:Number.isFinite(number) && number >= 0, value:number};
  }

  function normalizeRecord(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const actualValue = Number(source.actualValue);
    return {
      checked: source.checked === true,
      actualValue: source.actualValue !== null && source.actualValue !== "" && Number.isFinite(actualValue) && actualValue >= 0
        ? actualValue
        : null,
      unit: typeof source.unit === "string" ? source.unit : "",
      comment: typeof source.comment === "string" ? source.comment : ""
    };
  }

  function normalizeMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, record]) => record && typeof record === "object" && !Array.isArray(record))
        .map(([key, record]) => [key, normalizeRecord(record)])
    );
  }

  return Object.freeze({unitsForRef, parseNumber, normalizeRecord, normalizeMap});
});
