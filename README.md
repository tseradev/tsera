# TSera

[![Build](https://img.shields.io/badge/build-in%20development-orange.svg)](#)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)

**DX-first full-stack TypeScript tooling for Deno that keeps code, database, docs, and infrastructure automatically aligned.**

**Full TypeScript · Unification · Simplicity · Automation · Continuous Coherence (CC)**

* **Docs:** [https://tsera.dev](https://tsera.dev) • [Getting Started](./docs/GETTING_STARTED.md) • [CLI Reference](./docs/CLI_REFERENCE.md)
* **Discord:** [https://discord.tsera.dev](https://discord.tsera.dev)
* **Status:** 🚧 Under active construction (APIs may change)

---

## What is TSera?

TSera is a **Deno v2 CLI engine + entity core** that turns a single domain definition into **coherent, ready-to-use artifacts**—continuously.

---

## Why TSera?

Modern full-stack work is repetitive and fragile:

* You define an entity… then rewrite it in validation, OpenAPI, SQL migrations, docs, tests.
* Things drift out of sync.
* “Just one change” becomes a cascade of manual updates.

**TSera solves this by enforcing Continuous Coherence (CC):** once an entity is declared, TSera keeps every derived artifact aligned from `plan` to `apply`—without manual sync steps.

---

## How it works

1. **One source of truth**: `defineEntity(...)` describes the domain model once.
2. **Plan**: TSera computes what must change (diff-based).
3. **Apply**: TSera generates/updates only the necessary artifacts.

**Generated artifacts (examples):**

* Zod schemas
* OpenAPI definitions
* Drizzle migrations
* Docs (Markdown)
* Tests (smoke/regressions)
* Optional type-safe SDK for front/back integration

---

## Quickstart (3 commands)

> Until official releases exist, install from source.

```bash
git clone https://github.com/tseradev/tsera.git && cd tsera
deno install --global --config deno.jsonc -A -f --name tsera src/cli/main.ts
tsera init demo && cd demo && tsera dev
```

---

## Minimal example

Create an entity once:

```ts
// domain/User.entity.ts
import { defineEntity } from "tsera/core";

export default defineEntity({
  name: "User",
  table: true,
  columns: {
    id: { type: "string", primaryKey: true },
    email: { type: "string", unique: true },
    createdAt: { type: "date" },
  },
});
```

Run the coherence loop:

```bash
tsera dev
```

TSera will **plan → apply** and (depending on enabled modules) generate artifacts such as:

* `schemas/user.schema.ts` (Zod validation)
* `docs/openapi/openapi.json` (OpenAPI)
* `drizzle/*` (migrations)
* `docs/entities/user.md` (documentation)
* `tests/*` (smoke/regression scaffolding)

---

## Modules (opt-in)

TSera is modular. `tsera init` can enable/disable modules depending on your needs:

* **API**: Hono (optional)
* **Frontend**: Lume (optional)
* **Local infra**: Docker Compose (optional)
* **CI**: GitHub Actions workflows (optional)
* **Secrets**: type-safe environment validation (optional)
* **SDK**: type-safe client generation (optional)

---

## Documentation

* [Getting Started](./docs/GETTING_STARTED.md)
* [CLI Reference](./docs/CLI_REFERENCE.md)
* [Recipes](./docs/RECIPES.md)
* [Architecture Notes](./docs/ARCHITECTURE.md)

Online docs: [https://tsera.dev](https://tsera.dev)

---

## Vision

TSera’s goal is simple: **shrink the time between a domain idea and a production-ready implementation**.

Long term, TSera evolves into an industrial environment:

* **TSera Doctor**: prescriptive diagnostics, auto-fix, coherence gates for CI
* **TSera Hub**: coherence metrics, drift tracking, project health dashboards
* **Provider ecosystem**: plug-in generation pipelines (contracts, policies, deployment targets)
* **AI-native workflows**: machine-readable plans and artifacts for agent-driven ops

---

## Community & Contributing

* Join the community: [https://discord.tsera.dev](https://discord.tsera.dev)
* Contribute: [CONTRIBUTING.md](./CONTRIBUTING.md) (DCO required)
* Security reports: [SECURITY.md](./SECURITY.md)
* Code of Conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

---

## License

Licensed under **Apache-2.0** — see [LICENSE](./LICENSE).
Trademark usage is governed by [TRADEMARK_POLICY.md](./TRADEMARK_POLICY.md).
