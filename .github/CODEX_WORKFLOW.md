# Repository workflow for SolderMap

These rules apply to agent-assisted and manual development.

## Repository

- Repository: `Zenkin/solder-map`
- Stable branch: `main`
- Do not commit directly to `main` for normal feature or fix work.

The initial repository bootstrap is the only exception required before a
feature branch can exist.

## Task flow

1. Start from an issue or a clearly scoped task.
2. Update local `main`.
3. Read `AGENTS.md`, `docs/DECISIONS.md`, and relevant code.
4. Create a dedicated semantic branch from current `main`.
5. Make the minimum change needed for the task.
6. Do not touch unrelated files.
7. Run the relevant validation commands.
8. Open a pull request into `main` and fill the PR template.
9. Wait for review before merge.
10. Squash merge and delete the source branch.

## Branch names

Use short semantic names:

- `fix/project-path-validation`
- `feature/component-import`
- `docs/build-instructions`
- `chore/github-templates`

Avoid generic names such as `fix`, `changes`, `codex`, or `update`.

## Pull request titles

Describe the actual change without tool or agent prefixes.

Good:

```text
Validate project paths before writing files
```

Bad:

```text
[codex] Validate project paths before writing files
```

## One task, one pull request

Do not combine unrelated work such as:

- renderer features;
- project data migrations;
- Electron security changes;
- packaging changes;
- dependency upgrades;
- documentation rewrites.

If a task reveals another problem, open or reference a separate issue.

## Validation

Run the smallest relevant checks:

```bash
npm ci
npm run check
```

For UI or workflow changes, launch the application with `npm start` and
describe the scenarios checked manually.

For packaging changes, build and smoke-test the affected platform. If a check
cannot be run, explain why in the pull request.

## Merge and cleanup

Preferred merge method: squash merge.

After merge:

- ensure `Fixes #...` closed the linked issue when appropriate;
- delete the PR source branch;
- keep investigation history in the issue, PR discussion, diff, and squash
  commit.
