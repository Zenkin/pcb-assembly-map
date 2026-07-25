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
