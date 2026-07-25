const test = require("node:test");
const assert = require("node:assert/strict");
const calibration = require("../js/matching-calibration.js");
const application = require("../js/matching-application.js");

function fittedCalibration(side = "TOP", mirrored = false) {
  const pixelX = x => mirrored ? 200 - 10 * x : 100 + 10 * x;
  return calibration.fitCalibration({
    side,
    controlPoints:[
      {mm:{x:0, y:0}, pixel:{x:pixelX(0), y:50}},
      {mm:{x:10, y:0}, pixel:{x:pixelX(10), y:50}},
      {mm:{x:0, y:10}, pixel:{x:pixelX(0), y:150}}
    ]
  });
}

function footprint(id, side, x, y, geometry = {
  pads:[
    {x:-1, y:0, width:1, height:2},
    {x:1, y:0, width:1, height:2}
  ]
}) {
  return {id, side, center:{x, y}, geometry};
}

function result(ref, status, selectedFoundId, side = "TOP") {
  return {
    expectedId:`${side}:${ref}`,
    expectedRef:ref,
    side,
    status,
    selectedFoundId
  };
}

function session(results, foundFootprints) {
  return {
    input:{foundFootprints},
    results
  };
}

function planInput(overrides = {}) {
  const found = footprint("found-1", "TOP", 5, 4);
  return {
    components:[{
      ref:"R1",
      side:"TOP",
      stage:"1",
      group:"resistors",
      value:"10k",
      note:"keep",
      x:1,
      y:2,
      w:3,
      h:4
    }],
    imageSizes:{TOP:{w:400, h:300}},
    calibrations:{TOP:fittedCalibration()},
    session:session([result("R1", "matched_exact", "found-1")], [found]),
    ...overrides
  };
}

test("builds an integer enclosing pixel box for an exact match", () => {
  const plan = application.createApplicationPlan(planInput());

  assert.deepEqual(plan.summary, {
    total:1,
    updates:1,
    skipped:0,
    byReason:{}
  });
  assert.deepEqual(plan.entries[0].before, {
    x:1,
    y:2,
    w:3,
    h:4,
    unplaced:false
  });
  assert.deepEqual(plan.entries[0].after, {
    x:135,
    y:80,
    w:30,
    h:20
  });
  assert.deepEqual(plan.entries[0].millimeterBounds, {
    minX:3.5,
    minY:3,
    maxX:6.5,
    maxY:5
  });
});

test("applies planned geometry without changing other component fields or inputs", () => {
  const input = planInput({
    components:[{
      ref:"R1",
      side:"TOP",
      stage:"1",
      group:"resistors",
      value:"10k",
      note:"keep",
      x:0,
      y:0,
      w:1,
      h:1,
      unplaced:true
    }]
  });
  const snapshot = structuredClone(input);
  const plan = application.createApplicationPlan(input);
  const next = application.applyApplicationPlan(input.components, plan);

  assert.deepEqual(input, snapshot);
  assert.deepEqual(next[0], {
    ref:"R1",
    side:"TOP",
    stage:"1",
    group:"resistors",
    value:"10k",
    note:"keep",
    x:135,
    y:80,
    w:30,
    h:20
  });
});

test("accepts an acceptable match and a mirrored BOTTOM calibration", () => {
  const found = footprint("bottom-1", "BOTTOM", 5, 4);
  const input = planInput({
    components:[{ref:"C1", side:"BOTTOM", x:1, y:2, w:3, h:4}],
    imageSizes:{BOTTOM:{w:300, h:300}},
    calibrations:{BOTTOM:fittedCalibration("BOTTOM", true)},
    session:session(
      [result("C1", "matched_acceptable", "bottom-1", "BOTTOM")],
      [found]
    )
  });
  const plan = application.createApplicationPlan(input);

  assert.equal(plan.entries[0].action, "update");
  assert.equal(plan.entries[0].calibration.mirrored, true);
  assert.deepEqual(plan.entries[0].after, {x:135, y:80, w:30, h:20});
});

test("skips uncertain, ambiguous, and unmatched results", () => {
  const found = footprint("found-1", "TOP", 5, 4);
  const statuses = [
    "matched_uncertain_geometry",
    "ambiguous_exact",
    "ambiguous_acceptable",
    "ambiguous_unknown_geometry",
    "unmatched"
  ];
  const input = planInput({
    components:statuses.map((status, index) => ({
      ref:`R${index + 1}`,
      side:"TOP",
      x:0,
      y:0,
      w:1,
      h:1
    })),
    session:session(
      statuses.map((status, index) => result(`R${index + 1}`, status, "found-1")),
      [found]
    )
  });
  const plan = application.createApplicationPlan(input);

  assert.equal(plan.summary.updates, 0);
  assert.equal(plan.summary.skipped, statuses.length);
  assert.deepEqual(plan.summary.byReason, {status_not_applicable:statuses.length});
});

