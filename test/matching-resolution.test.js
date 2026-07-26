const test = require("node:test");
const assert = require("node:assert/strict");
const resolution = require("../js/matching-resolution.js");

function candidate(id, options = {}) {
  return {
    withinRadius:options.withinRadius ?? true,
    classification:options.classification ?? "unknown_geometry",
    centerDistance:options.distance ?? 0.5,
    found:{
      id,
      side:options.side ?? "TOP",
      geometry:options.geometry === false ? null : {
        pads:[{x:0, y:0, width:2, height:1}]
      }
    }
  };
}

function session(status = "matched_uncertain_geometry") {
  return {
    input:{foundFootprints:[]},
    results:[{
      expectedId:"TOP:R1",
      expectedRef:"R1",
      side:"TOP",
      status,
      selectedFoundId:"found-1",
      candidates:[candidate("found-1"), candidate("outside", {withinRadius:false})]
    }]
  };
}

test("requires explicit operator confirmation for uncertain results", () => {
  const original = session();
  assert.equal(resolution.applicableResult(original.results[0]), false);
  const confirmed = resolution.resolveResult(original, 0, "found-1");

  assert.equal(resolution.applicableResult(confirmed.results[0]), true);
  assert.equal(confirmed.results[0].operatorConfirmed, true);
  assert.equal(original.results[0].operatorConfirmed, undefined);
  assert.equal(resolution.countApplicable(confirmed.results), 1);
});

test("only offers same-side in-radius candidates with geometry", () => {
  const value = session("ambiguous_unknown_geometry");
  value.results[0].candidates.push(
    candidate("wrong-side", {side:"BOTTOM"}),
    candidate("no-geometry", {geometry:false})
  );
  assert.deepEqual(
    resolution.selectableCandidates(value.results[0]).map(item => item.id),
    ["found-1"]
  );
  assert.throws(
    () => resolution.resolveResult(value, 0, "wrong-side"),
    /не является допустимым кандидатом/
  );
});

test("clearing a manual choice restores the automatic selection contract", () => {
  const automatic = session("matched_exact");
  automatic.results[0].selectedFound = {id:"found-1"};
  const confirmed = resolution.resolveResult(automatic, 0, "found-1");
  const cleared = resolution.resolveResult(confirmed, 0, "");

  assert.equal(cleared.results[0].operatorConfirmed, undefined);
  assert.equal(cleared.results[0].selectedFoundId, "found-1");
  assert.equal(resolution.applicableResult(cleared.results[0]), true);
});
