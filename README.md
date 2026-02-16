# TSera – Full TypeScript monorepo for modern full-stack apps

<p align="center">
  <strong>One domain definition. All artifacts generated. Stack stays aligned.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/build-in%20development-orange.svg" alt="Build status" />
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License" />
</p>

<p align="center">
  <strong>Build and ship full-stack applications:</strong><br/>
  database, API, frontend, docs and deployment workflows — all in TypeScript.
</p>

<p align="center">
  <em>Watch → Plan → Apply. No manual sync steps.</em>
</p>

---

<h3 align="center">🚧 Under active construction.</h3>

<h4 align="center">🎥 Follow the development live on Twitch:<br><a href="https://www.twitch.tv/tseradev">twitch.tv/tseradev</a>
</h4>

---

### 🔗 Resources
- 🌐 **Website & Docs:** https://tsera.dev *(coming soon)* 
- 💬 **Community (Discord):** https://discord.tsera.dev  
- 🤝 **Contributing Guide:** [CONTRIBUTING.md](./CONTRIBUTING.md)  
- 🔐 **Security Policy:** [SECURITY.md](./SECURITY.md)  
- ⚖️ **License:** [LICENSE.md](./LICENSE.md)   

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

Official documentation will be published at https://tsera.dev.

Until then, refer to the source code and the CLI help output.

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
