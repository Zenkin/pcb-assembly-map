(function initMatchingGeometry(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapMatchingGeometry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchingGeometryApi() {
  const DEFAULT_OPTIONS = Object.freeze({
    absoluteToleranceMm:0.1,
    relativeTolerance:0.05,
    acceptableMultiplier:1.5,
    assignmentTieEpsilon:1e-9
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
      absoluteToleranceMm:positiveNumber(
        value.absoluteToleranceMm ?? DEFAULT_OPTIONS.absoluteToleranceMm,
        "absoluteToleranceMm"
      ),
      relativeTolerance:positiveNumber(
        value.relativeTolerance ?? DEFAULT_OPTIONS.relativeTolerance,
        "relativeTolerance"
      ),
      acceptableMultiplier:positiveNumber(
        value.acceptableMultiplier ?? DEFAULT_OPTIONS.acceptableMultiplier,
        "acceptableMultiplier"
      ),
      assignmentTieEpsilon:positiveNumber(
        value.assignmentTieEpsilon ?? DEFAULT_OPTIONS.assignmentTieEpsilon,
        "assignmentTieEpsilon"
      )
    };
  }

  function hasGeometry(value) {
    return Boolean(value && Array.isArray(value.pads) && value.pads.length);
  }

  function normalizePad(value, index) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`pads[${index}] must be an object`);
    }
    return {
      x:finiteNumber(value.x, `pads[${index}].x`),
      y:finiteNumber(value.y, `pads[${index}].y`),
      width:positiveNumber(value.width ?? value.w, `pads[${index}].width`),
      height:positiveNumber(value.height ?? value.h, `pads[${index}].height`)
    };
  }

  function boundingBox(pads) {
    if (!Array.isArray(pads) || !pads.length) {
      throw new TypeError("pads must be a non-empty array");
    }
    const bounds = pads.reduce((result, pad) => ({
      minX:Math.min(result.minX, pad.x - pad.width / 2),
      maxX:Math.max(result.maxX, pad.x + pad.width / 2),
      minY:Math.min(result.minY, pad.y - pad.height / 2),
      maxY:Math.max(result.maxY, pad.y + pad.height / 2)
    }), {
      minX:Infinity,
      maxX:-Infinity,
      minY:Infinity,
      maxY:-Infinity
    });
    return {
      ...bounds,
      width:bounds.maxX - bounds.minX,
      height:bounds.maxY - bounds.minY,
      centerX:(bounds.minX + bounds.maxX) / 2,
      centerY:(bounds.minY + bounds.maxY) / 2
    };
  }

  function prepareGeometry(geometry, rotationDegrees = 0) {
    if (!hasGeometry(geometry)) throw new TypeError("geometry must contain at least one pad");
    const angle = finiteNumber(rotationDegrees, "rotationDegrees") * Math.PI / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const absoluteCosine = Math.abs(cosine);
    const absoluteSine = Math.abs(sine);
    const sourcePads = geometry.pads.map(normalizePad);
    const sourceBounds = boundingBox(sourcePads);

    const rotatedPads = sourcePads.map((pad) => {
      const x = pad.x - sourceBounds.centerX;
      const y = pad.y - sourceBounds.centerY;
      return {
        x:x * cosine - y * sine,
        y:x * sine + y * cosine,
        width:pad.width * absoluteCosine + pad.height * absoluteSine,
        height:pad.width * absoluteSine + pad.height * absoluteCosine
      };
    });
    const rotatedBounds = boundingBox(rotatedPads);
    const pads = rotatedPads.map((pad) => ({
      ...pad,
      x:pad.x - rotatedBounds.centerX,
      y:pad.y - rotatedBounds.centerY
    }));

    return {
      pads,
      boundingBox:boundingBox(pads)
    };
  }

  function exactTolerance(expectedSize, options = DEFAULT_OPTIONS) {
    const size = positiveNumber(expectedSize, "expectedSize");
    return options.absoluteToleranceMm + options.relativeTolerance * size;
  }

  function numericalEpsilon(...values) {
    const scale = Math.max(1, ...values.filter(Number.isFinite).map(Math.abs));
    return Number.EPSILON * scale * 16;
  }

  function withinInclusive(value, limit) {
    return value <= limit + numericalEpsilon(value, limit);
  }

  function solveMinimumAssignment(costMatrix) {
    const size = costMatrix.length;
    if (!size || costMatrix.some((row) => !Array.isArray(row) || row.length !== size)) {
      throw new TypeError("costMatrix must be a non-empty square matrix");
    }

    const rowPotential = Array(size + 1).fill(0);
    const columnPotential = Array(size + 1).fill(0);
    const columnMatch = Array(size + 1).fill(0);
    const previousColumn = Array(size + 1).fill(0);

    for (let row = 1; row <= size; row += 1) {
      columnMatch[0] = row;
      let currentColumn = 0;
      const minimum = Array(size + 1).fill(Infinity);
      const used = Array(size + 1).fill(false);

      do {
        used[currentColumn] = true;
        const currentRow = columnMatch[currentColumn];
        let delta = Infinity;
        let nextColumn = 0;
        for (let column = 1; column <= size; column += 1) {
          if (used[column]) continue;
          const cost = costMatrix[currentRow - 1][column - 1];
          const reducedCost = cost - rowPotential[currentRow] - columnPotential[column];
          if (reducedCost < minimum[column]) {
            minimum[column] = reducedCost;
            previousColumn[column] = currentColumn;
          }
          if (minimum[column] < delta) {
            delta = minimum[column];
            nextColumn = column;
          }
        }
        if (!Number.isFinite(delta)) return null;
        for (let column = 0; column <= size; column += 1) {
          if (used[column]) {
            rowPotential[columnMatch[column]] += delta;
            columnPotential[column] -= delta;
          } else {
            minimum[column] -= delta;
          }
        }
        currentColumn = nextColumn;
      } while (columnMatch[currentColumn] !== 0);

      do {
        const nextColumn = previousColumn[currentColumn];
        columnMatch[currentColumn] = columnMatch[nextColumn];
        currentColumn = nextColumn;
      } while (currentColumn !== 0);
    }

    const assignment = Array(size);
    for (let column = 1; column <= size; column += 1) {
      assignment[columnMatch[column] - 1] = column - 1;
    }
    const totalCost = assignment.reduce(
      (sum, column, row) => sum + costMatrix[row][column],
      0
    );
    return {assignment, totalCost};
  }

  function findOptimalAssignment(costMatrix, tieEpsilon = DEFAULT_OPTIONS.assignmentTieEpsilon) {
    const best = solveMinimumAssignment(costMatrix);
    if (!best) return null;

    let alternativeCost = Infinity;
    for (let row = 0; row < best.assignment.length; row += 1) {
      const excludedColumn = best.assignment[row];
      const alternativeMatrix = costMatrix.map((costs, matrixRow) => (
        costs.map((cost, column) => (
          matrixRow === row && column === excludedColumn ? Infinity : cost
        ))
      ));
      const alternative = solveMinimumAssignment(alternativeMatrix);
      if (alternative) alternativeCost = Math.min(alternativeCost, alternative.totalCost);
    }

    return {
      ...best,
      alternativeCost:Number.isFinite(alternativeCost) ? alternativeCost : null,
      ambiguous:Number.isFinite(alternativeCost)
        && alternativeCost - best.totalCost <= tieEpsilon
          + numericalEpsilon(alternativeCost, best.totalCost)
    };
  }

  function pairMetrics(expectedPad, foundPad, expectedBounds, options) {
    const tolerances = {
      x:exactTolerance(expectedBounds.width, options),
      y:exactTolerance(expectedBounds.height, options),
      width:exactTolerance(expectedPad.width, options),
      height:exactTolerance(expectedPad.height, options)
    };
    const differences = {
      x:Math.abs(foundPad.x - expectedPad.x),
      y:Math.abs(foundPad.y - expectedPad.y),
      width:Math.abs(foundPad.width - expectedPad.width),
      height:Math.abs(foundPad.height - expectedPad.height)
    };
    const normalized = {
      x:differences.x / tolerances.x,
      y:differences.y / tolerances.y,
      width:differences.width / tolerances.width,
      height:differences.height / tolerances.height
    };
    const cost = normalized.x + normalized.y + normalized.width + normalized.height;
    return {differences, tolerances, normalized, cost};
  }

  function unsuitable(reason, diagnostics = {}) {
    return {
      classification:"unsuitable",
      reason,
      ...diagnostics
    };
  }

  function compareFootprintGeometry(expectedGeometry, foundGeometry, value = {}) {
    if (!hasGeometry(expectedGeometry) || !hasGeometry(foundGeometry)) {
      return {
        classification:"unknown_geometry",
        reason:"geometry_missing"
      };
    }

    const options = normalizeOptions(value);
    const expected = prepareGeometry(expectedGeometry, value.expectedRotationDegrees ?? 0);
    const found = prepareGeometry(foundGeometry, 0);
    const boundingBoxTolerances = {
      width:exactTolerance(expected.boundingBox.width, options),
      height:exactTolerance(expected.boundingBox.height, options)
    };
    const boundingBoxDifferences = {
      width:Math.abs(found.boundingBox.width - expected.boundingBox.width),
      height:Math.abs(found.boundingBox.height - expected.boundingBox.height)
    };
    const common = {
      expected,
      found,
      boundingBoxTolerances,
      boundingBoxDifferences
    };

    if (expected.pads.length !== found.pads.length) {
      return unsuitable("pad_count_mismatch", common);
    }
    if (
      !withinInclusive(boundingBoxDifferences.width, boundingBoxTolerances.width)
      || !withinInclusive(boundingBoxDifferences.height, boundingBoxTolerances.height)
    ) {
      return unsuitable("bounding_box_tolerance_exceeded", common);
    }

    const metrics = expected.pads.map((expectedPad) => (
      found.pads.map((foundPad) => pairMetrics(
        expectedPad,
        foundPad,
        expected.boundingBox,
        options
      ))
    ));
    const assignmentResult = findOptimalAssignment(
      metrics.map((row) => row.map((pair) => pair.cost)),
      options.assignmentTieEpsilon
    );
    if (!assignmentResult) {
      return unsuitable("assignment_unavailable", common);
    }

    const assignment = assignmentResult.assignment.map((foundPadIndex, expectedPadIndex) => ({
      expectedPadIndex,
      foundPadIndex,
      ...metrics[expectedPadIndex][foundPadIndex]
    }));
    const maxNormalizedDeviation = Math.max(
      ...assignment.flatMap((pair) => Object.values(pair.normalized))
    );
    const assignmentDiagnostics = {
      ...common,
      assignment,
      totalCost:assignmentResult.totalCost,
      alternativeCost:assignmentResult.alternativeCost,
      maxNormalizedDeviation
    };

    if (assignmentResult.ambiguous) {
      return unsuitable("ambiguous_pad_assignment", assignmentDiagnostics);
    }
    if (withinInclusive(maxNormalizedDeviation, 1)) {
      return {
        classification:"exact",
        reason:null,
        ...assignmentDiagnostics
      };
    }
    if (withinInclusive(maxNormalizedDeviation, options.acceptableMultiplier)) {
      return {
        classification:"acceptable",
        reason:null,
        ...assignmentDiagnostics
      };
    }
    return unsuitable("pad_tolerance_exceeded", assignmentDiagnostics);
  }

  return Object.freeze({
    DEFAULT_OPTIONS,
    hasGeometry,
    boundingBox,
    prepareGeometry,
    exactTolerance,
    solveMinimumAssignment,
    findOptimalAssignment,
    compareFootprintGeometry
  });
});
