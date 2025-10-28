# TSera app-minimal template

This skeleton provides an ultra-minimal Deno application built on [Hono](https://hono.dev/) and a
`User` entity defined with TSera. It acts as the starting point for `tsera init` and demonstrates
what a freshly generated project should already include: a health route, a smoke test, and a
documented configuration.

## Prerequisites

1. Deno v2 installed locally.
2. Access to the `tsera` module published on JSR or a local import-map link (see below).
3. (Optional) Fresh dependencies if you want to enable the `web/` folder.

## Getting started

1. Install dependencies as needed by simply running commands (`deno` fetches remote modules on
   demand).
2. When working locally against the TSera repository, update `import_map.json` to point `"tsera/"`
   to your checkout (for example `"tsera/": "file://../tsera-codex/src/"`). Once `jsr:tsera` is
   published you can switch back to the public package alias included in the template.
3. (Optional) Install Fresh dependencies if you plan to enable the `web/` directory.
4. The helper located at `deps/hono.ts` tries to load the real [`hono`](https://hono.dev/) package
   from `npm`. When the network is not available (for example in CI or offline environments) it
   falls back to a tiny local router that implements the subset of methods used in the template. Run
   `deno add npm:hono@4` inside the generated project to pin the official package once you are
   ready.

## Quick run

```bash
# Generate artifacts once so `.tsera/` contains schemas & docs
tsera dev --once

# Run the API server (will listen on http://localhost:8000)
deno run -A main.ts

# In another terminal, hit the health route
curl http://localhost:8000/health
```

The health handler responds with a JSON payload similar to:

```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

## TSera entities

The `User` entity located in `domain/User.entity.ts` demonstrates how to use `defineEntity` to
declare a persisted table and document its columns. You can enrich this entity or create new ones in
the same folder. After each edit keep `tsera dev` running to regenerate:

- `.tsera/schemas/User.schema.ts` (Zod definition).
- `drizzle/<timestamp>_...sql` (SQL migration when `table: true`).
- `docs/User.md` (generated documentation when `doc: true`).
- `tests/User.test.ts` (smoke test when `test: "smoke"`).

## Fresh integration

The `web/` folder contains the foundations to plug Fresh. Files are intentionally minimal to leave
room for customization.

### Ideas to extend

- Add extra Hono routes in `routes/` (the `tests/health.test.ts` example shows how to exercise
  handlers via `app.request`).
- Keep entities in sync with `tsera dev` to generate schemas, migrations, and documentation.
- Replace the local `tsera/` alias with `jsr:tsera/` once the module is published.
- Create more smoke tests that import generated schemas from `.tsera/schemas/`.

Happy experimenting!
