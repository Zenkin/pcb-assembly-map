# Matching application plan

Automatic matching results are not written directly to `project.json`.
SolderMap first builds a versioned application plan that can be shown to the
operator and applied only after explicit confirmation.

## Inputs

The plan builder receives:

- the current project component array;
- source-image sizes for TOP and BOTTOM;
- a completed matching session;
- fitted, side-specific version 1 affine calibrations.

Component references are compared case-insensitively within a side. A missing
or duplicate project component is not guessed.

## Eligible results

Only `matched_exact` and `matched_acceptable` results are eligible for an
automatic geometry update. The following results remain visible but are
skipped:

- `matched_uncertain_geometry`;
- every ambiguous status;
- `unmatched`.

An eligible result also requires:

- one existing project component with the same side and reference;
- one matching result targeting that project component;
- one selected found footprint that is not selected by another component;
- known found-footprint pad geometry;
- a fitted calibration for the same side;
- a known source-image size for that side.

This prevents two project components from being placed on the same detected
footprint and prevents two expected records from overwriting one project
component, even though matching itself evaluates expected footprints
independently.

## Rectangle construction

Pad geometry is relative to the found-footprint centre and is first converted
to one millimetre bounding rectangle. All four rectangle corners are
transformed to source-image pixels by the side calibration.

The stored project rectangle encloses the complete transformed footprint:

```text
x = floor(minPixelX)
y = floor(minPixelY)
right = ceil(maxPixelX)
bottom = ceil(maxPixelY)
w = max(1, right - x)
h = max(1, bottom - y)
```

The update is skipped if any part of the proposed rectangle lies outside the
source image. The rectangle is not silently clipped because that could hide an
incorrect calibration.

## Plan and application safety

Plan version 1 records, for every matching result:

- the result status and selected found-footprint ID;
- `update` or `skip`;
- an explicit skip reason;
- current and proposed project geometry;
- source millimetre bounds;
- calibration reflection and residual diagnostics.

Applying the plan returns a new component array and does not mutate the input.
All non-geometry component fields are preserved. An `unplaced` flag is removed
after a successful update.

Before applying each update, the component identity and geometry are compared
with the snapshot stored in the plan. A stale plan is rejected if the
component was renamed, moved, resized, or placed after the preview was built.
