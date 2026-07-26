(function initMatchingWorkflow(root, factory) {
  const calibrationApi = typeof module === "object" && module.exports
    ? require("./matching-calibration.js")
    : root?.SolderMapMatchingCalibration;
  const applicationApi = typeof module === "object" && module.exports
    ? require("./matching-application.js")
    : root?.SolderMapMatchingApplication;
  const api = factory(calibrationApi, applicationApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapMatchingWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchingWorkflowApi(
  calibrationApi,
  applicationApi
) {
  if (!calibrationApi) throw new Error("SolderMapMatchingCalibration is required");
  if (!applicationApi) throw new Error("SolderMapMatchingApplication is required");

  const SKIP_REASON_LABELS = Object.freeze({
    status_not_applicable:"Статус не допускает автоматическое применение",
    project_component_reused:"На компонент указывают несколько результатов",
    project_component_missing:"Компонент отсутствует в проекте",
    project_component_duplicate:"Обозначение компонента дублируется",
    selected_footprint_missing:"Найденное место отсутствует",
    selected_footprint_reused:"Найденное место используется повторно",
    selected_footprint_side_mismatch:"Сторона найденного места не совпадает",
    selected_geometry_missing:"У найденного места нет геометрии",
    calibration_missing:"Для стороны не выполнена калибровка",
    image_size_missing:"Размер изображения стороны неизвестен",
    outside_image:"Предлагаемая область выходит за изображение"
  });

  function pointOf(value) {
    const center = value?.center || value;
    const x = Number(center?.x);
    const y = Number(center?.y);
    return Number.isFinite(x) && Number.isFinite(y) ? {x, y} : null;
  }

  function normalizeSide(value) {
    const side = String(value ?? "").trim().toUpperCase();
    if (side !== "TOP" && side !== "BOTTOM") {
      throw new TypeError("side must be TOP or BOTTOM");
    }
    return side;
  }

  function uniqueExpectedPoints(expectedFootprints, side) {
    if (!Array.isArray(expectedFootprints)) {
      throw new TypeError("expectedFootprints must be an array");
    }
    const normalizedSide = normalizeSide(side);
    const seen = new Set();
    return expectedFootprints.flatMap((item, index) => {
      if (String(item?.side || "").toUpperCase() !== normalizedSide) return [];
      const point = pointOf(item);
      if (!point) return [];
      const key = `${point.x}:${point.y}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        id:String(item.id || `${normalizedSide}:${index + 1}`),
        ref:String(item.ref || item.id || `Точка ${index + 1}`),
        mm:point
      }];
    });
  }

  function squaredDistance(a, b) {
    return (a.mm.x - b.mm.x) ** 2 + (a.mm.y - b.mm.y) ** 2;
  }

  function doubledTriangleArea(a, b, c) {
    return Math.abs(
      (b.mm.x - a.mm.x) * (c.mm.y - a.mm.y)
      - (b.mm.y - a.mm.y) * (c.mm.x - a.mm.x)
    );
  }

  function selectCalibrationAnchors(expectedFootprints, side) {
    const points = uniqueExpectedPoints(expectedFootprints, side);
    if (points.length <= 3) return points;
    const first = points.reduce((best, point) => (
      point.mm.x + point.mm.y < best.mm.x + best.mm.y ? point : best
    ), points[0]);
    const second = points.reduce((best, point) => (
      squaredDistance(first, point) > squaredDistance(first, best) ? point : best
    ), points[0]);
    const remaining = points.filter(point => point !== first && point !== second);
    const third = remaining.reduce((best, point) => (
      doubledTriangleArea(first, second, point)
        > doubledTriangleArea(first, second, best) ? point : best
    ), remaining[0]);
    return [first, second, third];
  }

  function createCalibrationRows(expectedFootprints, side) {
    const anchors = selectCalibrationAnchors(expectedFootprints, side);
    const rows = anchors.map(anchor => ({
      id:anchor.id,
      label:anchor.ref,
      mm:{...anchor.mm},
      pixel:{x:null, y:null}
    }));
    while (rows.length < 3) {
      rows.push({
        id:`manual:${normalizeSide(side)}:${rows.length + 1}`,
        label:`Точка ${rows.length + 1}`,
        mm:{x:null, y:null},
        pixel:{x:null, y:null}
      });
    }
    return rows;
  }

  function finiteCoordinate(value, name) {
    if (value === "" || value === null || value === undefined) {
      throw new TypeError(`${name} is required`);
    }
    const number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError(`${name} must be a finite number`);
    return number;
  }

  function normalizeCalibrationRows(rows) {
    if (!Array.isArray(rows) || rows.length < 3) {
      throw new RangeError("At least three calibration rows are required.");
    }
    return rows.map((row, index) => ({
      mm:{
        x:finiteCoordinate(row?.mm?.x, `rows[${index}].mm.x`),
        y:finiteCoordinate(row?.mm?.y, `rows[${index}].mm.y`)
      },
      pixel:{
        x:finiteCoordinate(row?.pixel?.x, `rows[${index}].pixel.x`),
        y:finiteCoordinate(row?.pixel?.y, `rows[${index}].pixel.y`)
      }
    }));
  }

  function fitSideCalibration({side, rows, maxResidualPx}) {
    return calibrationApi.fitCalibration({
      side:normalizeSide(side),
      maxResidualPx,
      controlPoints:normalizeCalibrationRows(rows)
    });
  }

  function createApplicationPlan({components, imageSizes, session, calibrations}) {
    return applicationApi.createApplicationPlan({
      components,
      imageSizes,
      session,
      calibrations
    });
  }

  function applyApplicationPlan(components, plan) {
    return applicationApi.applyApplicationPlan(components, plan);
  }

  function planForSide(plan, side) {
    const normalizedSide = normalizeSide(side);
    const entries = Array.isArray(plan?.entries)
      ? plan.entries.filter(entry => entry.side === normalizedSide)
      : [];
    const updates = entries.filter(entry => entry.action === "update");
    const skipped = entries.filter(entry => entry.action !== "update");
    return {
      side:normalizedSide,
      entries,
      updates,
      skipped,
      skipReasons:skipped.reduce((result, entry) => {
        const reason = entry.reason || "unknown";
        result[reason] = (result[reason] || 0) + 1;
        return result;
      }, {})
    };
  }

  function skipReasonLabel(reason) {
    return SKIP_REASON_LABELS[reason] || `Неизвестная причина: ${String(reason || "—")}`;
  }

  return Object.freeze({
    SKIP_REASON_LABELS,
    selectCalibrationAnchors,
    createCalibrationRows,
    normalizeCalibrationRows,
    fitSideCalibration,
    createApplicationPlan,
    applyApplicationPlan,
    planForSide,
    skipReasonLabel
  });
});
