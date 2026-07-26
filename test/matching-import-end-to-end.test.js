const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const pickAndPlace = require("../js/pick-and-place.js");
const recognition = require("../js/recognition-import.js");
const matchingFormat = require("../js/matching-format.js");
const resolution = require("../js/matching-resolution.js");
const workflow = require("../js/matching-workflow.js");

test("imports real sources, confirms uncertain matches, calibrates, and applies them", async () => {
  const project = JSON.parse(await fs.readFile(
    path.join(__dirname, "fixtures", "realistic-project.json"),
    "utf8"
  ));
  const placement = pickAndPlace.parsePickAndPlace([
    "Ref,PosX,PosY,Rot,Side",
    "R1,10,10,0,TOP",
    "C1,30,10,0,TOP",
    "R2,50,30,0,TOP",
    "U1,70,20,0,TOP",
    "U2,10,30,0,BOTTOM",
    "C2,30,30,0,BOTTOM",
    "D1,50,50,0,BOTTOM"
  ].join("\n"));
  const detected = recognition.parseRecognition(JSON.stringify({
    units:"mm",
    detections:[
      {id:"det-r1", side:"TOP", center:{x:10.2, y:10.1}, width:3, height:2},
      {id:"det-c1", side:"TOP", center:{x:30.1, y:10}, width:3, height:2},
      {id:"det-u2", side:"BOTTOM", center:{x:10.1, y:30.2}, width:3, height:2},
      {id:"det-c2", side:"BOTTOM", center:{x:30.2, y:30.1}, width:3, height:2}
    ]
  }));
  const run = matchingFormat.runDocument({
    format:"soldermap-matching-session",
    version:1,
    units:"mm",
    expectedFootprints:placement.expectedFootprints,
    foundFootprints:detected.foundFootprints
  });

  assert.deepEqual(run.session.summary, {
    total:7,
    matched:4,
    ambiguous:0,
    unmatched:3,
    byStatus:{
      matched_exact:0,
      matched_acceptable:0,
      matched_uncertain_geometry:4,
      ambiguous_exact:0,
      ambiguous_acceptable:0,
      ambiguous_unknown_geometry:0,
      unmatched:3
    }
  });

  let session = run.session;
  session.results.forEach((result, index) => {
    const candidates = resolution.selectableCandidates(result);
    if (candidates.length === 1) {
      session = resolution.resolveResult(session, index, candidates[0].id);
    }
  });
  assert.equal(resolution.countApplicable(session.results), 4);

  const calibrations = Object.fromEntries(["TOP", "BOTTOM"].map(side => [
    side,
    workflow.fitSideCalibration({
      side,
      rows:workflow.createCalibrationRows(
        run.document.expectedFootprints,
        side,
        project.components
      ),
      maxResidualPx:0.01
    })
  ]));
  const plan = workflow.createApplicationPlan({
    components:project.components,
    imageSizes:project.imageSizes,
    session,
    calibrations
  });
  const updated = workflow.applyApplicationPlan(project.components, plan);

  assert.deepEqual(plan.summary, {
    total:7,
    updates:4,
    skipped:3,
    byReason:{status_not_applicable:3}
  });
  assert.equal(updated.filter((component, index) => (
    component.x !== project.components[index].x
    || component.y !== project.components[index].y
    || component.w !== project.components[index].w
    || component.h !== project.components[index].h
  )).length, 4);
});
