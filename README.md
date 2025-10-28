# TSera

> Full TypeScript · Unification · Simplicity · Automation · Continuous Coherence (CC)

TSera is a CLI engine and entity core for Deno v2 projects that delivers **continuous coherence**
and **automated artifacts** (Zod schemas, OpenAPI definitions, Drizzle migrations, docs, tests) from
a single source of truth. The goal is to provide Deno-first tooling where every declared entity
stays aligned with the application from the `plan` phase to the final `apply`.

## Product promise

1. **A single source** (`defineEntity`) describes the domain model.
2. **A CLI engine** turns that model into ready-to-use artifacts (API, migrations, docs, tests).
3. **Continuous coherence** keeps those artifacts synchronized without manual effort.

TSera aims to shrink the time between an entity idea and its availability across code, database, and
team-facing documentation.

## Current stack

- **Deno v2** (strict ESM, tasks managed via `deno.jsonc`).
- **Cliffy** for the modular CLI (`init`, `dev`, `doctor`, `update`).
- **Zod**, **zod-to-openapi**, and **Drizzle** to project entities.
- **TS-Morph** to drive TypeScript generation.
- **Hono/Fresh templates** to bootstrap the `app-minimal` project.

## Quick start

### Prerequisites

- [Install Deno v2](https://docs.deno.com/runtime/manual/getting_started/installation) and enable
  the `deno` binary in your `PATH`.
- Clone this repository or install the published binary/module when releases are available.

### Install the CLI locally

From the repository root you can install the CLI globally with `deno install` (Deno v2 now requires
the `--global` flag when permission options such as `-A` are provided):

```bash
deno install --global -A -f --name tsera src/cli/main.ts
```

This makes a `tsera` executable available in your shell (the command can also be run directly with
`deno run -A src/cli/main.ts ...` during development).

### Hello world walkthrough

```bash
# 1. Scaffold a new project in ./demo
tsera init demo

# 2. Move into the generated project and inspect the structure
cd demo
ls
# (optional) run `tree -L 2` if the tree command is available

# 3. Start the continuous coherence loop
tsera dev --once

# 4. Keep the watcher active during development
tsera dev
```

When `tsera init` completes you will find:

- `tsera.config.ts` — a fully documented configuration with defaults for entities, paths, and deploy
  targets.
- `.tsera/graph.json` & `.tsera/manifest.json` — cached hashes and manifest produced by the engine.
- `drizzle/`, `docs/`, and `tests/` — folders that will receive generated migrations, documentation,
  and smoke tests as soon as entities are introduced.
- `templates/app-minimal` files copied into the new project: a Hono API, Fresh front-end islands,
  and an example `User` entity to explore.

Running `tsera dev` triggers a full **plan → apply** cycle. The default (interactive) mode displays
a summary of the detected entities, the generated artifacts, and the resulting coherence status. Use
`--json` for NDJSON output suitable for CI pipelines.

For a more exhaustive, step-by-step onboarding (including sample outputs), read the
[Getting Started guide](./docs/GETTING_STARTED.md).

## Documentation

- [Getting Started](./docs/GETTING_STARTED.md)
- [Task-oriented recipes](./docs/RECIPES.md)
- [CLI command reference](./docs/CLI_REFERENCE.md)
- [Detailed architecture guide](./docs/ARCHITECTURE.md)
- [Community landing & resources](./docs/README.md)
- [Communication playbook & assets](./docs/COMMUNICATION.md)

## Release & distribution

Official releases follow this sequence:

1. Create a `vX.Y.Z` tag and push it to the remote repository.
2. Run the multi-platform compilation:
   ```bash
   deno compile -A --output dist/tsera src/cli/main.ts
   ```
3. Publish the binaries on the GitHub release.
4. (Optional) Publish the JSR module:
   ```bash
   deno publish
   ```

An automated script will eventually package and publish binaries (Linux, macOS, Windows) and, when
enabled, push the `jsr:tsera` package.

### Preparing a stable tag

Before every release:

1. Validate local coherence:
   ```bash
   deno task fmt && deno task lint && deno task test
   ```
2. Run a full `dev` cycle in an example project generated with `tsera init demo`.
3. Update version numbers in `deno.jsonc`, `src/cli/main.ts`, and the documentation.
4. Draft a concise changelog (section `## Release vX.Y.Z` in `docs/COMMUNICATION.md`).
5. Prepare communication assets (thread script, ready-to-post messages) and plan the upcoming visual
   capture.

After completing these checks, create the `vX.Y.Z` tag and follow the release procedure above.

## Continuous coherence workflow

1. **Observe** — `watch.ts` aggregates changes on entities and the configuration.
2. **Plan** — `planner.ts` computes the steps (`create`, `update`, `delete`, `noop`).
3. **Apply** — `applier.ts` writes artifacts with `safeWrite` and updates `.tsera/`.
4. **Report** — `--json` outputs describe the status (`coherence: ok/drift/error`).

The cycle can run manually (`plan/apply`) or automatically through `tsera dev`.

## CLI commands at a glance

| Command             | Purpose                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `tsera init <name>` | Scaffold the `app-minimal` template, generate `.tsera` state, and prepare a ready-to-commit project. |
| `tsera dev`         | Run the continuous coherence loop (watch → plan → apply) and regenerate artifacts on change.         |
| `tsera doctor`      | Rebuild the dependency graph, detect drifts, and optionally auto-fix safe issues.                    |
| `tsera update`      | Download or compile the latest CLI release/binary and refresh recommended tooling.                   |

Key options to remember:

- `tsera init` — `--no-install` to skip dependency installs, `--json` for machine-readable progress.
- `tsera dev` — `--json` for NDJSON logs, `--strict` to exit with code `2` when drift remains,
  `--plan-only` or `--once` for scripted runs.
- `tsera doctor` — `--fix` for safe remediation, `--strict` to gate CI, `--json` for diagnostics.
- `tsera update` — `--channel` (`stable`/`beta`/`canary`), `--binary` to force compiled releases,
  `--json` to stream progress.

All commands offer an interactive TUI by default. The detailed behaviour, exit codes, and example
outputs are documented in the [CLI command reference](./docs/CLI_REFERENCE.md).

## Repository structure

```text
.
├─ src/               # TypeScript core (entities, Cliffy CLI, plan/apply engine)
├─ templates/         # Example projects generated by `tsera init`
├─ docs/              # Technical documentation, communication notes, release material
├─ scripts/           # Automation (E2E, release, utilities)
├─ deno.jsonc         # Deno task configuration and lint/formatter rules
└─ import_map.json    # Local development import aliases
```

## Contributing

1. Fork the repository and create a `feat/...` or `docs/...` branch.
2. Implement the change while following the constraints listed in [`AGENTS.md`](./AGENTS.md).
3. Run the local checks (`deno task fmt`, `deno task lint`, `deno task test`).
4. Open a PR with a `[scope] Concise description` title and a clear summary.

For any discussion or proposal, open an issue or reach out via the channels listed in
`docs/COMMUNICATION.md`.

## Immediate roadmap

1. Finalize `defineEntity` and the Zod/OpenAPI/Drizzle helpers.
2. Stabilize the Cliffy CLI with the `init`, `dev`, `doctor`, `update` commands.
3. Ship the complete `app-minimal` template with generated artifacts.
4. Enable the E2E flow (`scripts/e2e.ts`).
5. Publish an experimental binary for early feedback.
