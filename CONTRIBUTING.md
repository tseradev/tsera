# Contributing to TSera

> First off, thanks for taking the time to contribute — TSera lives by the community 🩵

TSera is a full‑stack, DX‑first framework built on **Deno**, **Hono**, **Fresh**, **Zod** and
**Drizzle** — 100% TypeScript. This guide explains how we work together so your contribution lands
fast and safely.

## Why these guidelines?

Following them shows respect for everyone’s time. In return, maintainers will reciprocate with
timely triage, clear feedback, and help to land your Pull Requests (PRs).

**We welcome many kinds of contributions**: docs, examples, bug reports, feature proposals, test
coverage, DX improvements, and code.

**We do not use issues for user support.** Please use our **Discord** for questions. If you’re
unsure whether something is a bug, start a discussion first and we’ll help you triage it.

## Ground rules

- **Be kind and constructive.** We follow our [Code of Conduct](CODE_OF_CONDUCT.md). Report
  unacceptable behavior to [conduct@tsera.dev](mailto:conduct@tsera.dev) or privately to the Discord
  moderation team (@Moderator / @Admin) via DM.
- **Keep it simple.** Fewer abstractions, fewer dependencies. Prefer functions over classes unless
  clear value.
- **Type safety first.** No `any` unless absolutely necessary and documented.
- **Tests are required** for non‑trivial changes. Aim for fast, deterministic tests.
- **Cross‑platform.** Changes must work on macOS, Linux and Windows.
- **Discuss major changes** via an issue or RFC before coding.
- **No breaking changes** without an RFC, maintainer approval (≥2), and a migration note.

## Your first contribution

New here? Start with labels `good first issue` and `help wanted`. If you don’t find a match, open a
Discussion describing what you’d like to try — we’ll point you to a small, impactful task.

**Helpful resources for first‑timers:**

- https://makeapullrequest.com/
- https://www.firsttimersonly.com/

## Getting started (repo, setup, workflow)

### 1) Legal: DCO sign‑off (no CLA)

➡️ TSera uses the **Developer Certificate of Origin (DCO)** and enforces it in CI.

Sign each commit with:

```bash
git commit -s -m "feat: ..."
```

The `-s` adds a `Signed-off-by: Your Name <email>` line stating you have the right to contribute the
code under Apache‑2.0.

> The full text of the DCO is available in the [DCO file](DCO) at the repository root.

### 2) Prerequisites

- **Deno ≥ 2.x** installed
- Git

### 3) Install & run

```bash
# clone
git clone https://github.com/tseradev/tsera.git
cd tsera

# format & lint
deno fmt && deno lint

# run tests
deno test -A

# start local dev (example)
deno task dev
```

The repository includes `deno.json` tasks for `dev`, `test`, `lint`, `fmt` and more. Check scripts
before adding new tooling.

### 4) Submitting a PR

1. Create a branch from `main`: `feat/…`, `fix/…` or `docs/…`.
2. Keep PRs small and focused.
3. Add tests and docs when applicable.
4. Ensure CI passes (lint, fmt, test).
5. Fill the PR template checklist and describe _why_ + _how_.

## “Obvious fix” policy

Small changes that don’t alter behavior (typos, comments, whitespace, docs, renames) are welcome
without opening an issue first. Still **sign your commits** (DCO) and let CI run.

## How to report a bug

### Security first

**Do NOT open a public issue for security problems.**\
Follow instructions here : [SECURITY.md](SECURITY.md)

### Filing a normal bug

Open a GitHub issue and include this template:

```
### What happened?

### What did you expect to happen instead?

### Steps to reproduce
1.
2.
3.

### Environment
- TSera version:
- Deno version:
- OS:
- Logs / stack traces (if any):
```

## Suggesting a feature or enhancement

Before coding, open an issue describing **why** the feature is needed, **how** it fits TSera’s
values (Full TS, Unification, Simplicity, Automation), and a **minimal API sketch**. We prefer
incremental, opt‑in additions with clear migration paths and tests.

## Code review process

- Maintainers triage issues and PRs continuously; initial feedback target: **≤ 5 business days**.
- Reviews focus on correctness, DX, simplicity, and long‑term maintenance.
- After requested changes, please update your PR within **14 days** or we may close it to keep the
  queue healthy (you can always reopen).
- Commit access is invitation‑only after sustained, high‑quality contributions and constructive
  community behavior.

> Contributing does not create any obligation for maintainers to merge, release, or support your
> contribution. All contributions are reviewed at the maintainers’ discretion.

## Style, testing & conventions

### TypeScript & Deno

- **Formatting:** `deno fmt` (no custom prettier).
- **Linting:** `deno lint` (no custom linter, no `any` unless documented with rationale).
- **Imports:** prefer `jsr:` packages when available; otherwise use ESM URLs via the project import
  map.
- **Naming:** files `kebab-case.ts`, exported symbols `camelCase`, types/interfaces `PascalCase`.
- **Public APIs:** keep them small and documented with TSDoc (`/** … */`).

### Tests

- Use `deno test` with the standard library asserts.
- Keep tests **fast** and **hermetic**. Prefer in‑memory fakes over external services.
- Add regression tests for every bug fix.

### Commits — Conventional Commits

Use the format:

```
<type>(scope): short summary

body (why, what, how)

BREAKING CHANGE: description
```

Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

### Labels (issues & PRs)

- `type: bug`, `type: feature`, `type: docs`
- `status: needs triage`, `status: help wanted`, `good first issue`
- `prio: high | medium | low`

## Licensing & patents (quick note)

By contributing, you agree that your code is licensed under **Apache‑2.0**. You also grant the
community the **patent license** defined by Apache‑2.0 for your contributions. See `LICENSE` for
exact terms. If you cannot grant these rights, please refrain from submitting a contribution.

**Trademarks:** “TSera” and the TSera logo are claimed trademarks of **Aurélien Altarriba**. The
Apache‑2.0 license does **not** grant rights to use the name or logo. See our
[Trademark Policy](TRADEMARK_POLICY.md).

## PR checklist (copy into your description)

```
- [ ] I read the **Contributing Guide** and the **Code of Conduct**
- [ ] My branch is up to date with `main`
- [ ] Lint/format/test pass locally (`deno fmt`, `deno lint`, `deno test -A`)
- [ ] I added/updated tests
- [ ] I updated docs / TSDoc / examples if needed
- [ ] My commits are **Conventional Commits** and **DCO‑signed** (`-s`)
```

### **Thanks again** — let’s keep TSera simple, unified and automated. 🚀
