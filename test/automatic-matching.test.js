const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_OPTIONS,
  geometryDiagonal,
  densityLimitFor,
  baseRadiusFor,
  evaluateCandidate,
  statusForCandidates,
  matchExpectedFootprint,
  matchFootprints
} = require("../js/automatic-matching.js");

function geometry(pads) {
  return {pads};
}

function twoPadGeometry(overrides = {}) {
  return geometry([
    {x:-1, y:0, width:1, height:1, ...overrides},
    {x:1, y:0, width:1, height:1, ...overrides}
  ]);
}

function footprint(ref, x, y, geometryValue = twoPadGeometry(), side = "TOP") {
  return {ref, x, y, side, geometry:geometryValue};
}

test("uses the selected radius scale of one and a half", () => {
  const expected = footprint("R1", 0, 0);
  const base = baseRadiusFor(expected, footprint("F1", 0, 0), DEFAULT_OPTIONS);

  assert.equal(DEFAULT_OPTIONS.radiusScale, 1.5);
  assert.equal(base.source, "expected_geometry");
  assert.equal(base.geometryDiagonal, geometryDiagonal(expected.geometry));
  assert.equal(base.baseRadius, 1.5 * base.geometryDiagonal);
});

test("falls back to found geometry and then to the configurable default radius", () => {
  const expectedWithoutGeometry = footprint("R1", 0, 0, null);
  const foundWithGeometry = footprint("F1", 0, 0);
  const foundWithoutGeometry = footprint("F2", 0, 0, null);

  assert.equal(
    baseRadiusFor(expectedWithoutGeometry, foundWithGeometry, DEFAULT_OPTIONS).source,
    "found_geometry"
  );
  assert.deepEqual(
    baseRadiusFor(expectedWithoutGeometry, foundWithoutGeometry, {
      ...DEFAULT_OPTIONS,
      defaultRadiusMm:7
    }),
    {
      source:"default",
      geometryDiagonal:null,
      baseRadius:7
    }
  );
});

test("limits radius to half the nearest expected-neighbor distance on the same side", () => {
  const expected = [
    footprint("R1", 0, 0),
    footprint("R2", 8, 0),
    footprint("R3", 2, 0, twoPadGeometry(), "BOTTOM"),
    footprint("R4", 12, 0)
  ];

  assert.deepEqual(densityLimitFor(0, expected), {
    nearestNeighborDistance:8,
    densityRadius:4
  });
  assert.deepEqual(densityLimitFor(2, expected), {
    nearestNeighborDistance:null,
    densityRadius:null
  });
});

test("includes a candidate exactly on the final radius boundary", () => {
  const expected = footprint("R1", 0, 0, null);
  const found = footprint("F1", 5, 0, null);
  const result = evaluateCandidate(
    expected,
    found,
    {densityRadius:null},
    DEFAULT_OPTIONS
  );

  assert.equal(result.finalRadius, 5);
  assert.equal(result.centerDistance, 5);
  assert.equal(result.withinRadius, true);
  assert.equal(result.classification, "unknown_geometry");
});

test("rejects candidates outside the radius and candidates on the other side", () => {
  const expected = footprint("R1", 0, 0, null);
  const outside = evaluateCandidate(
    expected,
    footprint("F1", 5.001, 0, null),
    {densityRadius:null},
    DEFAULT_OPTIONS
  );
  const otherSide = evaluateCandidate(
    expected,
    footprint("F2", 0, 0, null, "BOTTOM"),
    {densityRadius:null},
    DEFAULT_OPTIONS
  );

  assert.equal(outside.reason, "outside_radius");
  assert.equal(otherSide.reason, "side_mismatch");
});

test("uses the density limit when it is smaller than the base radius", () => {
  const expected = footprint("R1", 0, 0);
  const found = footprint("F1", 2.1, 0);
  const result = evaluateCandidate(
    expected,
    found,
    {densityRadius:2},
    DEFAULT_OPTIONS
  );

  assert.ok(result.baseRadius > 2);
  assert.equal(result.finalRadius, 2);
  assert.equal(result.reason, "outside_radius");
});

test("selects by exact, acceptable, then unknown geometry priority", () => {
  const unknown = {classification:"unknown_geometry", found:{ref:"unknown"}};
  const acceptable = {classification:"acceptable", found:{ref:"acceptable"}};
  const exact = {classification:"exact", found:{ref:"exact"}};

  assert.equal(statusForCandidates([unknown]).status, "matched_uncertain_geometry");
  assert.equal(statusForCandidates([unknown, acceptable]).status, "matched_acceptable");
  const selected = statusForCandidates([unknown, acceptable, exact]);
  assert.equal(selected.status, "matched_exact");
  assert.equal(selected.selected.found.ref, "exact");
});

test("reports ambiguity when multiple candidates share the highest available class", () => {
  assert.equal(statusForCandidates([
    {classification:"exact"},
    {classification:"exact"},
    {classification:"acceptable"}
  ]).status, "ambiguous_exact");
  assert.equal(statusForCandidates([
    {classification:"acceptable"},
    {classification:"acceptable"},
    {classification:"unknown_geometry"}
  ]).status, "ambiguous_acceptable");
  assert.equal(statusForCandidates([
    {classification:"unknown_geometry"},
    {classification:"unknown_geometry"}
  ]).status, "ambiguous_unknown_geometry");
});

test("matches one exact candidate and keeps radius diagnostics", () => {
  const expected = [footprint("R1", 0, 0), footprint("R2", 20, 0)];
  const found = [
    footprint("F1", 0.2, 0),
    footprint("F2", 30, 0),
    footprint("F3", 0, 0, twoPadGeometry(), "BOTTOM")
  ];
  const result = matchExpectedFootprint(0, expected, found);

  assert.equal(result.status, "matched_exact");
  assert.equal(result.selectedFound.ref, "F1");
  assert.equal(result.densityRadius, 10);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].classification, "exact");
  assert.equal(result.candidates[1].reason, "outside_radius");
});

test("returns unmatched when no same-side candidate is inside its radius", () => {
  const result = matchExpectedFootprint(
    0,
    [footprint("R1", 0, 0, null)],
    [footprint("F1", 6, 0, null), footprint("F2", 0, 0, null, "BOTTOM")]
  );

  assert.equal(result.status, "unmatched");
  assert.equal(result.selectedFound, null);
});

test("matches every expected footprint independently", () => {
  const expected = [
    footprint("R1", 0, 0, null),
    footprint("R2", 20, 0, null)
  ];
  const found = [
    footprint("F1", 0, 0, null),
    footprint("F2", 20, 0, null)
  ];
  const results = matchFootprints(expected, found);

  assert.deepEqual(
    results.map(result => [result.expectedRef, result.status, result.selectedFound.ref]),
    [
      ["R1", "matched_uncertain_geometry", "F1"],
      ["R2", "matched_uncertain_geometry", "F2"]
    ]
  );
});

test("rejects invalid radii, sides, centers, and indexes", () => {
  assert.throws(
    () => baseRadiusFor(footprint("R1", 0, 0), footprint("F1", 0, 0), {
      radiusScale:0,
      defaultRadiusMm:5
    }),
    /radiusScale/
  );
  assert.throws(
    () => matchExpectedFootprint(0, [{side:"LEFT", x:0, y:0}], []),
    /TOP or BOTTOM/
  );
  assert.throws(
    () => matchExpectedFootprint(0, [{side:"TOP", x:"bad", y:0}], []),
    /finite number/
  );
  assert.throws(
    () => matchExpectedFootprint(2, [footprint("R1", 0, 0)], []),
    /outside expectedFootprints/
  );
});
