# Matching calibration workflow

The renderer connects an opened matching-session document to the project's
pixel-based assembly map without changing either exchange format.

## Starting the workflow

The result viewer keeps the normalized document and completed matching session
in transient memory. The operator can open calibration only when the session
contains at least one matched result. Opening another project clears this
state.

The workflow offers only sides present in the session. TOP and BOTTOM are
calibrated independently.

## Control points

For each side, SolderMap proposes three well-separated expected-footprint
centres from the millimetre session. The operator can edit those millimetre
coordinates and selects the corresponding pixel positions directly on the
project image. Extra control points can be added or removed, while at least
three rows are always retained.

The accepted affine-calibration contract remains unchanged:

- at least three complete, non-collinear pairs;
- a positive maximum residual, defaulting to 2 px;
- explicit RMS and maximum residual diagnostics;
- reflected transforms are accepted and reported.

Editing any control point invalidates the affected calibration and preview
until the side is fitted again.

## Preview

After a side is fitted, the renderer builds the version 1 application plan
from the current project components, project image sizes, completed matching
session, and every currently accepted side calibration.

The visual preview shows:

- the source image for the selected side;
- current component rectangles as dashed outlines;
- proposed rectangles as green outlines;
- selected control points;
- one row per matching result with either the proposed pixel rectangle or the
  explicit skip reason.

The summary always states the number of updates and skipped results. Missing
calibration for the other side is represented as a skip rather than an
implicit coordinate conversion.

## Confirmation and saving

The apply button is disabled when the plan contains no updates. Application
requires a separate confirmation dialog. The plan is then validated against
the current component identities and geometry; an outdated preview is rejected.

Successful application:

1. creates one undo snapshot;
2. replaces only component geometry through the matching-application module;
3. preserves all non-geometry component data;
4. saves through the existing project persistence path.

The matching document, calibration points, fitted transforms, and plan remain
transient and are not stored in `project.json`.
