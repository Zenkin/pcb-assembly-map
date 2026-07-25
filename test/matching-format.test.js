const test = require("node:test");
const assert = require("node:assert/strict");
const matchingFormat = require("../js/matching-format.js");

function document(overrides = {}) {
  return {
    format:"soldermap-matching-session",
    version:1,
    units:"mm",
    expectedFootprints:[{
      ref:"R1",
      side:"top",
      center:{x:10, y:20},
      geometry:null
    }],
    foundFootprints:[{
      id:"detected-1",
      side:"TOP",
      x:10.2,
      y:20,
      geometry:null
    }],
    ...overrides
  };
}

test("parses and normalizes a versioned millimeter document", () => {
  const normalized = matchingFormat.parseDocument(`\uFEFF${JSON.stringify(document())}`);

  assert.equal(normalized.format, matchingFormat.DOCUMENT_FORMAT);
  assert.equal(normalized.version, matchingFormat.DOCUMENT_VERSION);
  assert.equal(normalized.units, matchingFormat.DOCUMENT_UNITS);
  assert.deepEqual(normalized.options, {
    radiusScale:1.5,
    defaultRadiusMm:5
  });
  assert.equal(normalized.expectedFootprints[0].id, "TOP:R1");
  assert.deepEqual(normalized.foundFootprints[0].center, {x:10.2, y:20});
});

test("preserves explicit matching options after validation", () => {
  const normalized = matchingFormat.normalizeDocument(document({
    options:{radiusScale:2, defaultRadiusMm:8}
  }));

  assert.deepEqual(normalized.options, {
    radiusScale:2,
    defaultRadiusMm:8
  });
});

test("rejects empty and malformed JSON with format-specific errors", () => {
  assert.throws(() => matchingFormat.parseDocument("  "), /file is empty/);
  assert.throws(
    () => matchingFormat.parseDocument("{not-json}"),
    /contains invalid JSON/
  );
});

test("rejects unsupported format versions and non-millimeter coordinates", () => {
  assert.throws(
    () => matchingFormat.normalizeDocument(document({format:"other"})),
    /format must be/
  );
  assert.throws(
    () => matchingFormat.normalizeDocument(document({version:2})),
    /unsupported matching session version/
  );
  assert.throws(
    () => matchingFormat.normalizeDocument(document({units:"px"})),
    /units must be "mm"/
  );
  assert.throws(
    () => matchingFormat.normalizeDocument(document({units:"MM"})),
    /units must be "mm"/
  );
});

test("rejects invalid options and footprint data", () => {
  assert.throws(
    () => matchingFormat.normalizeDocument(document({
      options:{defaultRadiusMm:0}
    })),
    /greater than zero/
  );
  assert.throws(
    () => matchingFormat.normalizeDocument(document({
      expectedFootprints:[{ref:"R1", side:"LEFT", x:0, y:0}]
    })),
    /TOP or BOTTOM/
  );
});

test("serializes a canonical document with a final newline", () => {
  const serialized = matchingFormat.serializeDocument(document(), 2);
  const parsed = JSON.parse(serialized);

  assert.equal(serialized.endsWith("\n"), true);
  assert.equal(parsed.expectedFootprints[0].side, "TOP");
  assert.deepEqual(parsed.options, {
    radiusScale:1.5,
    defaultRadiusMm:5
  });
});

test("runs matching directly from document text", () => {
  const result = matchingFormat.runDocument(JSON.stringify(document()));

  assert.equal(result.session.results[0].status, "matched_uncertain_geometry");
  assert.equal(result.session.results[0].selectedFoundId, "detected-1");
  assert.deepEqual(result.session.summary, {
    total:1,
    matched:1,
    ambiguous:0,
    unmatched:0,
    byStatus:{
      matched_exact:0,
      matched_acceptable:0,
      matched_uncertain_geometry:1,
      ambiguous_exact:0,
      ambiguous_acceptable:0,
      ambiguous_unknown_geometry:0,
      unmatched:0
    }
  });
});
