# Communication & build-in-public

This document consolidates communication assets and "build in public" routines for future TSera
iterations.

## Available assets

| Asset                      | Purpose                                                                 | Suggested location |
| -------------------------- | ----------------------------------------------------------------------- | ------------------ |
| "Plan → apply" text script | Describe a demo in a few sentences (commands, outcome, call-to-action). | Section below      |

### Preparing a future visual capture

1. Draft or update the text script below to guide the recording session.
2. When the features are ready, capture the workflow (e.g. `deno task dev` inside `app-minimal`).
3. Convert the recording to a GIF or short video if needed and reference the file in this document.

#### Text script (draft)

> **Intro** — "Let's run `tsera init demo` to generate a complete project, configuration included."
>
> **Plan** — "The engine watches our entities, computes a coherent plan, and lists the expected
> steps."
>
> **Apply** — "By applying, TSera regenerates Zod schemas, OpenAPI, and Drizzle migrations without
> manual work."
>
> **CTA** — "Try continuous coherence with `deno run -A src/cli/main.ts dev --json` and share your
> feedback!"

## Build in public: weekly checklist

- ✅ Publish a **devlog** (X thread / LinkedIn) featuring:
  - A glimpse of the `plan → apply` cycle (captured with `--json`).
  - The current roadmap status (checked boxes).
- ✅ Share a **visual changelog** (GIF or screenshot) showing the generated artifacts.
- ✅ Start a discussion about the next iteration (GitHub issues + community poll).
- ✅ Archive feedback in `docs/COMMUNITY.md` (to create) for future prioritization.

## Tone & messaging

- Highlight the **Continuous Coherence** promise.
- Emphasize simplicity: Deno v2, strict TypeScript, zero Node dependencies.
- Invite early adopters to try `tsera init` / `tsera dev` as soon as they land.

## Publication cadence

| When      | Main channel               | Key content                                         |
| --------- | -------------------------- | --------------------------------------------------- |
| Monday    | Short newsletter / Discord | Weekly roadmap, call for contributions.             |
| Wednesday | X thread / LinkedIn        | Focus on a feature (`plan/apply`, templates, etc.). |
| Friday    | Devlog + GIF               | Progress recap, coherence metrics, upcoming steps.  |

Posts should link back to the relevant GitHub issues to encourage contributions.

## Public changelog template

```markdown
## Release vX.Y.Z

- ✨ Highlights:
  - ...
- 🛠️ Improvements:
  - ...
- 🧪 Quality:
  - ...

👉 Download the binary: <link> 👉 Updated documentation: <link>
```

Copy this block into `docs/COMMUNICATION.md` and the GitHub release description.

## Measuring impact

- **Product KPIs**: number of projects generated via `tsera init`, average `plan → apply` duration.
- **Communication KPIs**: engagement rate on threads, README clicks, newsletter sign-ups.
- **Feedback loop**: summarize the feedback in a monthly issue and adjust the roadmap accordingly.
