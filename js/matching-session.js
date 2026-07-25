(function initMatchingSession(root, factory) {
  const matchingApi = typeof module === "object" && module.exports
    ? require("./automatic-matching.js")
    : root?.SolderMapAutomaticMatching;
  const api = factory(matchingApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapMatchingSession = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchingSessionApi(
  matchingApi
) {
  if (!matchingApi) throw new Error("SolderMapAutomaticMatching is required");

  const SESSION_VERSION = 1;
  const RESULT_STATUSES = Object.freeze([
    "matched_exact",
    "matched_acceptable",
    "matched_uncertain_geometry",
    "ambiguous_exact",
    "ambiguous_acceptable",
    "ambiguous_unknown_geometry",
    "unmatched"
  ]);

  function finiteNumber(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError(`${name} must be a finite number`);
    return number;
  }

  function nonEmptyText(value, name) {
    const text = String(value ?? "").trim();
    if (!text) throw new TypeError(`${name} must be a non-empty string`);
    return text;
  }

  function normalizeSide(value, name) {
    const side = String(value ?? "").trim().toUpperCase();
    if (side !== "TOP" && side !== "BOTTOM") {
      throw new TypeError(`${name} must be TOP or BOTTOM`);
    }
    return side;
  }

  function normalizeCenter(value, name) {
    const source = value?.center && typeof value.center === "object"
      ? value.center
      : value;
    if (!source || typeof source !== "object") {
      throw new TypeError(`${name} must contain a center`);
    }
    return {
      x:finiteNumber(source.x, `${name}.x`),
      y:finiteNumber(source.y, `${name}.y`)
    };
  }

  function normalizeGeometry(value, name) {
    if (value === null || value === undefined) return null;
    if (!value || typeof value !== "object" || !Array.isArray(value.pads)) {
      throw new TypeError(`${name} must contain a pads array`);
    }
    if (value.pads.length === 0) return null;
    return {
      pads:value.pads.map((pad, index) => {
        if (!pad || typeof pad !== "object") {
          throw new TypeError(`${name}.pads[${index}] must be an object`);
        }
        const width = finiteNumber(
          pad.width ?? pad.w,
          `${name}.pads[${index}].width`
        );
        const height = finiteNumber(
          pad.height ?? pad.h,
          `${name}.pads[${index}].height`
        );
        if (width <= 0 || height <= 0) {
          throw new RangeError(`${name}.pads[${index}] dimensions must be greater than zero`);
        }
        return {
          x:finiteNumber(pad.x, `${name}.pads[${index}].x`),
          y:finiteNumber(pad.y, `${name}.pads[${index}].y`),
          width,
          height
        };
      })
    };
  }

  function normalizeExpectedFootprint(value, index) {
    if (!value || typeof value !== "object") {
      throw new TypeError(`expectedFootprints[${index}] must be an object`);
    }
    const name = `expectedFootprints[${index}]`;
    const ref = nonEmptyText(value.ref, `${name}.ref`);
    const side = normalizeSide(value.side, `${name}.side`);
    const center = normalizeCenter(value, name);
    return {
      id:nonEmptyText(value.id ?? `${side}:${ref}`, `${name}.id`),
      ref,
      side,
      center,
      x:center.x,
      y:center.y,
      rotationDegrees:finiteNumber(
        value.rotationDegrees ?? value.rotation ?? 0,
        `${name}.rotationDegrees`
      ),
      geometry:normalizeGeometry(value.geometry, `${name}.geometry`)
    };
  }

  function normalizeFoundFootprint(value, index) {
    if (!value || typeof value !== "object") {
      throw new TypeError(`foundFootprints[${index}] must be an object`);
    }
    const name = `foundFootprints[${index}]`;
    const side = normalizeSide(value.side, `${name}.side`);
    const center = normalizeCenter(value, name);
    return {
      id:nonEmptyText(value.id ?? `found:${side}:${index + 1}`, `${name}.id`),
      side,
      center,
      x:center.x,
      y:center.y,
      geometry:normalizeGeometry(value.geometry, `${name}.geometry`)
    };
  }

  function assertUniqueIds(items, name) {
    const ids = new Set();
    items.forEach((item, index) => {
      if (ids.has(item.id)) throw new Error(`${name}[${index}].id must be unique`);
      ids.add(item.id);
    });
  }

  function normalizeSessionInput(value) {
    if (!value || typeof value !== "object") {
      throw new TypeError("matching session input must be an object");
    }
    if (!Array.isArray(value.expectedFootprints)) {
      throw new TypeError("expectedFootprints must be an array");
    }
    if (!Array.isArray(value.foundFootprints)) {
      throw new TypeError("foundFootprints must be an array");
    }
    const expectedFootprints = value.expectedFootprints.map(normalizeExpectedFootprint);
    const foundFootprints = value.foundFootprints.map(normalizeFoundFootprint);
    assertUniqueIds(expectedFootprints, "expectedFootprints");
    assertUniqueIds(foundFootprints, "foundFootprints");
    return {
      version:SESSION_VERSION,
      expectedFootprints,
      foundFootprints
    };
  }

  function summarizeResults(results) {
    const byStatus = Object.fromEntries(RESULT_STATUSES.map(status => [status, 0]));
    results.forEach(result => {
      if (!Object.hasOwn(byStatus, result.status)) {
        throw new Error(`Unsupported matching status: ${result.status}`);
      }
      byStatus[result.status] += 1;
    });
    return {
      total:results.length,
      matched:byStatus.matched_exact
        + byStatus.matched_acceptable
        + byStatus.matched_uncertain_geometry,
      ambiguous:byStatus.ambiguous_exact
        + byStatus.ambiguous_acceptable
        + byStatus.ambiguous_unknown_geometry,
      unmatched:byStatus.unmatched,
      byStatus
    };
  }

  function serializableClone(value) {
    if (Array.isArray(value)) return value.map(serializableClone);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, serializableClone(item)])
    );
  }

  function runMatchingSession(value, options = {}) {
    const input = normalizeSessionInput(value);
    const results = serializableClone(
      matchingApi.matchFootprints(
        input.expectedFootprints,
        input.foundFootprints,
        options
      ).map((result, index) => ({
        ...result,
        expectedId:input.expectedFootprints[index].id,
        selectedFoundId:result.selectedFound?.id ?? null
      }))
    );
    return {
      version:SESSION_VERSION,
      input,
      results,
      summary:summarizeResults(results)
    };
  }

  return Object.freeze({
    SESSION_VERSION,
    RESULT_STATUSES,
    normalizeGeometry,
    normalizeExpectedFootprint,
    normalizeFoundFootprint,
    normalizeSessionInput,
    summarizeResults,
    serializableClone,
    runMatchingSession
  });
});
