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
- **Cliffy** for the modular CLI (`init`, `dev`, `doctor`, `cd`, `update`).
- **Zod**, **zod-to-openapi**, and **Drizzle** to project entities.
- **TS-Morph** (via JSR) for AST-based TypeScript code generation.
- **Hono** API framework (optional module).
- **Fresh** SSR frontend framework (optional module).
- **Docker Compose** for local development (optional module).
- **GitHub Actions** CI workflows (optional module, generates 6 workflows in `.github/workflows/`).
- **Type-safe secrets management** with environment validation (optional module).
- **Type-Safe SDK** generation for seamless Backend-Frontend integration.
- **MCP Server** (`tsera mcp`) to expose project architecture to AI agents.

## Quick start

### Prerequisites

- [Install Deno v2](https://docs.deno.com/runtime/manual/getting_started/installation) and enable
  the `deno` binary in your `PATH`.
- Clone this repository or install the published binary/module when releases are available.

### Install the CLI locally

From the repository root you can install the CLI globally with `deno install` (Deno v2 now requires
the `--global` flag when permission options such as `-A` are provided). Include both the repository
config and the import map so the bundled command keeps the `tsera/*` aliases:

```bash
deno install --global --config deno.jsonc --import-map import_map.json -A -f --name tsera src/cli/main.ts
```

This makes a `tsera` executable available in your shell (the command can also be run directly with
`deno run -A src/cli/main.ts ...` during development).

> ℹ️ Deno 2 currently ignores import maps declared inside configuration files during `deno install`.
> The repository config therefore omits that entry, and the installation command must include the
> explicit `--import-map import_map.json` flag so the installed binary can resolve the `tsera/*`
> aliases.

### Hello world walkthrough

```bash
# 1. Scaffold a new project with all modules enabled (default)
tsera init demo

# Or create a minimal project with only specific modules
tsera init demo --no-fresh --no-docker --no-ci

# Note: The CI module generates 6 workflows in .github/workflows/:
# - ci-lint.yml, ci-test.yml, ci-build.yml, ci-codegen.yml, ci-coherence.yml, ci-openapi.yml
# These workflows are templates that can be freely modified after generation.
# TSera does not regenerate or synchronize them (unlike CD workflows managed by 'tsera deploy sync').

# Or create a backend-only project
tsera init demo --no-fresh

# 2. Move into the generated project and inspect the structure
cd demo
ls
# (optional) run `tree -L 2` if the tree command is available

# 3. Start the continuous coherence loop (watches for changes)
tsera dev

# 4. Or run a quick validation (useful for CI)
tsera doctor --quick

# 5. Launch the demo API (if Hono module is enabled)
deno run -A main.ts

# Or use Docker Compose (if Docker module is enabled)
docker-compose up

# 6. Hit the health route (responds with `{ "status": "ok" }`)
curl http://localhost:8000/health

# 7. Run the bundled smoke tests (health route + generated schemas)
deno task test
```

### Continuous Deployment (CD)

TSera supports multi-provider Continuous Deployment via the `tsera deploy` command:

```bash
# Configure deployment providers interactively
tsera deploy init

# Synchronize CD workflows from config/cd/ to .github/workflows/
tsera deploy sync

# Force overwrite manually modified workflows
tsera deploy sync --force
```

**Supported providers:**
- **Docker**: Build and push Docker images, deploy to container registries
- **Cloudflare**: Deploy to Cloudflare Pages or Workers
- **Deno Deploy**: Deploy to Deno Deploy platform
- **Vercel**: Deploy to Vercel (preview and production)
- **GitHub**: Deploy to GitHub Pages or create GitHub Releases

Workflows are defined in `config/cd/<provider>/` and automatically synchronized to `.github/workflows/` with hash-based protection to prevent accidental overwrites of manual modifications.

### Modular Architecture

TSera uses a modular architecture where you can enable or disable specific features:

**Available modules (all enabled by default):**

- **Hono**: Fast and minimal API framework (Hono v4 via JSR/npm)
- **Fresh**: Server-side rendering with islands architecture (Fresh v2 via JSR + Preact v10 via npm)
- **Docker**: Docker Compose configuration with PostgreSQL
- **CI**: GitHub Actions workflows (6 workflows: lint, test, build, codegen, coherence, openapi)
- **Secrets**: Type-safe environment variable management with Zod validation

**Disable modules using flags:**

```bash
# Minimal backend-only project
tsera init my-app --no-fresh --no-docker --no-ci

# API + Fresh frontend only
tsera init my-app --no-docker --no-ci

# Full stack without CI
tsera init my-app --no-ci
```

> The template ships with `deps/hono.ts`, a thin loader that attempts to import `npm:hono@4`. If the
> network is unavailable it falls back to a minimal router so tests continue to run offline. Once
> you are ready to depend on the full framework, execute `deno add npm:hono@4` inside the generated
> project to pin the official package.

When `tsera init` completes you will find:

- `tsera.config.ts` — a fully documented configuration with defaults for entities, paths, deploy
  targets, and enabled modules.
- `.tsera/graph.json` & `.tsera/manifest.json` — cached hashes and manifest produced by the engine.
- `drizzle/`, `docs/`, and `tests/` — folders that will receive generated migrations, documentation,
  and smoke tests as soon as entities are introduced.
- `domain/User.entity.ts` — an example entity to explore.
- **Hono module** (if enabled): `main.ts`, `routes/health.ts`, and API infrastructure.
- **Fresh module** (if enabled): `web/` directory with routes, islands, and static assets.
- **Docker module** (if enabled): `docker-compose.yml` and `Dockerfile` for containerized
  development.
- **CI module** (if enabled): `.github/workflows/` with 6 CI workflows (`ci-lint.yml`, `ci-test.yml`, `ci-build.yml`, `ci-codegen.yml`, `ci-coherence.yml`, `ci-openapi.yml`). These are templates generated once at init and can be freely modified (not synchronized by TSera).
- **Secrets module** (if enabled): `env.config.ts` for type-safe environment variable management.

### Type-Safe Secrets Management

The **Secrets module** provides runtime validation of environment variables with full TypeScript
support:

```typescript
// env.config.ts - Define your environment schema
import { defineEnvSchema } from "tsera/core/secrets.ts";

export const envSchema = defineEnvSchema({
  DATABASE_URL: {
    type: "string",
    required: true,
    description: "PostgreSQL connection URL",
  },
  PORT: {
    type: "number",
    required: false,
    default: 8000,
  },
  API_KEY: {
    type: "string",
    // Environment-specific requirements
    required: { dev: false, preprod: true, prod: true },
  },
  DEBUG: {
    type: "boolean",
    required: false,
    default: false,
    environments: ["dev"], // Only checked in dev
  },
});
```

```typescript
// main.ts - Validate on startup
import { validateEnv } from "./lib/env.ts";
import { envSchema } from "./env.config.ts";

const env = Deno.env.get("TSERA_ENV") || "dev";
const validation = validateEnv(envSchema, env);

if (!validation.valid) {
  console.error("Environment validation failed:");
  validation.errors.forEach((err) => console.error(`  - ${err}`));
  Deno.exit(1);
}

// Type-safe access to environment variables
const port = validation.values.PORT; // Type: number
const dbUrl = validation.values.DATABASE_URL; // Type: string
```

This ensures your application refuses to start if required environment variables are missing or
invalid, preventing runtime errors in production.

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

| Command             | Purpose                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `tsera init <name>` | Scaffold a project from `base` template + selected modules, generate `.tsera` state, and prepare a ready-to-commit project. |
| `tsera dev`         | Run the continuous coherence loop (watch → plan → apply) and regenerate artifacts on change. |
| `tsera doctor`      | Diagnose project coherence. Default mode shows all artifacts (changed and unchanged), exits with code 1-2 if issues found. Use `--quick` for fast validation (shows only changes, exits with code 0). |
| `tsera update`      | Download or compile the latest CLI release/binary and refresh recommended tooling.                                          |

Key options to remember:

- `tsera init` — `--no-install` to skip dependency installs, `--json` for machine-readable progress.
- `tsera dev` — `--json` for NDJSON logs. Use for active development with watch mode and module management.
- `tsera doctor` — `--quick` for fast validation (shows only changes, exits with code 0). `--fix` for safe remediation. `--strict` to gate CI. `--json` for diagnostics. Default mode shows all artifacts and exits with code 1-2 if issues found.
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
3. Ship the complete template system (`base` + modules) with generated artifacts.
4. Enable the E2E flow (`e2e.test.ts`).
5. Publish an experimental binary for early feedback.
