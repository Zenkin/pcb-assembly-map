# SolderMap

Desktop application for preparing PCB assembly maps and tracking manual
soldering progress.

The editor lets an operator:

- create a project and attach TOP/BOTTOM PCB images;
- mark component locations directly on the images;
- group components and arrange them into assembly stages;
- search and filter the component list;
- track soldered components and overall progress;
- record an independent component verification status, measured value, unit,
  and verification comment;
- compare resistor and capacitor measurements with BOM values and percentage
  tolerances, including automatic unit conversion;
- see verification marks on the board, filter components by verification
  state, and review the board-wide verification summary;
- keep the project data and source images together in a local folder.

## Requirements

- Node.js 20 LTS or newer;
- npm 10 or newer.

## Run from source

```bash
npm ci
npm run check
npm start
```

Application projects are stored in `SolderMap Projects` inside the current
user's Documents directory. Each project contains a `project.json` file and
its PCB images.

## Build

```bash
# Windows installer and portable executable
npm run build

# Linux tar.gz
npm run build:linux

# macOS dmg and zip (run on macOS)
npm run build:mac
```

Build artifacts are written to `dist/`. This directory is intentionally not
tracked by Git.

## Downloads

Ready-to-use builds are published as assets on the
[GitHub Releases](https://github.com/Zenkin/solder-map/releases) page.
Source code and generated installers are kept separate so that repository
history remains compact and reproducible.

## Project structure

```text
index.html       Renderer markup
css/styles.css   Application styles
js/app.js        Renderer state and interactions
preload.js       Safe renderer-to-main IPC bridge
main.js          Electron lifecycle, filesystem and project IPC
assets/          Application icons
```

## Specifications

- [Component verification module](docs/specifications/component-verification.md) — approved requirements, acceptance criteria, BOM update rules, and reporting behavior.

## Development workflow

The stable branch is `main`. Normal changes start from an issue, use a
dedicated semantic branch, and are merged through a pull request. See
[`AGENTS.md`](AGENTS.md) and
[`.github/CODEX_WORKFLOW.md`](.github/CODEX_WORKFLOW.md) for the repository
rules.

## License

No open-source license has been granted yet. The source is publicly visible,
but reuse and redistribution rights are not implied.
