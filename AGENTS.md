# SolderMap repository guidance

## Sources of truth

Read these files before changing the project:

1. `README.md` — supported usage, build commands, and project structure.
2. `docs/DECISIONS.md` — accepted architectural and product decisions.
3. `.github/CODEX_WORKFLOW.md` — branch, issue, PR, validation, and review workflow.
4. `package.json` — application metadata, scripts, and packaging configuration.

If code, issues, and documentation disagree, report the mismatch before making
an architectural or data-format change.

## Repository workflow

- Stable branch: `main`.
- Do not commit directly to `main` for normal feature or fix work.
- Start each task from current `main` in a dedicated semantic branch.
- Keep one logical task per pull request and avoid unrelated edits.
- Do not prefix PR titles with tool or agent names.
- Prefer squash merge.
- Close the linked issue after its acceptance criteria are satisfied.
- Delete temporary branches after merge.

## Architecture boundaries

SolderMap is a local Electron application:

```text
Renderer (index.html, css/, js/app.js)
        |
        | window.projectApi / window.fileBrowserApi
        v
Preload bridge (preload.js)
        |
        | allowlisted IPC channels
        v
Main process (main.js) -> local project folders
```

- `main.js` owns Electron lifecycle, filesystem access, and IPC handlers.
- `preload.js` is the only supported bridge from renderer code to Electron.
- `js/app.js` owns renderer state, editing, filtering, and UI interactions.
- Project folders contain `project.json` plus the selected PCB images.
- Ready installers and archives belong in GitHub Releases, not in Git history.

Keep `contextIsolation: true` and `nodeIntegration: false`. Do not expose raw
`ipcRenderer`, Node.js modules, or unrestricted filesystem functions to the
renderer.

## Data and filesystem safety

- Preserve compatibility with existing `project.json` files unless an issue
  explicitly defines a migration.
- Treat paths received over IPC as untrusted input.
- Validate destructive operation targets against the expected project root.
- Do not weaken the path validation used by project deletion.
- Do not commit personal project data, PCB images, credentials, or local paths.

## Dependencies and generated files

- Keep dependency changes scoped and explain why they are needed.
- Commit `package-lock.json` when dependency metadata changes.
- Never commit `node_modules/` or `dist/`.
- Publish generated `.exe`, `.dmg`, `.zip`, `.AppImage`, or `.tar.gz` files as
  GitHub Release assets.
- Do not manually edit generated packages.

## Validation

For JavaScript changes, run:

```bash
npm ci
npm run check
```

For renderer or workflow changes, also launch the application with `npm start`
and record the scenarios checked manually.

For packaging changes, build the affected platform and record the produced
artifact names and a launch/install smoke test. Explain in the PR when a
required platform-specific check could not be run.

## Documentation maintenance

Update `README.md` when user-facing setup, build, storage, or release behavior
changes.

Update `docs/DECISIONS.md` when an architectural, compatibility, security, or
distribution decision changes.
