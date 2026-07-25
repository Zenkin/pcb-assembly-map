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

  const UNIT_SCALES = Object.freeze({
    "Ом": 1,
    "кОм": 1e3,
    "МОм": 1e6,
    "пФ": 1,
    "нФ": 1e3,
    "мкФ": 1e6,
    "мФ": 1e9
  });

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

  function unitPatternForRef(ref) {
    const prefix = String(ref || "").trim().charAt(0).toUpperCase();
    if (prefix === "R") {
      return [
        ["МОм", /^(?:м(?:ега)?ом|m(?:ohm)?|mΩ)$/iu],
        ["кОм", /^(?:к(?:ило)?ом|k(?:ohm)?|kΩ)$/iu],
        ["Ом", /^(?:ом|ohm|Ω|r)$/iu]
      ];
    }
    if (prefix === "C") {
      return [
        ["мкФ", /^(?:мкф|мкфарад|u[fф]|[µμ][fф])$/iu],
        ["мФ", /^(?:мф|мфарад|m[fф])$/iu],
        ["нФ", /^(?:нф|нфарад|n[fф])$/iu],
        ["пФ", /^(?:пф|пфарад|p[fф])$/iu]
      ];
    }
    return [];
  }

  function canonicalUnit(raw, ref) {
    const candidate = String(raw || "").trim().replace(/\.$/, "");
    for (const [unit, pattern] of unitPatternForRef(ref)) {
      if (pattern.test(candidate)) return unit;
    }
    return "";
  }

  function parseTolerance(raw, allowUnsigned = false) {
    if (typeof raw === "number") {
      return Number.isFinite(raw) && raw >= 0 ? raw : null;
    }
    const value = String(raw ?? "").trim().replace(",", ".");
    if (!value) return null;
    const pattern = allowUnsigned
      ? /^(?:±|\+\/-)?\s*(\d+(?:\.\d*)?|\.\d+)\s*%?$/
      : /(?:±|\+\/-)\s*(\d+(?:\.\d*)?|\.\d+)\s*%/;
    const match = value.match(pattern);
    if (!match) return null;
    const number = Number(match[1]);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function parseNominal(raw, ref) {
    const units = unitsForRef(ref);
    const value = String(raw ?? "").trim();
    if (!units.length || !value) return {valid:false, value:null, unit:"", baseValue:null};

    const numberPattern = "(\\d+(?:[.,]\\d*)?|[.,]\\d+)";
    const unitPattern = String(ref || "").trim().charAt(0).toUpperCase() === "R"
      ? "(МОм|мОм|кОм|Ом|MΩ|kΩ|Ω|Mohm|kohm|ohm|R)"
      : "(мкФ|мФ|нФ|пФ|uF|µF|μF|mF|nF|pF)";
    const match = value.match(new RegExp(`${numberPattern}\\s*${unitPattern}`, "iu"));
    if (match) {
      const parsed = parseNumber(match[1]);
      const unit = canonicalUnit(match[2], ref);
      if (parsed.valid && !parsed.empty && unit) {
        return {valid:true, value:parsed.value, unit, baseValue:parsed.value * UNIT_SCALES[unit]};
      }
    }

    const withoutTolerance = value
      .replace(/(?:±|\+\/-)\s*(\d+(?:[.,]\d*)?|[.,]\d+)\s*%/giu, "")
      .trim();
    const bare = parseNumber(withoutTolerance);
    if (bare.valid && !bare.empty) {
      return {valid:true, value:bare.value, unit:units[0], baseValue:bare.value * UNIT_SCALES[units[0]]};
    }
    return {valid:false, value:null, unit:"", baseValue:null};
  }

  function toBase(value, unit) {
    const number = Number(value);
    const scale = UNIT_SCALES[unit];
    return Number.isFinite(number) && number >= 0 && scale ? number * scale : null;
  }

  function calculateControl({actualValue, actualUnit, referenceValue, referenceUnit, tolerancePercent}) {
    if (actualValue === null || actualValue === undefined || actualValue === "") {
      return {status:"no_measurement"};
    }
    const actualBase = toBase(actualValue, actualUnit);
    const referenceBase = toBase(referenceValue, referenceUnit);
    if (actualBase === null || referenceBase === null || referenceBase === 0) {
      return {status:"not_comparable"};
    }

    const deltaBase = actualBase - referenceBase;
    const percentDelta = deltaBase / referenceBase * 100;
    const tolerance = tolerancePercent === null || tolerancePercent === undefined || tolerancePercent === ""
      ? null
      : Number(tolerancePercent);
    if (tolerance === null || !Number.isFinite(tolerance) || tolerance < 0) {
      return {status:"no_tolerance", actualBase, referenceBase, deltaBase, percentDelta};
    }

    const lowerBase = referenceBase * (1 - tolerance / 100);
    const upperBase = referenceBase * (1 + tolerance / 100);
    const epsilon = Number.EPSILON * Math.max(1, Math.abs(actualBase), Math.abs(lowerBase), Math.abs(upperBase)) * 8;
    const inTolerance = actualBase >= lowerBase - epsilon && actualBase <= upperBase + epsilon;
    return {
      status:inTolerance ? "in_tolerance" : "out_of_tolerance",
      actualBase,
      referenceBase,
      deltaBase,
      percentDelta,
      tolerancePercent:tolerance,
      lowerBase,
      upperBase
    };
  }

  function formatNumber(value, maximumFractionDigits = 6) {
    if (!Number.isFinite(value)) return "";
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits,
      useGrouping:false
    }).format(value);
  }

  function formatBaseValue(baseValue, ref, preferredUnit = "") {
    if (!Number.isFinite(baseValue)) return "";
    const units = unitsForRef(ref);
    let unit = units.includes(preferredUnit) ? preferredUnit : units[0];
    if (!preferredUnit && units.length) {
      unit = units.reduce((selected, candidate) => {
        const scaled = Math.abs(baseValue / UNIT_SCALES[candidate]);
        return scaled >= 1 && scaled < 1000 ? candidate : selected;
      }, unit);
    }
    return `${formatNumber(baseValue / UNIT_SCALES[unit])} ${unit}`.trim();
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
      comment: typeof source.comment === "string" ? source.comment : "",
      referenceValue: source.referenceValue !== null && source.referenceValue !== "" && Number.isFinite(Number(source.referenceValue)) && Number(source.referenceValue) >= 0
        ? Number(source.referenceValue)
        : null,
      referenceUnit: typeof source.referenceUnit === "string" ? source.referenceUnit : ""
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

  return Object.freeze({
    unitsForRef,
    parseNumber,
    parseTolerance,
    parseNominal,
    calculateControl,
    formatNumber,
    formatBaseValue,
    normalizeRecord,
    normalizeMap
  });
});
