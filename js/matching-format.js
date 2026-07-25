(function initMatchingFormat(root, factory) {
  const sessionApi = typeof module === "object" && module.exports
    ? require("./matching-session.js")
    : root?.SolderMapMatchingSession;
  const matchingApi = typeof module === "object" && module.exports
    ? require("./automatic-matching.js")
    : root?.SolderMapAutomaticMatching;
  const api = factory(sessionApi, matchingApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapMatchingFormat = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchingFormatApi(
  sessionApi,
  matchingApi
) {
  if (!sessionApi) throw new Error("SolderMapMatchingSession is required");
  if (!matchingApi) throw new Error("SolderMapAutomaticMatching is required");

  const DOCUMENT_FORMAT = "soldermap-matching-session";
  const DOCUMENT_VERSION = 1;
  const DOCUMENT_UNITS = "mm";

  function parseJson(text) {
    const source = String(text ?? "").replace(/^\uFEFF/, "");
    if (!source.trim()) throw new Error("Matching session file is empty.");
    try {
      return JSON.parse(source);
    } catch (error) {
      throw new SyntaxError(`Matching session file contains invalid JSON: ${error.message}`);
    }
  }

  function positiveNumber(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new TypeError(`${name} must be a finite number greater than zero`);
    }
    return number;
  }

  function normalizeOptions(value) {
    if (value === null || value === undefined) {
      return {...matchingApi.DEFAULT_OPTIONS};
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("options must be an object");
    }
    return {
      radiusScale:positiveNumber(
        value.radiusScale ?? matchingApi.DEFAULT_OPTIONS.radiusScale,
        "options.radiusScale"
      ),
      defaultRadiusMm:positiveNumber(
        value.defaultRadiusMm ?? matchingApi.DEFAULT_OPTIONS.defaultRadiusMm,
        "options.defaultRadiusMm"
      )
    };
  }

  function normalizeDocument(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("matching session document must be an object");
    }
    if (value.format !== DOCUMENT_FORMAT) {
      throw new Error(`format must be "${DOCUMENT_FORMAT}"`);
    }
    if (value.version !== DOCUMENT_VERSION) {
      throw new Error(`unsupported matching session version: ${String(value.version)}`);
    }
    if (value.units !== DOCUMENT_UNITS) {
      throw new Error(`units must be "${DOCUMENT_UNITS}"`);
    }

    const input = sessionApi.normalizeSessionInput({
      expectedFootprints:value.expectedFootprints,
      foundFootprints:value.foundFootprints
    });
    return {
      format:DOCUMENT_FORMAT,
      version:DOCUMENT_VERSION,
      units:DOCUMENT_UNITS,
      options:normalizeOptions(value.options),
      expectedFootprints:input.expectedFootprints,
      foundFootprints:input.foundFootprints
    };
  }

  function parseDocument(text) {
    return normalizeDocument(parseJson(text));
  }

  function serializeDocument(value, space = 2) {
    const indentation = Number(space);
    if (!Number.isInteger(indentation) || indentation < 0 || indentation > 10) {
      throw new RangeError("space must be an integer from 0 to 10");
    }
    return `${JSON.stringify(normalizeDocument(value), null, indentation)}\n`;
  }

  function runDocument(value) {
    const document = typeof value === "string"
      ? parseDocument(value)
      : normalizeDocument(value);
    const session = sessionApi.runMatchingSession({
      expectedFootprints:document.expectedFootprints,
      foundFootprints:document.foundFootprints
    }, document.options);
    return {document, session};
  }

  return Object.freeze({
    DOCUMENT_FORMAT,
    DOCUMENT_VERSION,
    DOCUMENT_UNITS,
    parseJson,
    normalizeOptions,
    normalizeDocument,
    parseDocument,
    serializeDocument,
    runDocument
  });
});
