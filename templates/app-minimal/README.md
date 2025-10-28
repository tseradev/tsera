# TSera app-minimal template

This skeleton provides an ultra-minimal Deno application built on [Hono](https://hono.dev/) and a
`User` entity defined with TSera. It acts as the starting point for `tsera init`.

## Prerequisites

1. Deno v2 installed locally.
2. Access to the `tsera` module published on JSR or a local import-map link (see below).
3. (Optional) Fresh dependencies if you want to enable the `web/` folder.

## Getting started

1. Install dependencies:
   ```bash
   deno task cache
   ```
2. Review/edit `import_map.json` if you are developing locally against the TSera repository (for
   example `file://../..`).
3. (Optional) Install Fresh dependencies if you plan to enable the `web/` directory.

## Quick run

```bash
# Run the API server
deno run -A main.ts
```

## TSera entities

The `User` entity located in `domain/User.entity.ts` demonstrates how to use `defineEntity` to
declare a persisted table and document its columns. You can enrich this entity or create new ones in
the same folder.

## Fresh integration

The `web/` folder contains the foundations to plug Fresh. Files are intentionally minimal to leave
room for customization.

### Ideas to extend

- Add extra Hono routes in `routes/`.
- Keep entities in sync with `tsera dev` to generate schemas, migrations, and documentation.
- Replace the `tsera/` alias with `jsr:tsera/` once the module is published.

Happy experimenting!
