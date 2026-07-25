const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SESSION_VERSION,
  normalizeSessionInput,
  summarizeResults,
  runMatchingSession
} = require("../js/matching-session.js");

function geometry(pads = [
  {x:-1, y:0, width:1, height:1},
  {x:1, y:0, width:1, height:1}
]) {
  return {pads};
}

test("normalizes canonical matching input without mutating its source", () => {
  const source = {
    expectedFootprints:[{
      ref:"R1",
      side:"top",
      center:{x:10, y:20},
      rotation:90,
      geometry:geometry([{x:0, y:0, w:1, h:2}])
    }],
    foundFootprints:[{
      side:"TOP",
      x:10.2,
      y:20,
      geometry:null
    }]
  };
  const snapshot = structuredClone(source);
  const normalized = normalizeSessionInput(source);

  assert.deepEqual(source, snapshot);
  assert.equal(normalized.version, SESSION_VERSION);
  assert.deepEqual(normalized.expectedFootprints[0], {
    id:"TOP:R1",
    ref:"R1",
    side:"TOP",
    center:{x:10, y:20},
    x:10,
    y:20,
    rotationDegrees:90,
    geometry:{pads:[{x:0, y:0, width:1, height:2}]}
  });
  assert.equal(normalized.foundFootprints[0].id, "found:TOP:1");
});

test("rejects invalid sides, dimensions, missing refs, and duplicate ids", () => {
  assert.throws(() => normalizeSessionInput({
    expectedFootprints:[{ref:"", side:"TOP", x:0, y:0}],
    foundFootprints:[]
  }), /non-empty string/);
  assert.throws(() => normalizeSessionInput({
    expectedFootprints:[{ref:"R1", side:"LEFT", x:0, y:0}],
    foundFootprints:[]
  }), /TOP or BOTTOM/);
  assert.throws(() => normalizeSessionInput({
    expectedFootprints:[{ref:"R1", side:"TOP", x:0, y:0}],
    foundFootprints:[{
      id:"F1",
      side:"TOP",
      x:0,
      y:0,
      geometry:geometry([{x:0, y:0, width:0, height:1}])
    }]
  }), /greater than zero/);
  assert.throws(() => normalizeSessionInput({
    expectedFootprints:[
      {id:"same", ref:"R1", side:"TOP", x:0, y:0},
      {id:"same", ref:"R2", side:"TOP", x:10, y:0}
    ],
    foundFootprints:[]
  }), /must be unique/);
});

test("runs the matching core and exposes stable selected identifiers", () => {
  const session = runMatchingSession({
    expectedFootprints:[
      {ref:"R1", side:"TOP", x:0, y:0, geometry:geometry()},
      {ref:"C1", side:"TOP", x:20, y:0, geometry:null}
    ],
    foundFootprints:[
      {id:"detected-1", side:"TOP", x:0.1, y:0, geometry:geometry()},
      {id:"detected-2", side:"TOP", x:20, y:0, geometry:null}
    ]
  });

  assert.deepEqual(
    session.results.map(result => [
      result.expectedId,
      result.status,
      result.selectedFoundId
    ]),
    [
      ["TOP:R1", "matched_exact", "detected-1"],
      ["TOP:C1", "matched_uncertain_geometry", "detected-2"]
    ]
  );
  assert.deepEqual(session.summary, {
    total:2,
    matched:2,
    ambiguous:0,
    unmatched:0,
    byStatus:{
      matched_exact:1,
      matched_acceptable:0,
      matched_uncertain_geometry:1,
      ambiguous_exact:0,
      ambiguous_acceptable:0,
      ambiguous_unknown_geometry:0,
      unmatched:0
    }
  });
});

test("summarizes ambiguous and unmatched results independently", () => {
  const summary = summarizeResults([
    {status:"ambiguous_exact"},
    {status:"ambiguous_unknown_geometry"},
    {status:"unmatched"}
  ]);

  assert.equal(summary.total, 3);
  assert.equal(summary.matched, 0);
  assert.equal(summary.ambiguous, 2);
  assert.equal(summary.unmatched, 1);
});

test("produces a JSON-serializable result", () => {
  const result = runMatchingSession({
    expectedFootprints:[{ref:"U1", side:"BOTTOM", x:5, y:8, geometry:null}],
    foundFootprints:[{side:"BOTTOM", x:5, y:8, geometry:null}]
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});
