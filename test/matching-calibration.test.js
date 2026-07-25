const test = require("node:test");
const assert = require("node:assert/strict");
const calibration = require("../js/matching-calibration.js");

function closeTo(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

function point(mmX, mmY, pixelX, pixelY) {
  return {
    mm:{x:mmX, y:mmY},
    pixel:{x:pixelX, y:pixelY}
  };
}

test("fits an affine millimeter-to-pixel transform from redundant control points", () => {
  const result = calibration.fitCalibration({
    side:"top",
    controlPoints:[
      point(0, 0, 100, 50),
      point(10, 0, 120, 60),
      point(0, 10, 95, 80),
      point(10, 10, 115, 90)
    ]
  });

  assert.equal(result.side, "TOP");
  assert.equal(result.controlPointCount, 4);
  assert.equal(result.mirrored, false);
  closeTo(result.transform.a, 2);
  closeTo(result.transform.b, -0.5);
  closeTo(result.transform.c, 100);
  closeTo(result.transform.d, 1);
  closeTo(result.transform.e, 3);
  closeTo(result.transform.f, 50);
  closeTo(result.maxResidualPx, 0);
  assert.deepEqual(
    calibration.transformPoint(result.transform, {x:5, y:4}),
    {x:108, y:67}
  );
});

test("preserves a mirrored BOTTOM calibration as an explicit diagnostic", () => {
  const result = calibration.fitCalibration({
    side:"BOTTOM",
    controlPoints:[
      point(0, 0, 200, 10),
      point(10, 0, 180, 10),
      point(0, 10, 200, 30)
    ]
  });

  assert.equal(result.mirrored, true);
  assert.ok(result.determinant < 0);
  const mapped = calibration.transformPoint(result.transform, {x:3, y:4});
  closeTo(mapped.x, 194);
  closeTo(mapped.y, 18);
});

test("reports residuals and rejects a calibration above its error limit", () => {
  const controlPoints = [
    point(0, 0, 0, 0),
    point(10, 0, 10, 0),
    point(0, 10, 0, 10),
    point(10, 10, 12, 10)
  ];
  const accepted = calibration.fitCalibration({
    side:"TOP",
    maxResidualPx:1,
    controlPoints
  });

  closeTo(accepted.maxResidualPx, 0.5);
  closeTo(accepted.rmsResidualPx, 0.5);
  assert.throws(
    () => calibration.fitCalibration({
      side:"TOP",
      maxResidualPx:0.49,
      controlPoints
    }),
    /residual .* exceeds/
  );
});

test("rejects collinear control points and malformed calibration input", () => {
  assert.throws(
    () => calibration.fitCalibration({
      side:"TOP",
      controlPoints:[
        point(0, 0, 0, 0),
        point(1, 1, 10, 10),
        point(2, 2, 20, 20)
      ]
    }),
    /must not be collinear/
  );
  assert.throws(
    () => calibration.normalizeCalibration({
      side:"LEFT",
      controlPoints:[
        point(0, 0, 0, 0),
        point(1, 0, 1, 0),
        point(0, 1, 0, 1)
      ]
    }),
    /TOP or BOTTOM/
  );
  assert.throws(
    () => calibration.normalizeCalibration({
      side:"TOP",
      controlPoints:[point(0, 0, 0, 0)]
    }),
    /at least three/
  );
});

test("maps all four bounds corners before forming a pixel-aligned box", () => {
  const bounds = calibration.transformBounds({
    a:0,
    b:-2,
    c:100,
    d:3,
    e:0,
    f:50
  }, {
    minX:-1,
    minY:-2,
    maxX:1,
    maxY:2
  });

  assert.deepEqual(bounds, {
    minX:96,
    minY:47,
    maxX:104,
    maxY:53,
    corners:[
      {x:104, y:47},
      {x:104, y:53},
      {x:96, y:53},
      {x:96, y:47}
    ]
  });
});
