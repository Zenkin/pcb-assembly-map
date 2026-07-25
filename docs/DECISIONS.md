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

Project format version 3 extends version 2 with an optional
`verificationMap` object. Existing version 2 projects are upgraded in memory
when opened; missing verification data is interpreted as an empty map. The
extension does not remove or reinterpret existing fields.

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
