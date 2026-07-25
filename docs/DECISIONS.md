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
