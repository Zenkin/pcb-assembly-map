(function initMatchingCalibration(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapMatchingCalibration = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchingCalibrationApi() {
  const DEFAULT_MAX_RESIDUAL_PX = 2;
  const PIVOT_EPSILON = 1e-12;

  function finiteNumber(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError(`${name} must be a finite number`);
    return number;
  }

  function positiveNumber(value, name) {
    const number = finiteNumber(value, name);
    if (number <= 0) throw new RangeError(`${name} must be greater than zero`);
    return number;
  }

  function normalizePoint(value, name) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`${name} must be an object`);
    }
    return {
      x:finiteNumber(value.x, `${name}.x`),
      y:finiteNumber(value.y, `${name}.y`)
    };
  }

  function normalizeControlPoint(value, index) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`controlPoints[${index}] must be an object`);
    }
    return {
      mm:normalizePoint(value.mm, `controlPoints[${index}].mm`),
      pixel:normalizePoint(value.pixel, `controlPoints[${index}].pixel`)
    };
  }

  function normalizeSide(value) {
    const side = String(value ?? "").trim().toUpperCase();
    if (side !== "TOP" && side !== "BOTTOM") {
      throw new TypeError("side must be TOP or BOTTOM");
    }
    return side;
  }

  function normalizeCalibration(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("calibration must be an object");
    }
    if (!Array.isArray(value.controlPoints) || value.controlPoints.length < 3) {
      throw new RangeError("controlPoints must contain at least three points");
    }
    return {
      side:normalizeSide(value.side),
      maxResidualPx:positiveNumber(
        value.maxResidualPx ?? DEFAULT_MAX_RESIDUAL_PX,
        "maxResidualPx"
      ),
      controlPoints:value.controlPoints.map(normalizeControlPoint)
    };
  }

  function solveThreeByThree(matrix, vector) {
    const rows = matrix.map((row, index) => [...row, vector[index]]);
    const scale = Math.max(...matrix.flat().map(Math.abs), 1);

    for (let column = 0; column < 3; column += 1) {
      let pivotRow = column;
      for (let row = column + 1; row < 3; row += 1) {
        if (Math.abs(rows[row][column]) > Math.abs(rows[pivotRow][column])) {
          pivotRow = row;
        }
      }
      if (Math.abs(rows[pivotRow][column]) <= PIVOT_EPSILON * scale) {
        throw new Error("calibration control points must not be collinear");
      }
      [rows[column], rows[pivotRow]] = [rows[pivotRow], rows[column]];

      const pivot = rows[column][column];
      for (let item = column; item < 4; item += 1) rows[column][item] /= pivot;
      for (let row = 0; row < 3; row += 1) {
        if (row === column) continue;
        const factor = rows[row][column];
        for (let item = column; item < 4; item += 1) {
          rows[row][item] -= factor * rows[column][item];
        }
      }
    }
    return rows.map(row => row[3]);
  }

  function fitNormalizedAxis(points, pixelKey, mean, coordinateScale) {
    const sums = points.reduce((result, point) => {
      const u = (point.mm.x - mean.x) / coordinateScale;
      const v = (point.mm.y - mean.y) / coordinateScale;
      const pixel = point.pixel[pixelKey];
      result.uu += u * u;
      result.uv += u * v;
      result.vv += v * v;
      result.u += u;
      result.v += v;
      result.up += u * pixel;
      result.vp += v * pixel;
      result.p += pixel;
      return result;
    }, {uu:0, uv:0, vv:0, u:0, v:0, up:0, vp:0, p:0});

    return solveThreeByThree([
      [sums.uu, sums.uv, sums.u],
      [sums.uv, sums.vv, sums.v],
      [sums.u, sums.v, points.length]
    ], [sums.up, sums.vp, sums.p]);
  }

  function transformPoint(transform, value) {
    const point = normalizePoint(value, "point");
    if (!transform || typeof transform !== "object") {
      throw new TypeError("transform must be an object");
    }
    const a = finiteNumber(transform.a, "transform.a");
    const b = finiteNumber(transform.b, "transform.b");
    const c = finiteNumber(transform.c, "transform.c");
    const d = finiteNumber(transform.d, "transform.d");
    const e = finiteNumber(transform.e, "transform.e");
    const f = finiteNumber(transform.f, "transform.f");
    return {
      x:a * point.x + b * point.y + c,
      y:d * point.x + e * point.y + f
    };
  }

  function fitCalibration(value) {
    const calibration = normalizeCalibration(value);
    const mean = calibration.controlPoints.reduce((result, point) => ({
      x:result.x + point.mm.x / calibration.controlPoints.length,
      y:result.y + point.mm.y / calibration.controlPoints.length
    }), {x:0, y:0});
    const coordinateScale = Math.sqrt(
      calibration.controlPoints.reduce((sum, point) => (
        sum
        + (point.mm.x - mean.x) ** 2
        + (point.mm.y - mean.y) ** 2
      ), 0) / calibration.controlPoints.length
    );
    if (!Number.isFinite(coordinateScale) || coordinateScale <= PIVOT_EPSILON) {
      throw new Error("calibration control points must not be collinear");
    }

    const xAxis = fitNormalizedAxis(
      calibration.controlPoints,
      "x",
      mean,
      coordinateScale
    );
    const yAxis = fitNormalizedAxis(
      calibration.controlPoints,
      "y",
      mean,
      coordinateScale
    );
    const transform = {
      a:xAxis[0] / coordinateScale,
      b:xAxis[1] / coordinateScale,
      c:xAxis[2] - xAxis[0] * mean.x / coordinateScale
        - xAxis[1] * mean.y / coordinateScale,
      d:yAxis[0] / coordinateScale,
      e:yAxis[1] / coordinateScale,
      f:yAxis[2] - yAxis[0] * mean.x / coordinateScale
        - yAxis[1] * mean.y / coordinateScale
    };
    const residualsPx = calibration.controlPoints.map(point => {
      const mapped = transformPoint(transform, point.mm);
      return Math.hypot(
        mapped.x - point.pixel.x,
        mapped.y - point.pixel.y
      );
    });
    const maxResidualPx = Math.max(...residualsPx);
    const rmsResidualPx = Math.sqrt(
      residualsPx.reduce((sum, residual) => sum + residual ** 2, 0)
      / residualsPx.length
    );
    if (maxResidualPx > calibration.maxResidualPx) {
      throw new RangeError(
        `calibration residual ${maxResidualPx.toFixed(3)} px exceeds `
        + `${calibration.maxResidualPx.toFixed(3)} px`
      );
    }
    const determinant = transform.a * transform.e - transform.b * transform.d;
    if (Math.abs(determinant) <= PIVOT_EPSILON) {
      throw new Error("calibration transform is degenerate");
    }

    return {
      version:1,
      side:calibration.side,
      transform,
      determinant,
      mirrored:determinant < 0,
      controlPointCount:calibration.controlPoints.length,
      residualsPx,
      rmsResidualPx,
      maxResidualPx,
      residualLimitPx:calibration.maxResidualPx
    };
  }

  function transformBounds(transform, value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("bounds must be an object");
    }
    const minX = finiteNumber(value.minX, "bounds.minX");
    const minY = finiteNumber(value.minY, "bounds.minY");
    const maxX = finiteNumber(value.maxX, "bounds.maxX");
    const maxY = finiteNumber(value.maxY, "bounds.maxY");
    if (maxX < minX || maxY < minY) {
      throw new RangeError("bounds maximums must not be less than minimums");
    }
    const corners = [
      {x:minX, y:minY},
      {x:maxX, y:minY},
      {x:maxX, y:maxY},
      {x:minX, y:maxY}
    ].map(point => transformPoint(transform, point));
    const xs = corners.map(point => point.x);
    const ys = corners.map(point => point.y);
    return {
      minX:Math.min(...xs),
      minY:Math.min(...ys),
      maxX:Math.max(...xs),
      maxY:Math.max(...ys),
      corners
    };
  }

  return Object.freeze({
    DEFAULT_MAX_RESIDUAL_PX,
    normalizeCalibration,
    fitCalibration,
    transformPoint,
    transformBounds
  });
});
