<h1 align="center">TSera – TypeScript engine for modern full-stack apps</h1>

<p align="center">
  <strong>One domain definition. All artifacts generated. Stack stays aligned.</strong>
</p>

<p align="center">
  <a href="https://github.com/tseradev/tsera/actions/workflows/ci.yml">
    <img src="https://github.com/tseradev/tsera/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" />
  </a>
  <a href="https://github.com/tseradev/tsera/actions/workflows/github-code-scanning/codeql">
    <img src="https://github.com/tseradev/tsera/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main" alt="CodeQL" />
  </a>
  <img src="https://img.shields.io/badge/build-in%20development-orange.svg" alt="Build status" />
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License" />
</p>

<p align="center">
  <strong>Build and ship full-stack applications:</strong><br/>
  schemas, database, API, frontend, docs, CI/CD — all in TypeScript.
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

- 🌐 **Website & Docs:** https://tsera.dev _(coming soon)_
- 💬 **Community (Discord):** https://discord.tsera.dev
- 🤝 **Contributing Guide:** [CONTRIBUTING.md](./CONTRIBUTING.md)
- 🔐 **Security Policy:** [SECURITY.md](./SECURITY.md)
- ⚖️ **License:** [LICENSE](./LICENSE)

---

## What is TSera?

TSera is a **Deno v2 CLI engine + entity core** that turns a single domain definition into
**coherent, ready-to-use artifacts** — continuously.

---

## Why TSera?

Modern full-stack work is repetitive and fragile:

- You define an entity… then rewrite it in validation, OpenAPI, SQL migrations, docs, tests.
- Things drift out of sync.
- “Just one change” becomes a cascade of manual updates.

**TSera solves this by enforcing Continuous Coherence (CC):** once an entity is declared, TSera
keeps every derived artifact aligned from `plan` to `apply` — without manual sync steps.

---

## How it works

1. **One source of truth**: `defineEntity(...)` describes the domain model once.
2. **Plan**: TSera computes what must change (diff-based).
3. **Apply**: TSera generates/updates only the necessary artifacts.

**Generated artifacts (examples):**

- Zod schemas
- OpenAPI definitions
- Drizzle migrations
- Docs (Markdown)
- Tests (smoke/regressions)
- Optional type-safe SDK for front/back integration

---

## Quickstart (3 commands)

> Until official releases exist, install from source.

```bash
git clone https://github.com/tseradev/tsera.git && cd tsera
deno i && deno run tsera init demo
cd demo && deno run dev
```

Having trouble with the installation? Try this in the CLI folder :

```bash
deno install --global --config deno.jsonc -A -f --name tsera src/cli/main.ts
```

---

## Entities

You can find the entities here in a TSera project : `core/entities/`

# Launch the TSera project

```bash
deno run dev
```

TSera will **plan → apply** and (depending on enabled modules) generate artifacts such as:

- `schemas/*.schema.ts` (Zod validation)
- `docs/openapi/openapi.json` (OpenAPI)
- `drizzle/*` (migrations)
- `docs/entities/*.md` (documentation)
- `tests/*` (smoke/regression scaffolding) _(soon)_

---

## Modules (opt-in)

TSera is modular. `deno run tsera init` can enable/disable modules depending on your needs:

- **API**: Hono (optional)
- **Frontend**: Lume (optional)
- **Local infra**: Docker Compose (optional)
- **CI**: GitHub Actions workflows (optional)
- **Secrets**: type-safe environment validation (optional)
- **SDK**: type-safe client generation (optional)

Type `deno run tsera init -h` to see the possible options.

---

## Documentation

Official documentation will be published at https://tsera.dev.

Until then, refer to the source code and the CLI help output.

---

## Vision

TSera’s goal is simple: **shrink the time between a domain idea and a production-ready
implementation**.

Long term, TSera evolves into an industrial environment:

- **TSera Doctor**: prescriptive diagnostics, auto-fix, coherence gates for CI
- **TSera Hub**: coherence metrics, drift tracking, project health dashboards
- **Provider ecosystem**: plug-in generation pipelines (contracts, policies, deployment targets)
- **AI-native workflows**: machine-readable plans and artifacts for agent-driven ops

---

## Community & Contributing

- Join the community: [https://discord.tsera.dev](https://discord.tsera.dev)
- Contribute: [CONTRIBUTING.md](./CONTRIBUTING.md) (DCO required)
- Security reports: [SECURITY.md](./SECURITY.md)
- Code of Conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

---

## License

Licensed under **Apache-2.0** — see [LICENSE](./LICENSE). Trademark usage is governed by
[TRADEMARK_POLICY.md](./TRADEMARK_POLICY.md).
