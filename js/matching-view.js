(function initMatchingView(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapMatchingView = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchingViewApi() {
  const STATUS_META = Object.freeze({
    matched_exact:{label:"Точное совпадение", tone:"matched"},
    matched_acceptable:{label:"Допустимое совпадение", tone:"matched"},
    matched_uncertain_geometry:{label:"Совпадение без полной геометрии", tone:"uncertain"},
    ambiguous_exact:{label:"Несколько точных совпадений", tone:"ambiguous"},
    ambiguous_acceptable:{label:"Несколько допустимых совпадений", tone:"ambiguous"},
    ambiguous_unknown_geometry:{label:"Неоднозначно без геометрии", tone:"ambiguous"},
    unmatched:{label:"Совпадение не найдено", tone:"unmatched"}
  });

  function requiredObject(value, name) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`${name} must be an object`);
    }
    return value;
  }

  function buildViewModel(sourceName, runResult) {
    const result = requiredObject(runResult, "runResult");
    const document = requiredObject(result.document, "runResult.document");
    const session = requiredObject(result.session, "runResult.session");
    const summary = requiredObject(session.summary, "runResult.session.summary");
    if (!Array.isArray(session.results)) {
      throw new TypeError("runResult.session.results must be an array");
    }

    const rows = session.results.map((item, index) => {
      const row = requiredObject(item, `runResult.session.results[${index}]`);
      const meta = STATUS_META[row.status];
      if (!meta) throw new Error(`Unsupported matching status: ${String(row.status)}`);
      const candidates = Array.isArray(row.candidates) ? row.candidates : [];
      return {
        expectedId:String(row.expectedId || row.expected?.id || ""),
        ref:String(row.expectedRef || row.expected?.ref || row.expectedId || ""),
        side:String(row.side || row.expected?.side || ""),
        status:row.status,
        statusLabel:meta.label,
        tone:meta.tone,
        selectedFoundId:row.selectedFoundId ? String(row.selectedFoundId) : "",
        candidatesInRadius:candidates.filter(candidate => candidate?.withinRadius === true).length
      };
    });

    return {
      sourceName:String(sourceName || "matching-session.json"),
      format:String(document.format || ""),
      version:document.version,
      units:String(document.units || ""),
      options:{
        radiusScale:Number(document.options?.radiusScale),
        defaultRadiusMm:Number(document.options?.defaultRadiusMm)
      },
      summary:{
        total:Number(summary.total) || 0,
        matched:Number(summary.matched) || 0,
        ambiguous:Number(summary.ambiguous) || 0,
        unmatched:Number(summary.unmatched) || 0
      },
      foundCount:Array.isArray(document.foundFootprints) ? document.foundFootprints.length : 0,
      rows
    };
  }

  return Object.freeze({
    STATUS_META,
    buildViewModel
  });
});
