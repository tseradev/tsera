# CLI quick reference

TSera ships four commands that cover the full DX loop: initialize, develop, audit, and upgrade. The
goal is to keep every workflow one flag away from the default behaviour.

## Modern help at a glance

Running `tsera` without arguments prints the opinionated help layout rendered by `applyModernHelp`:

```text
TSERA · Continuous coherence engine for entities.
Version 0.0.0-dev

USAGE
  tsera <command> [options]

GLOBAL OPTIONS
  --json        Stream machine-readable NDJSON events.
  --strict      Treat inconsistencies as fatal (exit code 2).
  -h, --help    Show this help message.
  -V, --version Display the CLI version.

COMMANDS
  init [directory]  Scaffold a TSera project from a template and bootstrap artifacts.
  dev               Watch entities, plan changes, and apply generated artifacts in-place.
  doctor            Inspect project coherence, highlight issues, and offer safe fixes.
  update            Upgrade the TSera CLI via deno install or compiled binaries.

EXAMPLES
  $ tsera init demo-app --template app-minimal
  $ tsera dev --json
  $ tsera doctor --strict
```

### Global conventions

- Every command opts into the interactive TUI by default. Add `--json` for automation-friendly
  NDJSON.
- Add `--strict` to make pending work fail fast with exit code `2` (useful in CI).
- Exit codes: `0` success · `1` generic error · `2` pending work detected with `--strict`.

## Command cheatsheet

| Command      | Default behaviour                                         | One-liner tweak                                                  |
| ------------ | --------------------------------------------------------- | ---------------------------------------------------------------- |
| `init [dir]` | Copy `app-minimal`, generate config, bootstrap coherence. | `--template <name>` to pick another kit.                         |
| `dev`        | Watch files, plan/apply, stream a concise summary.        | `--once` for CI, `--plan-only` to preview                        |
| `doctor`     | Rebuild everything from scratch to surface drifts.        | `--fix` to auto-apply safe remediations.                         |
| `update`     | Upgrade via `deno install` using the `stable` channel.    | `--binary` for compiled builds, `--dry-run` to inspect commands. |

## `tsera init`

Fastest way to bootstrap a TSera-ready project.

```bash
tsera init my-app
```

**Defaults you get automatically**

- Template files copied into `my-app/` (uses `app-minimal`).
- `tsera.config.ts` generated with inline documentation and the `full` profile.
- `.tsera/graph.json` and `.tsera/manifest.json` produced after the first plan/apply.
- `.gitignore` augmented with TSera artefacts.

**Flags when you need them**

- `--template <name>` – swap the starter (defaults to `app-minimal`).
- `-f, --force` – overwrite existing files in a non-empty directory.
- `-y, --yes` – skip confirmation prompts (perfect for scripts).

## `tsera dev`

Keep coherence tight while editing entities.

```bash
tsera dev
```

**What happens**

- Watches configs and entities (debounced) then regenerates only what changed.
- Plans create/update/delete/noop steps using cached hashes.
- Applies results through `safeWrite`, keeping diffs clean.
- Emits `plan:*`, `apply:*`, and `coherence` events to the logger.

**Minimal flags for control**

- `--once` – run a single cycle (great for CI hooks).
- `--plan-only` – inspect the next plan without applying.
- `--apply` – force the apply stage even when the plan is empty (post-cleanup helper).
- `--watch/--no-watch` – toggle the watcher (watching is on by default).

## `tsera doctor`

Deep audit with optional automatic healing.

```bash
tsera doctor
```

**What you get**

- Full graph rebuild without touching cached `.tsera` state.
- Drift detection across generated artefacts.
- Prescriptive log output pointing to issues.

**Single flag when you want fixes**

- `--fix` – regenerate artefacts that TSera can safely repair.

Combine with `--strict` to make CI fail when any drift remains.

## `tsera update`

Stay on the latest CLI release.

```bash
tsera update
```

**Default flow**

- Detects the current Deno version.
- Runs `deno install` against the `stable` channel.
- Suggests post-upgrade follow-ups (`doctor`, `dev --apply`).

**Optional switches**

- `--channel <stable|beta|canary>` – pick a release track.
- `--binary` – download the compiled executable into `dist/tsera`.
- `--dry-run` – print the underlying `deno` command without executing it.

---

For more context on the coherence engine and generated artefacts, visit the
[architecture guide](./ARCHITECTURE.md) and the workflow [recipes](./RECIPES.md).
