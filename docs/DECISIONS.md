# SolderMap decisions

This file records accepted cross-cutting decisions. It describes the current
state, not the full backlog.

## D-001 — GitHub workflow

**Status:** accepted

- `main` is the stable branch.
- Normal changes use a dedicated semantic branch and pull request.
- One pull request solves one logical task.
- Squash merge is preferred.
- Tool and agent names are not included in PR titles.
- Temporary branches are deleted after merge.

Detailed rules are stored in `.github/CODEX_WORKFLOW.md` and summarized in
`AGENTS.md`.

## D-002 — Electron process boundary

**Status:** accepted

The application uses:

```text
HTML/CSS/renderer JavaScript
-> context-isolated preload API
-> allowlisted Electron IPC
-> main-process filesystem operations
```

The renderer does not receive Node.js integration or raw `ipcRenderer`
access. Filesystem access remains in `main.js`.

## D-003 — Project storage

**Status:** current implementation

- The default root is `SolderMap Projects` in the user's Documents directory.
- Each project is a folder containing `project.json` and its PCB images.
- Changes are saved automatically.
- Backward compatibility with existing `project.json` files is required.
- A breaking data-format change requires an explicit migration decision.

Project format version 4 extends version 3 with optional
`verificationBackups` and `bomMetadata` fields. Existing version 2 and 3
projects are upgraded in memory when opened; missing verification data,
backups, and BOM metadata are interpreted as empty. The extension does not
remove or reinterpret existing fields.

## D-004 — Distribution artifacts

**Status:** accepted

- Source code and `package-lock.json` are tracked in Git.
- `node_modules/` and `dist/` are not tracked.
- Installers, portable executables, disk images, AppImages, ZIP files, and
  tarballs are published as GitHub Release assets.
- Release versions follow the application version in `package.json`.
- Platform-specific artifacts should be built and smoke-tested on the
  corresponding operating system when practical.

## D-005 — Destructive filesystem operations

**Status:** accepted

Project deletion and future destructive filesystem operations must resolve and
validate their targets against the expected project root before execution.
Renderer-provided paths are not trusted implicitly.

## D-006 — Verification report export

**Status:** accepted

- The renderer builds one canonical report row per project component from the
  complete project state, independently of active interface filters.
- The report schema is fixed to the eleven fields approved in the component
  verification specification.
- File selection and writes remain in the Electron main process behind one
  allowlisted preload method.
- CSV uses UTF-8 with a byte-order mark and semicolon delimiters.
- XLSX is generated as a minimal Office Open XML package by the local report
  module, with a frozen header row and an auto-filter, without requiring
  Microsoft Office or a runtime export dependency.
- PDF is rendered by an isolated hidden Electron window and `printToPDF`, with
  a repeated table header and numbered pages.
- The main process allowlists formats and report fields and limits row, cell,
  and total payload size before writing a file.

## D-007 — BOM update and verification backups

**Status:** accepted

- BOM input is a local UTF-8 CSV, TSV, or delimited text file selected through
  an allowlisted preload method; the renderer receives only its name and text.
- Components are matched primarily by case-insensitive reference designator.
- Equivalent resistor and capacitor values are compared after unit
  normalization.
- A changed type or nominal resets only the affected verification records;
  unchanged records and soldering status remain independent.
- Removed references and simultaneous type/nominal changes require explicit
  confirmation. Duplicate incoming references block the update until the
  source BOM is corrected.
- New BOM references are stored as unplaced components and acquire board
  geometry when the operator selects them and draws their area.
- Before an applied BOM update or restoration, the renderer stores a
  verification snapshot in `project.json`; only the ten newest snapshots are
  retained.
- Restoration can replace the complete verification map or only explicitly
  selected reference designators.

## D-008 — Matching coordinate calibration

**Status:** accepted

- Matching-session coordinates remain in millimetres; existing project
  component areas remain in source-image pixels.
- Results cannot be applied to a project without an explicit, side-specific
  millimetre-to-pixel calibration.
- Version 1 calibration uses at least three non-collinear control points and
  fits an affine transform by least squares.
- Calibration reports point residuals and rejects results above the configured
  maximum pixel error.
- Reflected transforms are valid and reported explicitly for BOTTOM-side
  workflows.
- Perspective correction and applying results to `project.json` are separate
  future tasks.

## D-009 — Applying automatic matching results

**Status:** accepted

- Matching results are converted into a versioned application plan before any
  project component is changed.
- Only unambiguous exact and acceptable matches with known detected geometry
  are eligible for automatic application.
- An uncertain or ambiguous in-radius candidate with known detected geometry
  becomes eligible only after the operator explicitly selects it. This
  confirmation remains transient and is not trusted from an imported file.
- Unconfirmed, unmatched, duplicate-reference, reused-component,
  reused-footprint, and out-of-image results are skipped with explicit reasons.
- Found-footprint pad bounds are transformed by the matching side's accepted
  calibration and rounded outward to an integer source-image rectangle.
- Proposed rectangles are rejected rather than clipped when they cross an
  image boundary.
- Applying a plan preserves non-geometry component fields and rejects stale
  previews when component identity or geometry has changed.
- User-interface preview, calibration entry, confirmation, and project saving
  use a separate renderer workflow.

## D-010 — Matching calibration workflow

**Status:** accepted

- An opened matching session remains transient renderer state and is never
  added to `project.json`.
- TOP and BOTTOM are calibrated independently from at least three control
  points. Millimetre coordinates come from the session when possible; pixel
  coordinates can be selected directly on the corresponding project image.
- Fitted calibration diagnostics show RMS error, maximum error, and whether
  the transform is reflected.
- The preview overlays current and proposed component rectangles on the source
  image and lists every update or explicit skip reason.
- Applying requires a separate confirmation and uses the versioned application
  plan's stale-state checks before project components are replaced.
- A successful application is one undoable project edit and is saved through
  the existing project persistence path.

## D-011 — Real-source matching import

**Status:** accepted

- Pick and Place and recognition results are selected independently through
  allowlisted preload methods; renderer code receives only a file name and
  bounded UTF-8 text.
- Both inputs are normalized to the existing millimetre matching-session
  contract. They remain transient and are not persisted in `project.json`.
- Recognition JSON accepts canonical found footprints and common detection
  containers. Recognition tables require centre X, centre Y, and side;
  width and height are optional but required for automatic placement geometry.
- Exact and acceptable results remain automatic. Uncertain and ambiguous
  candidates require an explicit in-interface selection before planning.
- A selected candidate must be on the same side, inside the calculated search
  radius, and contain non-empty geometry. Existing reuse and stale-plan
  protections continue to apply.
