(function initAutomaticMatching(root, factory) {
  const geometryApi = typeof module === "object" && module.exports
    ? require("./matching-geometry.js")
    : root?.SolderMapMatchingGeometry;
  const api = factory(geometryApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapAutomaticMatching = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createAutomaticMatchingApi(
  geometryApi
) {
  if (!geometryApi) throw new Error("SolderMapMatchingGeometry is required");

  const DEFAULT_OPTIONS = Object.freeze({
    radiusScale:1.5,
    defaultRadiusMm:5
  });

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

  function normalizeOptions(value = {}) {
    return {
      ...value,
      radiusScale:positiveNumber(
        value.radiusScale ?? DEFAULT_OPTIONS.radiusScale,
        "radiusScale"
      ),
      defaultRadiusMm:positiveNumber(
        value.defaultRadiusMm ?? DEFAULT_OPTIONS.defaultRadiusMm,
        "defaultRadiusMm"
      )
    };
  }

  function normalizeSide(value, name) {
    const side = String(value || "").trim().toUpperCase();
    if (side !== "TOP" && side !== "BOTTOM") {
      throw new TypeError(`${name} must be TOP or BOTTOM`);
    }
    return side;
  }

  function centerOf(value, name) {
    if (!value || typeof value !== "object") throw new TypeError(`${name} must be an object`);
    const source = value.center && typeof value.center === "object" ? value.center : value;
    return {
      x:finiteNumber(source.x, `${name}.x`),
      y:finiteNumber(source.y, `${name}.y`)
    };
  }

  function distanceBetween(first, second) {
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  function geometryDiagonal(geometry, rotationDegrees = 0) {
    if (!geometryApi.hasGeometry(geometry)) return null;
    const prepared = geometryApi.prepareGeometry(geometry, rotationDegrees);
    return Math.hypot(prepared.boundingBox.width, prepared.boundingBox.height);
  }

  function densityLimitFor(expectedIndex, expectedFootprints) {
    if (!Array.isArray(expectedFootprints)) {
      throw new TypeError("expectedFootprints must be an array");
    }
    const expected = expectedFootprints[expectedIndex];
    if (!expected) throw new RangeError("expectedIndex is outside expectedFootprints");
    const expectedSide = normalizeSide(expected.side, `expectedFootprints[${expectedIndex}].side`);
    const expectedCenter = centerOf(expected, `expectedFootprints[${expectedIndex}]`);
    let nearestNeighborDistance = Infinity;

    expectedFootprints.forEach((candidate, candidateIndex) => {
      if (candidateIndex === expectedIndex) return;
      const candidateSide = normalizeSide(
        candidate.side,
        `expectedFootprints[${candidateIndex}].side`
      );
      if (candidateSide !== expectedSide) return;
      const distance = distanceBetween(
        expectedCenter,
        centerOf(candidate, `expectedFootprints[${candidateIndex}]`)
      );
      nearestNeighborDistance = Math.min(nearestNeighborDistance, distance);
    });

    return Number.isFinite(nearestNeighborDistance)
      ? {
        nearestNeighborDistance,
        densityRadius:nearestNeighborDistance / 2
      }
      : {
        nearestNeighborDistance:null,
        densityRadius:null
      };
  }

  function baseRadiusFor(expected, found, options) {
    const normalizedOptions = normalizeOptions(options);
    const expectedDiagonal = geometryDiagonal(
      expected.geometry,
      expected.rotationDegrees ?? expected.rotation ?? 0
    );
    if (expectedDiagonal !== null) {
      return {
        source:"expected_geometry",
        geometryDiagonal:expectedDiagonal,
        baseRadius:normalizedOptions.radiusScale * expectedDiagonal
      };
    }

    const foundDiagonal = geometryDiagonal(found.geometry);
    if (foundDiagonal !== null) {
      return {
        source:"found_geometry",
        geometryDiagonal:foundDiagonal,
        baseRadius:normalizedOptions.radiusScale * foundDiagonal
      };
    }

    return {
      source:"default",
      geometryDiagonal:null,
      baseRadius:normalizedOptions.defaultRadiusMm
    };
  }

  function numericalEpsilon(...values) {
    const scale = Math.max(1, ...values.filter(Number.isFinite).map(Math.abs));
    return Number.EPSILON * scale * 16;
  }

  function evaluateCandidate(expected, found, density, value = {}) {
    const options = normalizeOptions(value);
    const expectedSide = normalizeSide(expected.side, "expected.side");
    const foundSide = normalizeSide(found.side, "found.side");
    const expectedCenter = centerOf(expected, "expected");
    const foundCenter = centerOf(found, "found");
    if (foundSide !== expectedSide) {
      return {
        found,
        foundCenter,
        classification:"unsuitable",
        reason:"side_mismatch",
        withinRadius:false
      };
    }

    const base = baseRadiusFor(expected, found, options);
    const finalRadius = density.densityRadius === null
      ? base.baseRadius
      : Math.min(base.baseRadius, density.densityRadius);
    const centerDistance = distanceBetween(expectedCenter, foundCenter);
    const withinRadius = centerDistance <= finalRadius
      + numericalEpsilon(centerDistance, finalRadius);
    const diagnostics = {
      found,
      foundCenter,
      centerDistance,
      radiusSource:base.source,
      geometryDiagonal:base.geometryDiagonal,
      baseRadius:base.baseRadius,
      densityRadius:density.densityRadius,
      finalRadius,
      withinRadius
    };

    if (!withinRadius) {
      return {
        ...diagnostics,
        classification:"unsuitable",
        reason:"outside_radius"
      };
    }

    const comparison = geometryApi.compareFootprintGeometry(
      expected.geometry,
      found.geometry,
      {
        ...options,
        expectedRotationDegrees:expected.rotationDegrees ?? expected.rotation ?? 0
      }
    );
    const {
      expected:expectedGeometry,
      found:foundGeometry,
      ...comparisonDiagnostics
    } = comparison;
    return {
      ...diagnostics,
      ...comparisonDiagnostics,
      expectedGeometry,
      foundGeometry
    };
  }

  function statusForCandidates(candidates) {
    const exact = candidates.filter(item => item.classification === "exact");
    if (exact.length === 1) {
      return {status:"matched_exact", selected:exact[0], uncertain:false};
    }
    if (exact.length > 1) {
      return {status:"ambiguous_exact", selected:null, uncertain:false};
    }

    const acceptable = candidates.filter(item => item.classification === "acceptable");
    if (acceptable.length === 1) {
      return {status:"matched_acceptable", selected:acceptable[0], uncertain:false};
    }
    if (acceptable.length > 1) {
      return {status:"ambiguous_acceptable", selected:null, uncertain:false};
    }

    const unknown = candidates.filter(item => item.classification === "unknown_geometry");
    if (unknown.length === 1) {
      return {
        status:"matched_uncertain_geometry",
        selected:unknown[0],
        uncertain:true
      };
    }
    if (unknown.length > 1) {
      return {status:"ambiguous_unknown_geometry", selected:null, uncertain:true};
    }
    return {status:"unmatched", selected:null, uncertain:false};
  }

  function matchExpectedFootprint(
    expectedIndex,
    expectedFootprints,
    foundFootprints,
    value = {}
  ) {
    if (!Array.isArray(foundFootprints)) {
      throw new TypeError("foundFootprints must be an array");
    }
    const options = normalizeOptions(value);
    const expected = expectedFootprints[expectedIndex];
    if (!expected) throw new RangeError("expectedIndex is outside expectedFootprints");
    const side = normalizeSide(expected.side, `expectedFootprints[${expectedIndex}].side`);
    const expectedCenter = centerOf(expected, `expectedFootprints[${expectedIndex}]`);
    const density = densityLimitFor(expectedIndex, expectedFootprints);
    const candidates = foundFootprints
      .filter(found => normalizeSide(found.side, "found.side") === side)
      .map(found => evaluateCandidate(expected, found, density, options));
    const selection = statusForCandidates(candidates);

    return {
      expected,
      expectedRef:expected.ref ?? null,
      side,
      expectedCenter,
      nearestNeighborDistance:density.nearestNeighborDistance,
      densityRadius:density.densityRadius,
      candidates,
      ...selection,
      selectedFound:selection.selected?.found ?? null
    };
  }

  function matchFootprints(expectedFootprints, foundFootprints, value = {}) {
    if (!Array.isArray(expectedFootprints)) {
      throw new TypeError("expectedFootprints must be an array");
    }
    return expectedFootprints.map((expected, index) => (
      matchExpectedFootprint(index, expectedFootprints, foundFootprints, value)
    ));
  }

  return Object.freeze({
    DEFAULT_OPTIONS,
    centerOf,
    distanceBetween,
    geometryDiagonal,
    densityLimitFor,
    baseRadiusFor,
    evaluateCandidate,
    statusForCandidates,
    matchExpectedFootprint,
    matchFootprints
  });
});
