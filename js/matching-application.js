(function initMatchingApplication(root, factory) {
  const calibrationApi = typeof module === "object" && module.exports
    ? require("./matching-calibration.js")
    : root?.SolderMapMatchingCalibration;
  const api = factory(calibrationApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapMatchingApplication = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchingApplicationApi(
  calibrationApi
) {
  if (!calibrationApi) throw new Error("SolderMapMatchingCalibration is required");

  const PLAN_VERSION = 1;
  const APPLICABLE_STATUSES = Object.freeze([
    "matched_exact",
    "matched_acceptable"
  ]);

  function requiredObject(value, name) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`${name} must be an object`);
    }
    return value;
  }

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

  function normalizeSide(value, name) {
    const side = String(value ?? "").trim().toUpperCase();
    if (side !== "TOP" && side !== "BOTTOM") {
      throw new TypeError(`${name} must be TOP or BOTTOM`);
    }
    return side;
  }

  function normalizeRef(value, name) {
    const ref = String(value ?? "").trim();
    if (!ref) throw new TypeError(`${name} must be a non-empty string`);
    return ref;
  }

  function componentKey(side, ref) {
    return `${normalizeSide(side, "side")}:${normalizeRef(ref, "ref").toUpperCase()}`;
  }

  function cloneData(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalizeImageSizes(value) {
    const source = requiredObject(value, "imageSizes");
    return Object.fromEntries(["TOP", "BOTTOM"].flatMap(side => {
      if (source[side] === undefined || source[side] === null) return [];
      const size = requiredObject(source[side], `imageSizes.${side}`);
      return [[side, {
        w:positiveNumber(size.w ?? size.width, `imageSizes.${side}.w`),
        h:positiveNumber(size.h ?? size.height, `imageSizes.${side}.h`)
      }]];
    }));
  }

  function normalizeCalibrations(value) {
    const source = requiredObject(value, "calibrations");
    const normalized = {};
    Object.entries(source).forEach(([key, calibration]) => {
      if (calibration === undefined || calibration === null) return;
      const side = normalizeSide(key, `calibrations.${key}`);
      const item = requiredObject(calibration, `calibrations.${side}`);
      const itemSide = normalizeSide(item.side, `calibrations.${side}.side`);
      if (itemSide !== side) {
        throw new Error(`calibrations.${side}.side must match its key`);
      }
      if (Number(item.version) !== 1) {
        throw new Error(`calibrations.${side}.version must be 1`);
      }
      requiredObject(item.transform, `calibrations.${side}.transform`);
      calibrationApi.transformPoint(item.transform, {x:0, y:0});
      normalized[side] = cloneData(item);
    });
    return normalized;
  }

  function geometryBoundsAtCenter(footprint, name = "footprint") {
    const item = requiredObject(footprint, name);
    const center = requiredObject(item.center, `${name}.center`);
    const centerX = finiteNumber(center.x, `${name}.center.x`);
    const centerY = finiteNumber(center.y, `${name}.center.y`);
    const geometry = requiredObject(item.geometry, `${name}.geometry`);
    if (!Array.isArray(geometry.pads) || geometry.pads.length === 0) {
      throw new TypeError(`${name}.geometry.pads must be a non-empty array`);
    }
    return geometry.pads.reduce((bounds, value, index) => {
      const pad = requiredObject(value, `${name}.geometry.pads[${index}]`);
      const x = centerX + finiteNumber(pad.x, `${name}.geometry.pads[${index}].x`);
      const y = centerY + finiteNumber(pad.y, `${name}.geometry.pads[${index}].y`);
      const width = positiveNumber(
        pad.width ?? pad.w,
        `${name}.geometry.pads[${index}].width`
      );
      const height = positiveNumber(
        pad.height ?? pad.h,
        `${name}.geometry.pads[${index}].height`
      );
      return {
        minX:Math.min(bounds.minX, x - width / 2),
        minY:Math.min(bounds.minY, y - height / 2),
        maxX:Math.max(bounds.maxX, x + width / 2),
        maxY:Math.max(bounds.maxY, y + height / 2)
      };
    }, {minX:Infinity, minY:Infinity, maxX:-Infinity, maxY:-Infinity});
  }

  function enclosingPixelBox(transform, millimeterBounds) {
    const mapped = calibrationApi.transformBounds(transform, millimeterBounds);
    const snapInteger = value => {
      const nearest = Math.round(value);
      const tolerance = Number.EPSILON * Math.max(1, Math.abs(value)) * 32;
      return Math.abs(value - nearest) <= tolerance ? nearest : value;
    };
    const x = Math.floor(snapInteger(mapped.minX));
    const y = Math.floor(snapInteger(mapped.minY));
    const maxX = Math.ceil(snapInteger(mapped.maxX));
    const maxY = Math.ceil(snapInteger(mapped.maxY));
    return {
      x,
      y,
      w:Math.max(1, maxX - x),
      h:Math.max(1, maxY - y)
    };
  }

  function componentGeometry(component) {
    return {
      x:finiteNumber(component.x ?? 0, "component.x"),
      y:finiteNumber(component.y ?? 0, "component.y"),
      w:positiveNumber(component.w ?? 1, "component.w"),
      h:positiveNumber(component.h ?? 1, "component.h"),
      unplaced:component.unplaced === true
    };
  }

  function insideImage(box, size) {
    return box.x >= 0
      && box.y >= 0
      && box.x + box.w <= size.w
      && box.y + box.h <= size.h;
  }

  function skipped(result, reason, details = {}) {
    return {
      expectedId:String(result.expectedId || result.expected?.id || ""),
      ref:String(result.expectedRef || result.expected?.ref || ""),
      side:String(result.side || result.expected?.side || ""),
      status:String(result.status || ""),
      action:"skip",
      reason,
      ...details
    };
  }

  function buildIndexes(components, foundFootprints) {
    const componentsByKey = new Map();
    components.forEach((component, index) => {
      const item = requiredObject(component, `components[${index}]`);
      const key = componentKey(item.side, item.ref);
      if (!componentsByKey.has(key)) componentsByKey.set(key, []);
      componentsByKey.get(key).push({component:item, index});
    });
    const foundById = new Map();
    foundFootprints.forEach((footprint, index) => {
      const item = requiredObject(footprint, `session.input.foundFootprints[${index}]`);
      const id = String(item.id ?? "").trim();
      if (!id) throw new TypeError(`session.input.foundFootprints[${index}].id must be non-empty`);
      if (foundById.has(id)) throw new Error(`found footprint id must be unique: ${id}`);
      foundById.set(id, item);
    });
    return {componentsByKey, foundById};
  }

  function selectedUsage(results) {
    const usage = new Map();
    results.forEach(result => {
      if (!APPLICABLE_STATUSES.includes(result?.status)) return;
      const id = String(result.selectedFoundId ?? "").trim();
      if (!id) return;
      usage.set(id, (usage.get(id) || 0) + 1);
    });
    return usage;
  }

  function componentUsage(results) {
    const usage = new Map();
    results.forEach(result => {
      if (!APPLICABLE_STATUSES.includes(result?.status)) return;
      const side = normalizeSide(result.side || result.expected?.side, "result.side");
      const ref = result.expectedRef || result.expected?.ref;
      const key = componentKey(side, ref);
      usage.set(key, (usage.get(key) || 0) + 1);
    });
    return usage;
  }

  function createApplicationPlan(value) {
    const input = requiredObject(value, "application input");
    if (!Array.isArray(input.components)) throw new TypeError("components must be an array");
    const session = requiredObject(input.session, "session");
    const sessionInput = requiredObject(session.input, "session.input");
    if (!Array.isArray(session.results)) throw new TypeError("session.results must be an array");
    if (!Array.isArray(sessionInput.foundFootprints)) {
      throw new TypeError("session.input.foundFootprints must be an array");
    }
    const imageSizes = normalizeImageSizes(input.imageSizes);
    const calibrations = normalizeCalibrations(input.calibrations);
    const {componentsByKey, foundById} = buildIndexes(
      input.components,
      sessionInput.foundFootprints
    );
    const usage = selectedUsage(session.results);
    const targetUsage = componentUsage(session.results);

    const entries = session.results.map((result, resultIndex) => {
      const item = requiredObject(result, `session.results[${resultIndex}]`);
      if (!APPLICABLE_STATUSES.includes(item.status)) {
        return skipped(item, "status_not_applicable");
      }
      const ref = String(item.expectedRef || item.expected?.ref || "").trim();
      const side = normalizeSide(
        item.side || item.expected?.side,
        `session.results[${resultIndex}].side`
      );
      const key = componentKey(side, ref);
      if ((targetUsage.get(key) || 0) > 1) {
        return skipped(item, "project_component_reused", {ref, side});
      }
      const matches = componentsByKey.get(key) || [];
      if (matches.length === 0) return skipped(item, "project_component_missing", {ref, side});
      if (matches.length > 1) return skipped(item, "project_component_duplicate", {ref, side});

      const selectedFoundId = String(item.selectedFoundId ?? "").trim();
      if (!selectedFoundId) return skipped(item, "selected_footprint_missing", {ref, side});
      if ((usage.get(selectedFoundId) || 0) > 1) {
        return skipped(item, "selected_footprint_reused", {ref, side, selectedFoundId});
      }
      const found = foundById.get(selectedFoundId);
      if (!found) return skipped(item, "selected_footprint_missing", {ref, side, selectedFoundId});
      if (normalizeSide(found.side, `foundFootprints.${selectedFoundId}.side`) !== side) {
        return skipped(item, "selected_footprint_side_mismatch", {ref, side, selectedFoundId});
      }
      if (!found.geometry || !Array.isArray(found.geometry.pads) || !found.geometry.pads.length) {
        return skipped(item, "selected_geometry_missing", {ref, side, selectedFoundId});
      }
      const calibration = calibrations[side];
      if (!calibration) {
        return skipped(item, "calibration_missing", {ref, side, selectedFoundId});
      }
      const imageSize = imageSizes[side];
      if (!imageSize) return skipped(item, "image_size_missing", {ref, side, selectedFoundId});

      const millimeterBounds = geometryBoundsAtCenter(
        found,
        `foundFootprints.${selectedFoundId}`
      );
      const after = enclosingPixelBox(calibration.transform, millimeterBounds);
      if (!insideImage(after, imageSize)) {
        return skipped(item, "outside_image", {
          ref,
          side,
          selectedFoundId,
          proposedGeometry:after
        });
      }
      const match = matches[0];
      return {
        expectedId:String(item.expectedId || item.expected?.id || ""),
        ref,
        side,
        status:String(item.status),
        action:"update",
        reason:null,
        componentIndex:match.index,
        selectedFoundId,
        before:componentGeometry(match.component),
        after,
        millimeterBounds,
        calibration:{
          version:calibration.version,
          mirrored:calibration.mirrored === true,
          rmsResidualPx:finiteNumber(calibration.rmsResidualPx, "calibration.rmsResidualPx"),
          maxResidualPx:finiteNumber(calibration.maxResidualPx, "calibration.maxResidualPx")
        }
      };
    });

    const summary = entries.reduce((result, entry) => {
      result.total += 1;
      if (entry.action === "update") result.updates += 1;
      else {
        result.skipped += 1;
        result.byReason[entry.reason] = (result.byReason[entry.reason] || 0) + 1;
      }
      return result;
    }, {total:0, updates:0, skipped:0, byReason:{}});

    return {
      version:PLAN_VERSION,
      entries,
      summary
    };
  }

  function sameGeometry(component, expected) {
    const actual = componentGeometry(component);
    return actual.x === expected.x
      && actual.y === expected.y
      && actual.w === expected.w
      && actual.h === expected.h
      && actual.unplaced === expected.unplaced;
  }

  function applyApplicationPlan(components, plan) {
    if (!Array.isArray(components)) throw new TypeError("components must be an array");
    const normalizedPlan = requiredObject(plan, "plan");
    if (Number(normalizedPlan.version) !== PLAN_VERSION) {
      throw new Error(`unsupported application plan version: ${String(normalizedPlan.version)}`);
    }
    if (!Array.isArray(normalizedPlan.entries)) throw new TypeError("plan.entries must be an array");
    const nextComponents = cloneData(components);
    normalizedPlan.entries
      .filter(entry => entry?.action === "update")
      .forEach((entry, index) => {
        const component = nextComponents[entry.componentIndex];
        if (!component) throw new Error(`application plan entry ${index} component is missing`);
        if (componentKey(component.side, component.ref) !== componentKey(entry.side, entry.ref)) {
          throw new Error(`application plan entry ${index} component identity changed`);
        }
        if (!sameGeometry(component, entry.before)) {
          throw new Error(`application plan entry ${index} component geometry changed`);
        }
        component.x = entry.after.x;
        component.y = entry.after.y;
        component.w = entry.after.w;
        component.h = entry.after.h;
        delete component.unplaced;
      });
    return nextComponents;
  }

  return Object.freeze({
    PLAN_VERSION,
    APPLICABLE_STATUSES,
    componentKey,
    geometryBoundsAtCenter,
    enclosingPixelBox,
    createApplicationPlan,
    applyApplicationPlan
  });
});
