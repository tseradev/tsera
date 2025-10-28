# Task-oriented recipes

These recipes highlight repeatable workflows that keep TSera projects coherent while staying
faithful to the "declare once, generate everywhere" philosophy.

## Add a new entity

1. Create `domain/<Entity>.entity.ts` and declare the entity with `defineEntity`:
   ```ts
   import { defineEntity } from "../deps.ts"; // or the path resolved by your import map

   export default defineEntity({
     name: "Invoice",
     table: true,
     doc: true,
     test: "smoke",
     columns: {
       id: { type: "string" },
       total: { type: "number" },
       issuedAt: { type: "date" },
       status: { type: { arrayOf: "string" }, description: "History of states" },
     },
   });
   ```
2. Save the file while `tsera dev` is running. The watcher adds the entity to the DAG and emits the
   plan (expect new schema, migration, doc, and test nodes).
3. Inspect the generated artifacts:
   - `drizzle/<timestamp>_create_invoice.sql`
   - `docs/Invoice.md`
   - `tests/Invoice.test.ts`
   - `schemas/Invoice.schema.ts` and matching OpenAPI fragments
4. Commit both the entity and the produced artifacts to keep the repo coherent.

## Regenerate artifacts on demand

Use this workflow when you need a one-off regeneration (for CI, pre-commit hooks, or scripted
builds):

```bash
tsera dev --plan-only        # Inspect the plan without touching the filesystem
tsera dev --once             # Run plan + apply once
```

- `--plan-only` stops after printing the summary. Combine it with `--json` to integrate into bots.
- `--once` runs a single cycle and exits with `0` when coherence is restored (or `2` in `--strict`).

## Diagnose and fix incoherence

1. Run `tsera doctor` from the project root to recompute the graph and compare it to the persisted
   state.
2. Examine the reported nodes:
   - `missing` indicates that a required artifact (schema, doc, test, migration) is absent.
   - `drifted` points at files whose content no longer matches the expected hash.
3. Decide how to act:
   - Use `tsera doctor --fix` to apply safe fixes automatically (re-generate deterministic
     artifacts).
   - If the drift is intentional, edit the source entity/config and let `tsera dev` reconcile the
     graph.
4. Re-run `tsera doctor --strict` in CI to ensure exit code `2` when incoherence persists.

## Export machine-readable reports

To feed dashboards or additional tooling, consume the JSON events emitted by the CLI:

```bash
tsera dev --json --strict | tee coherence.ndjson
```

Each line is a compact event; aggregate them to surface the "time to coherence" metric or to audit
applied steps.

## Update the CLI safely

When a new release is available:

```bash
tsera update --channel=stable          # or beta/canary for early features
```

- Add `--binary` to force downloading precompiled binaries instead of using `deno install`.
- Combine with `--json` to trace progress programmatically.
- Follow up with `tsera doctor --fix` to validate that new defaults did not introduce drifts.

## Recover from merge conflicts in generated files

1. Resolve conflicts in the source entities or configuration first.
2. Run `tsera dev --once` to regenerate artifacts from the now-consistent source of truth.
3. Reset conflicted generated files if necessary (`git checkout --theirs docs/...`), then re-run the
   apply phase to obtain a clean slate.
4. Commit the regenerated artifacts together with the resolved source changes.

These recipes keep projects aligned while showcasing how TSera automates the busy work for you.
