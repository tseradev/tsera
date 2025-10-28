# Getting Started with TSera

TSera pairs a Deno-first CLI with an entity core so that every change to your domain model instantly
propagates to schemas, migrations, tests, and docs. This guide walks through the first minutes with
the tool and highlights what to expect from the continuous coherence (CC) loop.

## 1. Install prerequisites

1. Install [Deno v2](https://docs.deno.com/runtime/manual/getting_started/installation) and confirm
   the version:
   ```bash
   deno --version
   ```
2. Clone the repository or download a release bundle when available.
3. (Optional) Install the CLI globally so `tsera` is available in your shell. Pass both the
   repository config and import map so the installed command retains the aliases:
   ```bash
   deno install --global --config deno.jsonc --import-map import_map.json -A -f --name tsera src/cli/main.ts
   ```
   > During development you can replace `tsera` with `deno run -A src/cli/main.ts`. On Deno v2 the
   > `--global` flag is mandatory whenever you pass permission flags (`-A`, `--allow-*`). Without it
   > the installer exits with `the following required arguments were not provided: --global`. Deno 2
   > also ignores import maps declared within configuration files during `deno install`; the
   > repository config therefore omits that entry, and the explicit `--import-map import_map.json`
   > flag is required so the installed binary resolves the `tsera/*` aliases.

## 2. Create your first project

1. Scaffold a project (here we create `demo/` next to the repository):
   ```bash
   tsera init demo
   ```
   The command copies the `app-minimal` template, writes a fully documented `tsera.config.ts`, and
   seeds the `.tsera/` folder that stores graph metadata.
2. Explore the generated files:
   ```bash
   cd demo
   ls
   ```
   - `tsera.config.ts` contains every configuration knob with inline explanations.
   - `.tsera/graph.json` and `.tsera/manifest.json` cache hashes and capabilities.
   - `templates/app-minimal/` files are now part of your project (Hono API, Fresh web, `User`
     entity).
   - `drizzle/`, `docs/`, and `tests/` folders are ready to receive generated artifacts.

## 3. Run the continuous coherence loop

Run a single plan/apply cycle to verify the setup:

```bash
tsera dev --once
```

You should see:

- **Plan summary** — list of nodes (`entity`, `schema`, `openapi`, `migration`, `doc`, `test`) and
  the planned action (`create`, `update`, or `noop`).
- **Apply phase** — deterministic writes performed via `safeWrite`, with the location of each
  artifact.
- **Coherence report** — percentage of coherent nodes and hints if anything is pending.

Keep the watcher active while developing:

```bash
tsera dev
```

By default the CLI renders a TUI that groups logs by phase. Use `--json` to switch to NDJSON events
in CI/CD environments. Add `--strict` to turn drifts into exit code `2` (ideal for gating merges).

## 4. Modify an entity and observe regeneration

1. Open `domain/User.entity.ts` in the generated project and add a field:
   ```ts
   export default defineEntity({
     name: "User",
     table: true,
     columns: {
       id: { type: "string" },
       email: { type: "string" },
       status: { type: "string", description: "Account lifecycle" },
     },
   });
   ```
2. Save the file. The running `tsera dev` session recomputes the plan and regenerates:
   - `drizzle/<timestamp>_update_user.sql` — migration reflecting the new column.
   - `docs/User.md` — refreshed documentation.
   - `tests/User.test.ts` — smoke test covering the schema.
   - `openapi.json` and `*.schema.ts` — updated schemas with the new field.

## 5. Interpret JSON output

When you run with `--json`, TSera emits newline-delimited JSON objects. Each object has an `event`
field (`plan:start`, `plan:summary`, `apply:step`, `coherence`, …) and a `payload`. Example:

```json
{"event":"plan:summary","payload":{"created":6,"updated":0,"deleted":0,"noop":0}}
{"event":"coherence","payload":{"status":"ok","coherence":1}}
```

This makes it easy to parse results in CI pipelines or dashboards.

## 6. Next steps

- Browse the [task-oriented recipes](./RECIPES.md) for common workflows.
- Learn how each command behaves in depth with the [CLI reference](./CLI_REFERENCE.md).
- Review the [architecture notes](./ARCHITECTURE.md) to understand how the DAG, planner, and applier
  interact.

With these foundations you can grow your domain by adding entities, defining invariants, and letting
TSera keep every layer synchronized.
