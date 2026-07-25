const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_OPTIONS,
  prepareGeometry,
  exactTolerance,
  findOptimalAssignment,
  compareFootprintGeometry
} = require("../js/matching-geometry.js");

function geometry(pads) {
  return {pads};
}

test("calculates the approved absolute plus relative tolerance", () => {
  assert.equal(exactTolerance(2, DEFAULT_OPTIONS), 0.2);
  assert.equal(exactTolerance(10, DEFAULT_OPTIONS), 0.6);
});

test("centers geometry and rotates pad positions and dimensions", () => {
  const prepared = prepareGeometry(geometry([
    {x:-2, y:0, width:2, height:1},
    {x:2, y:0, width:2, height:1}
  ]), 90);

  assert.ok(Math.abs(prepared.pads[0].x) < 1e-12);
  assert.equal(prepared.pads[0].y, -2);
  assert.ok(Math.abs(prepared.pads[0].width - 1) < 1e-12);
  assert.equal(prepared.pads[0].height, 2);
  assert.ok(Math.abs(prepared.boundingBox.width - 1) < 1e-12);
  assert.equal(prepared.boundingBox.height, 6);
});

test("finds a minimum one-to-one pad assignment", () => {
  const result = findOptimalAssignment([
    [4, 1, 3],
    [2, 0, 5],
    [3, 2, 2]
  ]);

  assert.deepEqual(result.assignment, [1, 0, 2]);
  assert.equal(result.totalCost, 5);
  assert.equal(result.ambiguous, false);
});

test("detects different assignments with equal minimum cost", () => {
  const result = findOptimalAssignment([
    [0, 0],
    [0, 0]
  ]);

  assert.equal(result.totalCost, 0);
  assert.equal(result.alternativeCost, 0);
  assert.equal(result.ambiguous, true);
});

test("uses the approved 1e-9 threshold for assignment ambiguity", () => {
  const withinThreshold = findOptimalAssignment([
    [0, 0],
    [0, 0.0000000009]
  ]);
  const outsideThreshold = findOptimalAssignment([
    [0, 0],
    [0, 0.0000000011]
  ]);

  assert.equal(withinThreshold.ambiguous, true);
  assert.equal(outsideThreshold.ambiguous, false);
});

test("classifies identical geometry as exact regardless of pad order", () => {
  const expected = geometry([
    {x:-1, y:0, width:0.5, height:1},
    {x:1, y:0, width:0.5, height:1}
  ]);
  const found = geometry([
    {x:1, y:0, width:0.5, height:1},
    {x:-1, y:0, width:0.5, height:1}
  ]);
  const result = compareFootprintGeometry(expected, found);

  assert.equal(result.classification, "exact");
  assert.deepEqual(result.assignment.map((pair) => pair.foundPadIndex), [1, 0]);
  assert.equal(result.totalCost, 0);
  assert.equal(result.maxNormalizedDeviation, 0);
});

test("applies the Pick and Place rotation before comparison", () => {
  const expected = geometry([
    {x:-2, y:0, width:2, height:1},
    {x:2, y:0, width:2, height:1}
  ]);
  const found = geometry([
    {x:0, y:-2, width:1, height:2},
    {x:0, y:2, width:1, height:2}
  ]);

  assert.equal(
    compareFootprintGeometry(expected, found, {expectedRotationDegrees:90}).classification,
    "exact"
  );
});

test("classifies a deviation between one and one and a half tolerances as acceptable", () => {
  const expected = geometry([
    {x:-2, y:0, width:1, height:1},
    {x:0, y:0, width:1, height:1},
    {x:2, y:0, width:1, height:1}
  ]);
  const found = geometry([
    {x:-2, y:0, width:1, height:1},
    {x:0.42, y:0, width:1, height:1},
    {x:2, y:0, width:1, height:1}
  ]);
  const result = compareFootprintGeometry(expected, found);

  assert.equal(result.classification, "acceptable");
  assert.ok(result.maxNormalizedDeviation > 1);
  assert.ok(result.maxNormalizedDeviation <= 1.5);
});

test("includes exact and acceptable tolerance boundaries", () => {
  const expected = geometry([
    {x:-2, y:0, width:1, height:1},
    {x:0, y:0, width:1, height:1},
    {x:2, y:0, width:1, height:1}
  ]);
  const exactBoundary = geometry([
    {x:-2, y:0, width:1, height:1},
    {x:0.35, y:0, width:1, height:1},
    {x:2, y:0, width:1, height:1}
  ]);
  const acceptableBoundary = geometry([
    {x:-2, y:0, width:1, height:1},
    {x:0.525, y:0, width:1, height:1},
    {x:2, y:0, width:1, height:1}
  ]);

  assert.equal(compareFootprintGeometry(expected, exactBoundary).classification, "exact");
  assert.equal(compareFootprintGeometry(expected, acceptableBoundary).classification, "acceptable");
});

test("rejects a pad deviation above the acceptable multiplier", () => {
  const expected = geometry([
    {x:-2, y:0, width:1, height:1},
    {x:0, y:0, width:1, height:1},
    {x:2, y:0, width:1, height:1}
  ]);
  const found = geometry([
    {x:-2, y:0, width:1, height:1},
    {x:0.6, y:0, width:1, height:1},
    {x:2, y:0, width:1, height:1}
  ]);
  const result = compareFootprintGeometry(expected, found);

  assert.equal(result.classification, "unsuitable");
  assert.equal(result.reason, "pad_tolerance_exceeded");
});

test("requires pad count and total bounding box to remain within exact tolerance", () => {
  const expected = geometry([
    {x:-1, y:0, width:1, height:1},
    {x:1, y:0, width:1, height:1}
  ]);
  const wrongCount = compareFootprintGeometry(expected, geometry([
    {x:0, y:0, width:1, height:1}
  ]));
  const wrongBounds = compareFootprintGeometry(expected, geometry([
    {x:-2, y:0, width:1, height:1},
    {x:2, y:0, width:1, height:1}
  ]));

  assert.equal(wrongCount.reason, "pad_count_mismatch");
  assert.equal(wrongBounds.reason, "bounding_box_tolerance_exceeded");
});

test("excludes a candidate when the minimum pad assignment is ambiguous", () => {
  const overlapping = geometry([
    {x:0, y:0, width:1, height:1},
    {x:0, y:0, width:1, height:1}
  ]);
  const result = compareFootprintGeometry(overlapping, overlapping);

  assert.equal(result.classification, "unsuitable");
  assert.equal(result.reason, "ambiguous_pad_assignment");
  assert.equal(result.totalCost, 0);
  assert.equal(result.alternativeCost, 0);
});

test("returns unknown geometry when either side has no pads", () => {
  assert.deepEqual(compareFootprintGeometry(null, geometry([
    {x:0, y:0, width:1, height:1}
  ])), {
    classification:"unknown_geometry",
    reason:"geometry_missing"
  });
  assert.equal(
    compareFootprintGeometry(geometry([{x:0, y:0, width:1, height:1}]), {pads:[]}).classification,
    "unknown_geometry"
  );
});

test("does not mutate source geometry", () => {
  const source = geometry([
    {x:10, y:20, w:1, h:2},
    {x:12, y:20, w:1, h:2}
  ]);
  const snapshot = structuredClone(source);

  prepareGeometry(source, 45);

  assert.deepEqual(source, snapshot);
});
