const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const matchingFormat = require("../js/matching-format.js");
const workflow = require("../js/matching-workflow.js");

const FIXTURES = path.join(__dirname, "fixtures");

async function readFixture(name) {
  return fs.readFile(path.join(FIXTURES, name), "utf8");
}

function componentByRef(project, side, ref) {
  return project.components.find(component => (
    component.side === side && component.ref === ref
  ));
}

test("runs a realistic TOP/BOTTOM matching session through project save and reopen", async t => {
  const [sessionText, projectText] = await Promise.all([
    readFixture("realistic-matching-session.json"),
    readFixture("realistic-project.json")
  ]);
  const originalProject = JSON.parse(projectText);
  const {document, session} = matchingFormat.runDocument(sessionText);

  assert.deepEqual(session.summary, {
    total:7,
    matched:5,
    ambiguous:1,
    unmatched:1,
    byStatus:{
      matched_exact:2,
      matched_acceptable:2,
      matched_uncertain_geometry:1,
      ambiguous_exact:1,
      ambiguous_acceptable:0,
      ambiguous_unknown_geometry:0,
      unmatched:1
    }
  });

  const calibrations = Object.fromEntries(["TOP", "BOTTOM"].map(side => {
    const rows = workflow.createCalibrationRows(
      document.expectedFootprints,
      side,
      originalProject.components
    );
    assert.equal(rows.length, 3);
    assert.ok(rows.every(row => row.pixelSource === "project"));
    const calibration = workflow.fitSideCalibration({
      side,
      rows,
      maxResidualPx:0.01
    });
    assert.ok(calibration.maxResidualPx < 1e-9);
    return [side, calibration];
  }));

  assert.equal(calibrations.TOP.mirrored, false);
  assert.equal(calibrations.BOTTOM.mirrored, true);

  const plan = workflow.createApplicationPlan({
    components:originalProject.components,
    imageSizes:originalProject.imageSizes,
    session,
    calibrations
  });
  assert.deepEqual(plan.summary, {
    total:7,
    updates:4,
    skipped:3,
    byReason:{status_not_applicable:3}
  });
  assert.equal(workflow.planForSide(plan, "TOP").updates.length, 2);
  assert.equal(workflow.planForSide(plan, "BOTTOM").updates.length, 2);

  const updatedProject = {
    ...structuredClone(originalProject),
    components:workflow.applyApplicationPlan(originalProject.components, plan)
  };
  const temporaryFolder = await fs.mkdtemp(path.join(os.tmpdir(), "soldermap-e2e-"));
  t.after(() => fs.rm(temporaryFolder, {recursive:true, force:true}));
  const projectPath = path.join(temporaryFolder, "project.json");
  await fs.writeFile(projectPath, JSON.stringify(updatedProject, null, 2), "utf8");
  const reopenedProject = JSON.parse(await fs.readFile(projectPath, "utf8"));

  assert.deepEqual(reopenedProject, updatedProject);
  assert.equal(reopenedProject.version, 4);
  assert.deepEqual(reopenedProject.doneMap, originalProject.doneMap);
  assert.deepEqual(reopenedProject.verificationMap, originalProject.verificationMap);
  assert.deepEqual(reopenedProject.bomMetadata, originalProject.bomMetadata);
  assert.equal(Object.hasOwn(reopenedProject, "matchingSession"), false);
  assert.equal(Object.hasOwn(reopenedProject, "matchingCalibration"), false);

  assert.deepEqual(
    ["TOP:R1", "TOP:C1", "BOTTOM:U2", "BOTTOM:C2"].map(key => {
      const [side, ref] = key.split(":");
      const component = componentByRef(reopenedProject, side, ref);
      return [key, component.x, component.y, component.w, component.h];
    }),
    [
      ["TOP:R1", 169, 134, 25, 13],
      ["TOP:C1", 328, 134, 26, 12],
      ["BOTTOM:U2", 807, 275, 25, 13],
      ["BOTTOM:C2", 645, 274, 27, 13]
    ]
  );

  ["TOP:R2", "TOP:U1", "BOTTOM:D1"].forEach(key => {
    const [side, ref] = key.split(":");
    assert.deepEqual(
      componentByRef(reopenedProject, side, ref),
      componentByRef(originalProject, side, ref)
    );
  });
});
