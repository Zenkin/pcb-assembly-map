const test = require("node:test");
const assert = require("node:assert/strict");
const matchingFormat = require("../js/matching-format.js");
const matchingView = require("../js/matching-view.js");

function sessionDocument() {
  return {
    format:"soldermap-matching-session",
    version:1,
    units:"mm",
    expectedFootprints:[
      {id:"expected-r1", ref:"R1", side:"TOP", x:10, y:10},
      {id:"expected-c1", ref:"C1", side:"BOTTOM", x:30, y:30}
    ],
    foundFootprints:[
      {id:"found-1", side:"TOP", x:11, y:10},
      {id:"found-2", side:"TOP", x:40, y:40}
    ]
  };
}

test("builds a compact Russian presentation model from a matching run", () => {
  const view = matchingView.buildViewModel(
    "board-session.json",
    matchingFormat.runDocument(sessionDocument())
  );

  assert.equal(view.sourceName, "board-session.json");
  assert.deepEqual(view.summary, {
    total:2,
    matched:1,
    ambiguous:0,
    unmatched:1,
    applicable:0,
    confirmed:0
  });
  assert.equal(view.foundCount, 2);
  assert.equal(view.options.radiusScale, 1.5);
  assert.equal(view.options.defaultRadiusMm, 5);
  assert.deepEqual(view.rows.map(row => ({
    ref:row.ref,
    side:row.side,
    status:row.status,
      selectedFoundId:row.selectedFoundId,
      candidatesInRadius:row.candidatesInRadius,
      applicable:row.applicable
  })), [
    {
      ref:"R1",
      side:"TOP",
      status:"matched_uncertain_geometry",
      selectedFoundId:"found-1",
      candidatesInRadius:1,
      applicable:false
    },
    {
      ref:"C1",
      side:"BOTTOM",
      status:"unmatched",
      selectedFoundId:"",
      candidatesInRadius:0,
      applicable:false
    }
  ]);
});

test("provides labels and tones for every supported result status", () => {
  assert.deepEqual(Object.keys(matchingView.STATUS_META), [
    "matched_exact",
    "matched_acceptable",
    "matched_uncertain_geometry",
    "ambiguous_exact",
    "ambiguous_acceptable",
    "ambiguous_unknown_geometry",
    "unmatched"
  ]);
  Object.values(matchingView.STATUS_META).forEach(meta => {
    assert.ok(meta.label);
    assert.match(meta.tone, /^(matched|uncertain|ambiguous|unmatched)$/);
  });
});

test("rejects unsupported statuses instead of silently displaying them", () => {
  const run = matchingFormat.runDocument(sessionDocument());
  run.session.results[0].status = "future_status";
  assert.throws(
    () => matchingView.buildViewModel("session.json", run),
    /Unsupported matching status/
  );
});
