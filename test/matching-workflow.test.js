const test = require("node:test");
const assert = require("node:assert/strict");
const workflow = require("../js/matching-workflow.js");

function expected(ref, x, y, side = "TOP") {
  return {id:`expected:${ref}`, ref, side, center:{x, y}};
}

test("selects three stable, non-collinear calibration anchors", () => {
  const anchors = workflow.selectCalibrationAnchors([
    expected("R1", 0, 0),
    expected("R2", 100, 0),
    expected("R3", 0, 40),
    expected("R4", 50, 20),
    expected("B1", 5, 5, "BOTTOM")
  ], "TOP");

  assert.equal(anchors.length, 3);
  assert.equal(new Set(anchors.map(item => item.id)).size, 3);
  const [a, b, c] = anchors;
  const area = Math.abs(
    (b.mm.x - a.mm.x) * (c.mm.y - a.mm.y)
    - (b.mm.y - a.mm.y) * (c.mm.x - a.mm.x)
  );
  assert.ok(area > 0);
});

test("creates manual rows when the session has too few usable points", () => {
  const rows = workflow.createCalibrationRows([expected("R1", 10, 20)], "TOP");
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0].mm, {x:10, y:20});
  assert.deepEqual(rows[0].pixel, {x:null, y:null});
  assert.match(rows[2].id, /^manual:TOP:/);
});

test("fits a side calibration from completed workflow rows", () => {
  const result = workflow.fitSideCalibration({
    side:"BOTTOM",
    maxResidualPx:0.1,
    rows:[
      {mm:{x:0, y:0}, pixel:{x:100, y:50}},
      {mm:{x:10, y:0}, pixel:{x:80, y:50}},
      {mm:{x:0, y:10}, pixel:{x:100, y:70}}
    ]
  });

  assert.equal(result.side, "BOTTOM");
  assert.equal(result.mirrored, true);
  assert.ok(result.maxResidualPx < 1e-9);
});

test("rejects incomplete calibration rows before fitting", () => {
  assert.throws(() => workflow.normalizeCalibrationRows([
    {mm:{x:0, y:0}, pixel:{x:10, y:10}},
    {mm:{x:1, y:0}, pixel:{x:null, y:null}},
    {mm:{x:0, y:1}, pixel:{x:10, y:20}}
  ]), /rows\[1\]\.pixel\.x is required/);
});

test("builds side preview data and translates skip reasons", () => {
  const plan = {
    entries:[
      {side:"TOP", action:"update", ref:"R1"},
      {side:"TOP", action:"skip", ref:"R2", reason:"outside_image"},
      {side:"BOTTOM", action:"skip", ref:"R3", reason:"calibration_missing"}
    ]
  };
  const top = workflow.planForSide(plan, "TOP");

  assert.equal(top.updates.length, 1);
  assert.equal(top.skipped.length, 1);
  assert.deepEqual(top.skipReasons, {outside_image:1});
  assert.equal(
    workflow.skipReasonLabel("outside_image"),
    "Предлагаемая область выходит за изображение"
  );
});
