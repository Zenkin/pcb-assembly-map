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
- export all component verification results to printable PDF, UTF-8 CSV, or
  filterable Excel `.xlsx`;
- import or update a CSV/TSV BOM with a preview of affected components,
  conflict confirmation, and selective reset of stale verification data;
- open a millimetre-based matching-session JSON file and inspect automatic
  matching totals and per-component results;
- calibrate TOP and BOTTOM coordinates against board images, preview safe
  automatic placement changes, and apply them only after confirmation;
- keep the ten latest verification backups and restore either the complete
  snapshot or selected reference designators;
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

## BOM format

Use a UTF-8 CSV, TSV, or semicolon-delimited text file. The required column is
the reference designator; value, component type, percentage tolerance, and
side are optional. Russian and English headers are recognized, for example:

```csv
Обозначение;Номинал;Тип;Допуск %;Сторона
R1 R2;100 Ом;Резистор;5;TOP
C1-C3;0,1 мкФ;Конденсатор;;BOTTOM
```

Grouped references and simple ranges are expanded into individual components.
New components are marked as unplaced: select one in the list, enable
`Добавить элементы`, and draw its area on the board. Duplicate designators
must be corrected in the source BOM before the update can be applied.

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
js/report.js     Verification report rows and CSV/XLSX serialization
js/bom.js        BOM parsing, update planning, backups and restoration
js/matching-*.js Automatic footprint matching, exchange format and result view
preload.js       Safe renderer-to-main IPC bridge
main.js          Electron lifecycle, filesystem and project IPC
assets/          Application icons
```

## Specifications

- [Component verification module](docs/specifications/component-verification.md) — approved requirements, acceptance criteria, BOM update rules, and reporting behavior.
- [Automatic component matching](docs/specifications/automatic-component-matching.md) — approved search-radius, footprint-geometry comparison, ambiguity, and result-status rules.
- [Matching session JSON format](docs/specifications/matching-session-json.md) — versioned millimetre-based exchange format for expected and detected footprints.
- [Matching coordinate calibration](docs/specifications/matching-coordinate-calibration.md) — explicit affine conversion from millimetres to source-image pixels.
- [Matching application plan](docs/specifications/matching-application-plan.md) — safe preview and stale-state validation before pixel geometry is changed.
- [Matching calibration workflow](docs/specifications/matching-calibration-workflow.md) — operator control-point entry, visual preview, and confirmed application.

## Development workflow

The stable branch is `main`. Normal changes start from an issue, use a
dedicated semantic branch, and are merged through a pull request. See
[`AGENTS.md`](AGENTS.md) and
[`.github/CODEX_WORKFLOW.md`](.github/CODEX_WORKFLOW.md) for the repository
rules.

## License

No open-source license has been granted yet. The source is publicly visible,
but reuse and redistribution rights are not implied.
