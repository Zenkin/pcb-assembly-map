(function initMatchingResolution(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapMatchingResolution = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchingResolutionApi() {
  const AUTOMATIC_STATUSES = Object.freeze(["matched_exact", "matched_acceptable"]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function applicableResult(result) {
    return AUTOMATIC_STATUSES.includes(result?.status)
      || result?.operatorConfirmed === true;
  }

  function selectableCandidates(result) {
    const side = String(result?.side || result?.expected?.side || "").toUpperCase();
    return (Array.isArray(result?.candidates) ? result.candidates : [])
      .filter(candidate => (
        candidate?.withinRadius === true
        && candidate?.found
        && String(candidate.found.side || "").toUpperCase() === side
        && Array.isArray(candidate.found.geometry?.pads)
        && candidate.found.geometry.pads.length > 0
      ))
      .map(candidate => ({
        id:String(candidate.found.id || ""),
        distance:Number(candidate.centerDistance),
        classification:String(candidate.classification || "")
      }))
      .filter(candidate => candidate.id);
  }

  function resolveResult(session, resultIndex, foundId) {
    if (!session || !Array.isArray(session.results)) {
      throw new TypeError("session.results must be an array");
    }
    if (!Number.isInteger(resultIndex) || !session.results[resultIndex]) {
      throw new RangeError("resultIndex is outside session.results");
    }
    const next = clone(session);
    const result = next.results[resultIndex];
    const id = String(foundId ?? "").trim();
    if (!id) {
      delete result.operatorConfirmed;
      result.selectedFoundId = AUTOMATIC_STATUSES.includes(result.status)
        ? String(result.selectedFound?.id || "")
        : null;
      return next;
    }
    const candidate = selectableCandidates(result).find(item => item.id === id);
    if (!candidate) {
      throw new Error("Выбранное место не является допустимым кандидатом этого компонента.");
    }
    result.selectedFoundId = candidate.id;
    result.operatorConfirmed = true;
    return next;
  }

  function countApplicable(results) {
    return (Array.isArray(results) ? results : []).filter(applicableResult).length;
  }

  return Object.freeze({
    AUTOMATIC_STATUSES,
    applicableResult,
    selectableCandidates,
    resolveResult,
    countApplicable
  });
});