test("reports missing and duplicate project components without guessing", () => {
  const found = footprint("found-1", "TOP", 5, 4);
  const input = planInput({
    components:[
      {ref:"R1", side:"TOP", x:0, y:0, w:1, h:1},
      {ref:"r1", side:"TOP", x:2, y:2, w:1, h:1}
    ],
    session:session([
      result("R1", "matched_exact", "found-1"),
      result("C1", "matched_exact", "found-2")
    ], [
      found,
      footprint("found-2", "TOP", 7, 4)
    ])
  });
  const plan = application.createApplicationPlan(input);

  assert.deepEqual(
    plan.entries.map(entry => entry.reason),
    ["project_component_duplicate", "project_component_missing"]
  );
});

test("rejects reuse of one detected footprint by multiple expected components", () => {
  const found = footprint("found-1", "TOP", 5, 4);
  const input = planInput({
    components:[
      {ref:"R1", side:"TOP", x:0, y:0, w:1, h:1},
      {ref:"R2", side:"TOP", x:2, y:2, w:1, h:1}
    ],
    session:session([
      result("R1", "matched_exact", "found-1"),
      result("R2", "matched_exact", "found-1")
    ], [found])
  });
  const plan = application.createApplicationPlan(input);

  assert.deepEqual(
    plan.entries.map(entry => entry.reason),
    ["selected_footprint_reused", "selected_footprint_reused"]
  );
});

test("rejects multiple matching results that target one project component", () => {
  const input = planInput({
    session:session([
      result("R1", "matched_exact", "found-1"),
      {
        ...result("r1", "matched_acceptable", "found-2"),
        expectedId:"TOP:alternate-r1"
      }
    ], [
      footprint("found-1", "TOP", 5, 4),
      footprint("found-2", "TOP", 7, 4)
    ])
  });
  const plan = application.createApplicationPlan(input);

  assert.deepEqual(
    plan.entries.map(entry => entry.reason),
    ["project_component_reused", "project_component_reused"]
  );
});

test("reports missing geometry, calibration, image size, and selected footprints", () => {
  const cases = [
    {
      reason:"selected_geometry_missing",
      mutate:input => {
        input.session.input.foundFootprints[0].geometry = null;
      }
    },
    {
      reason:"calibration_missing",
      mutate:input => {
        input.calibrations = {};
      }
    },
    {
      reason:"image_size_missing",
      mutate:input => {
        input.imageSizes = {};
      }
    },
    {
      reason:"selected_footprint_missing",
      mutate:input => {
        input.session.results[0].selectedFoundId = "missing";
      }
    }
  ];

  cases.forEach(({reason, mutate}) => {
    const input = planInput();
    mutate(input);
    assert.equal(application.createApplicationPlan(input).entries[0].reason, reason);
  });
});

test("rejects a proposed rectangle outside the source image", () => {
  const input = planInput({imageSizes:{TOP:{w:150, h:90}}});
  const entry = application.createApplicationPlan(input).entries[0];

  assert.equal(entry.action, "skip");
  assert.equal(entry.reason, "outside_image");
  assert.deepEqual(entry.proposedGeometry, {x:135, y:80, w:30, h:20});
});

test("refuses to apply a stale plan after component geometry changed", () => {
  const input = planInput();
  const plan = application.createApplicationPlan(input);
  const changed = structuredClone(input.components);
  changed[0].x = 999;

  assert.throws(
    () => application.applyApplicationPlan(changed, plan),
    /component geometry changed/
  );
  assert.throws(
    () => application.applyApplicationPlan(input.components, {...plan, version:2}),
    /unsupported application plan version/
  );
});

test("validates calibration side and found-footprint side", () => {
  const wrongCalibration = planInput();
  wrongCalibration.calibrations.TOP.side = "BOTTOM";
  assert.throws(
    () => application.createApplicationPlan(wrongCalibration),
    /side must match its key/
  );

  const wrongFoundSide = planInput();
  wrongFoundSide.session.input.foundFootprints[0].side = "BOTTOM";
  assert.equal(
    application.createApplicationPlan(wrongFoundSide).entries[0].reason,
    "selected_footprint_side_mismatch"
  );
});
