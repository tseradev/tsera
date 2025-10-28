# CLI command reference

This reference expands on the four core commands available in the TSera CLI. Each section covers the
signature, relevant options, outputs, and recommended scenarios.

## Conventions

- Commands default to the interactive TUI. Add `--json` to receive newline-delimited JSON suitable
  for automation.
- Options are kebab-case and can be combined (for example `tsera dev --json --strict`).
- Exit codes: `0` = success, `1` = generic error, `2` = incoherence detected in `--strict` mode.

## `tsera init <project-name>`

Scaffold a new project using the `app-minimal` template.

```bash
tsera init my-app
```

### Key behaviours

- Copies the template into `<project-name>/`.
- Generates `tsera.config.ts` with inline documentation and the `full` profile enabled.
- Initializes `.tsera/graph.json` and `.tsera/manifest.json` by running an initial plan/apply cycle.
- Produces a `.gitignore` that excludes build artefacts.

### Options

| Option         | Description                                                                        |
| -------------- | ---------------------------------------------------------------------------------- |
| `--json`       | Emit NDJSON events (`init:start`, `init:write`, `init:done`).                      |
| `--no-install` | Skip dependency installation (useful when running from source or in offline mode). |
| `--strict`     | Treat recoverable warnings (e.g. missing permissions) as errors.                   |

### Typical usage

Use `init` whenever you onboard a new service or reproduce a clean environment for end-to-end tests.
Combine with `--json` when scripting the creation of sandboxes.

## `tsera dev`

Run the continuous coherence loop (watch → plan → apply → report).

```bash
tsera dev                # start the watcher
```

### Key behaviours

- Observes entity and configuration files, debouncing quick edits.
- Computes a minimal plan (create/update/delete/noop) based on cached hashes.
- Applies the plan using `safeWrite`, only touching files that changed.
- Outputs a coherence summary after each cycle.

### Options

| Option        | Description                                                                   |
| ------------- | ----------------------------------------------------------------------------- |
| `--json`      | Switch to NDJSON output for CI pipelines.                                     |
| `--strict`    | Exit with code `2` when incoherence remains after applying changes.           |
| `--plan-only` | Print the next plan and exit without applying it.                             |
| `--once`      | Run a single plan/apply cycle and exit.                                       |
| `--apply`     | Force the apply phase even if nothing changed (useful after manual cleanups). |

### Typical usage

Keep `tsera dev` running while working on entities. Use `--once` in hooks or CI steps where you want
to verify coherence deterministically. Pair `--plan-only` with `--json` to preview upcoming changes.

## `tsera doctor`

Audit the project for drifts and optionally apply safe fixes.

```bash
tsera doctor
```

### Key behaviours

- Rebuilds the dependency graph from scratch without relying on the cached `.tsera` state.
- Highlights missing, outdated, or orphaned artefacts.
- Suggests remediation steps and, when safe, can fix them automatically.

### Options

| Option     | Description                                                           |
| ---------- | --------------------------------------------------------------------- |
| `--json`   | Emit machine-readable diagnostics (`doctor:issue`, `doctor:summary`). |
| `--fix`    | Apply safe fixes (re-run generators for drifted nodes).               |
| `--strict` | Exit with code `2` when issues remain after the run.                  |

### Typical usage

Run `tsera doctor --strict` in CI to block merges when coherence breaks. Pair `--fix` with
interactive runs to repair typical drifts before committing.

## `tsera update`

Upgrade the CLI installation or download the latest binary release.

```bash
tsera update --channel=stable
```

### Key behaviours

- Fetches metadata from the chosen release channel.
- Either installs via `deno install` (default) or downloads binaries produced by `deno compile`.
- Provides post-update hints (rerun `doctor`, check release notes).

### Options

| Option             | Description                                                           |
| ------------------ | --------------------------------------------------------------------- |
| `--channel <name>` | Select `stable`, `beta`, or `canary`.                                 |
| `--binary`         | Force the binary download flow instead of `deno install`.             |
| `--json`           | Emit progress as NDJSON events (`update:download`, `update:install`). |
| `--strict`         | Fail if the version check detects a downgrade or missing artifacts.   |

### Typical usage

Use `update` after new releases. Automate checks in CI/CD to ensure your environments run the same
version. Combine with `--json` to log progress or integrate into dashboards.

---

For deeper insight into how these commands orchestrate the DAG, refer to the
[architecture guide](./ARCHITECTURE.md) and explore the task-driven workflows in
[RECIPES.md](./RECIPES.md).
