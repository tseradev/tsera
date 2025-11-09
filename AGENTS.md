# AGENTS — Guide pour TSera (Deno v2 + Cliffy)

> **But** : ¨Plan **actionnable** pour créer et livrer **tout TSera côté OSS** dans **un seul
> dépôt**.
>
> **Scope** : Cible **Deno v2**, **full TypeScript**, publication binaire via `deno compile` et
> (optionnel) module JSR unique.
>
> **Valeurs** : _Full TypeScript · Unification · Simplicité · Automatisation · Cohérence Continue
> (CC)_.

---

## 0) TL;DR (ordre recommandé)

1. **Structure repo + tasks + CI** → 2) **Noyau “entités”** (`defineEntity` + helpers
   Zod/OpenAPI/Drizzle) → 3) **CLI Cliffy** (4 commandes) → 4) **Templates modulaires (base +
   modules)** → 5) **Tests (unit/golden/E2E)** → 6) **Release binaire + (optionnel) JSR**.

- Implémente **4 commandes**: `init`, `dev`, `doctor`, `update` (Cliffy).
- `init` génère **toujours** `tsera.config.ts` **complet** (profil _full_ + commentaires) et compose
  le projet à partir de `templates/base` + modules sélectionnés.
- `dev` = **watch → plan → apply** idempotent: Zod, OpenAPI, migrations Drizzle, docs, tests smoke,
  `.tsera/graph.json`, `.tsera/manifest.json`.
- `doctor --fix` corrige les cas sûrs; `update` gère `deno install` **et** binaire `deno compile`.
- **Dépendances autorisées** seulement: Deno std, Cliffy, Zod v4 (JSR), TS‑Morph, Hono, Fresh.

---

## 1) Arborescence du repo (unique)

```
/                         # racine du monorepo unique
  deno.jsonc              # tasks: fmt, lint, test, e2e, compile, publish (optionnel)
  import_map.json         # alias dev vers src/*
  .github/workflows/
    ci.yml                # fmt/lint/test/compile (3 OS)
    release.yml           # release binaire (+ publish JSR optionnel) sur tag
  src/
    core/                 # noyau: entités + helpers
      index.ts
      entity.ts           # defineEntity + types
      schema.ts           # helpers Zod
      drizzle.ts          # mapping entité → DDL SQL
      openapi.ts          # génération OpenAPI depuis entités
      secrets.ts          # gestion secrets type-safe
      secrets/
        store.ts          # store KV chiffré
        store.test.ts
      tests/              # tests unitaires du core
      utils/
        object.ts
        strings.ts
        zod.ts
        tests/
    cli/                  # CLI (Cliffy) + moteur
      main.ts
      router.ts
      router.test.ts
      definitions.ts      # TseraConfig/DbConfig/DeployTarget
      commands/
        init/             # init command + utils
          init.ts
          init-ui.ts
          init.test.ts
          __golden__/      # golden files for tests
            openapi.json
            tsera.config.ts
          utils/           # config-generator, env-generator, file-ops, template-composer
            config-generator.ts
            env-generator.ts
            file-ops.ts
            template-composer.ts
        dev/               # dev command
          dev.ts
          dev-ui.ts
          dev.test.ts
        doctor/            # doctor command
          doctor.ts
          doctor-ui.ts
          doctor.test.ts
        update/            # update command
          update.ts
          update-ui.ts
          update.test.ts
        help/              # help command
          help.ts
          command-help-renderer.ts
          formatters.ts
          renderer.ts
          types.ts
          help.test.ts
      engine/              # moteur de génération
        dag.ts
        hash.ts
        planner.ts
        applier.ts
        watch.ts
        state.ts
        entities.ts
        tests/             # tests du moteur
        artifacts/         # générateurs d'artefacts
          openapi.ts
          zod.ts
          drizzle.ts
          docs.ts
          tests.ts
          types.ts
          tests/           # tests des artefacts
      ui/                  # UI components (console, colors, terminal, etc.)
        console.ts
        colors.ts
        terminal.ts
        formatters.ts
        palette.ts
        spinner.ts
        text-utils.ts
        types.ts
        tests/
      utils/               # utilitaires CLI
        resolve-config.ts
        project.ts
        fsx.ts
        log.ts
        ts-morph.ts
        version.ts
        tests/
    shared/                # utilitaires partagés
      path.ts
      newline.ts
      file-url.ts
  templates/
    base/                 # Template de base (toujours inclus)
      deno.jsonc
      import_map.json
      .gitignore
      README.md
      domain/User.entity.ts
      test-utils/asserts.ts
    modules/
      hono/               # Module API (optionnel, --no-hono)
        main.ts
        routes/health.ts
        deps/hono.ts
        tests/health.test.ts
      fresh/              # Module Frontend (optionnel, --no-fresh)
        deps/
          preact.ts       # Centralisation version Preact
        web/
          main.ts         # Fresh app entry
          routes/index.tsx
          islands/Counter.tsx
          static/styles.css
      docker/             # Module Docker (optionnel, --no-docker)
        docker-compose.yml
        Dockerfile
        .dockerignore      # fichiers exclus du build Docker
      ci/                 # Module CI/CD (optionnel, --no-ci)
        .github/workflows/ci.yml
        .github/workflows/deploy.yml
      secrets/            # Module Secrets (optionnel, --no-secrets)
        env.config.ts
        lib/env.ts
        lib/env.test.ts
  .editorconfig
  LICENSE (Apache-2.0)
  README.md              # landing principale
  AGENTS.md              # ce fichier
```

> **Note** : les imports en dev pointent `import_map.json` vers `./src/**`. Pour la publication JSR
> (facultative), nommer le module `tsera` et exposer `./src/core/index.ts` + binaire CLI.

---

## 2) Contraintes non négociables

- **Deno v2**, ESM only, TS `strict`. **Aucun Node/npm/pnpm** sauf pour les dépendances non
  disponibles sur JSR (Preact).
- Dépendances autorisées : Deno std (`@std/path`, `@std/fs`, `@std/assert`), **Cliffy** (JSR), **Zod
  v4** (JSR: `jsr:@zod/zod@^4.0.0`), **TS‑Morph** (JSR), **Hono**, **Fresh** (SSR + islands via
  JSR), **Preact** (via npm, utilisé par Fresh).
- **Pas de polyfills**. Les dépendances doivent être utilisées directement. Si une dépendance n'est
  pas disponible, le code doit échouer de manière explicite (pas de fallback silencieux).
- **Pas de MCP**. **Pas d'HTTP** dans le CLI.
- **Écritures bornées** : `.tsera/`, `drizzle/`, `docs/`, tests générés. `safeWrite` only (écrit si
  diff).
- Sorties **diff‑friendly** (tri des clés JSON), logs **courts et prescriptives**.

---

## 3) Noyau “entités” (API publique minimale)

```ts
// src/core/entity.ts
export type TPrimitive = "string" | "number" | "boolean" | "date" | "json";
export type TColumn = {
  type: TPrimitive | { arrayOf: TPrimitive };
  optional?: boolean;
  nullable?: boolean;
  default?: unknown;
  description?: string;
};
export interface EntitySpec {
  name: string; // PascalCase unique
  table?: boolean; // si true → migrations
  columns: Record<string, TColumn>;
  doc?: boolean; // docs markdown
  test?: "smoke" | false; // test minimal
}
export type EntityDef = Readonly<EntitySpec> & { __brand: "TSeraEntity" };
export function defineEntity(spec: EntitySpec): EntityDef {/* zod runtime + freeze */}
```

**Helpers**

- `src/core/schema.ts` : `entityToZod(entity): z.ZodObject<...>`
- `src/core/openapi.ts` : `generateOpenAPIDocument(entities, { title, version })`
- `src/core/drizzle.ts` : `entityToDDL(entity, dialect)` → SQL `CREATE TABLE` / `ALTER` minimal (MVP
  mapping : `string→TEXT/VARCHAR`, `number→INTEGER`, `boolean→BOOLEAN`, `date→TIMESTAMP`,
  `json/array→JSONB`/PG par défaut).

**Exemple usage (template)**

```ts
// templates/base/domain/User.entity.ts
import { defineEntity } from "jsr:tsera/core"; // via import_map.json en dev
export default defineEntity({
  name: "User",
  table: true,
  columns: {
    id: { type: "string" },
    email: { type: "string" },
    createdAt: { type: "date" },
  },
  doc: true,
  test: "smoke",
});
```

---

## 4) CLI (Cliffy) — surface & moteur

### 4.1 Commandes

#### Options globales (toutes les commandes)

- `--json` : Active la sortie NDJSON pour l'intégration automatisée
- `-h, --help` : Affiche l'aide de la commande
- `-V, --version` : Affiche la version du CLI

#### `tsera` (sans argument)

Affiche le help global avec la liste des commandes disponibles.

#### `tsera init [directory]`

Compose un projet TSera à partir du template de base et des modules sélectionnés. Crée `deno.jsonc`,
`.gitignore`, `README.md`, **écrit** `tsera.config.ts` **complet** (profil _full_ commenté).

**Modules inclus par défaut** : Hono (API), Fresh (frontend), Docker, CI/CD, Secrets.

**Options :**

- `[directory]` : Répertoire cible (défaut: `.`)
- `--template <name>` : Template de base à utiliser (défaut: `base`)
- `--no-hono` : Exclut le module API Hono
- `--no-fresh` : Exclut le module frontend Fresh
- `--no-docker` : Exclut le module Docker Compose
- `--no-ci` : Exclut le module CI/CD GitHub Actions
- `--no-secrets` : Exclut le module de gestion des secrets type-safe
- `-f, --force` : Écrase les fichiers existants
- `-y, --yes` : Répond automatiquement "oui" aux prompts (mode non-interactif)

#### `tsera dev [projectDir]`

**Watch** (`Deno.watchFs`) sur entités/config ; calcule **plan (diff)** → **apply** idempotent.

**Options :**

- `[projectDir]` : Répertoire du projet (défaut: `.`)
- `--no-watch` : Désactive le file watcher (activé par défaut)
- `--plan-only` : Calcule le plan sans appliquer (implique `--no-watch`)
- `--apply` : Force l'application même si le plan est vide

#### `tsera doctor [--cwd <path>]`

Vérifications (Deno v2, FS, entités importables, DB/env, format artefacts). Détecte les
incohérences.

**Options :**

- `--cwd <path>` : Répertoire du projet à diagnostiquer (défaut: `.`)
- `--fix` : Applique automatiquement les corrections sûres (régénère les artefacts)

#### `tsera update`

Met à jour l'outil (install vs binaire `deno compile`).

**Options :**

- `--channel <channel>` : Canal de release (`stable`|`beta`|`canary`, défaut: `stable`)
- `--binary` : Installe le binaire compilé au lieu de `deno install`
- `--dry-run` : Affiche les étapes sans les appliquer

### 4.2 Config obligatoire (toujours générée par `init`)

```ts
// src/cli/definitions.ts
export type DbConfig =
  | {
    dialect: "postgres";
    urlEnv: string;
    ssl?: "disable" | "prefer" | "require";
    file?: undefined;
  }
  | { dialect: "mysql"; urlEnv: string; ssl?: boolean; file?: undefined }
  | { dialect: "sqlite"; urlEnv?: string; file: string; ssl?: undefined };
export type DeployTarget = "deno_deploy" | "cloudflare" | "node_pm2";
export interface TseraConfig {
  openapi: boolean;
  docs: boolean;
  tests: boolean;
  telemetry: boolean;
  outDir: string;
  paths: { entities: string[]; routes?: string[] };
  db: DbConfig;
  deploy: { target: DeployTarget; entry: string; envFile?: string };
}
```

**Gabarit `tsera.config.ts`** : profil _full_ + commentaires 1‑ligne (identique au brief du projet).

### 4.3 Moteur interne

- **DAG** (`src/cli/engine/dag.ts`) : nœuds `entity`, `schema`, `openapi`, `migration`, `test`,
  `doc` ; edges dérivées.
- **Hash** (`engine/hash.ts`) : SHA‑256(contenu + options + version CLI).
- **Planner** (`engine/planner.ts`) : compare hash courant vs state précédent → `steps[]`
  (`create|update|delete|noop`) + `summary`.
- **Applier** (`engine/applier.ts`) : applique steps ; `safeWrite` (écrit **uniquement si diff**),
  ordre stable.
- **Watch** (`engine/watch.ts`) : `Deno.watchFs` + debounce (≈150 ms), ignore `.tsera/**`.
- **State** (`engine/state.ts`) : `.tsera/graph.json` & `.tsera/manifest.json`.

### 4.4 Artefacts générés

- **Zod** → `*.schema.ts` (miroir entités, sous‑ensemble MVP).
- **OpenAPI** → `openapi.json` (via zod‑to‑openapi ; tags/paths minimaux si `routes` présents).
- **Migrations** → `drizzle/YYYYMMDDHHMM_ssssss_desc.sql`.
- **Tests smoke** → parse Zod + snapshot minimal.
- **Docs** → Markdown synthétique par entité (props/types/exemples).

### 4.5 Sortie machine & modes

- `--json` : NDJSON (`watch:start`, `plan:start`, `plan:summary`, `apply:step`, `apply:done`,
  `coherence`, `error`).

### 4.6 Packaging

- **Binaire** via `deno compile` pour 3 OS (upload en Release).
- **JSR (optionnel)** : exposer `src/core/index.ts` + binaire CLI ; nom unique `tsera`.

---

## 5) Template app‑minimal

- Projet Deno minimal avec **Hono** (API `/health`), **Fresh** (frontend SSR avec islands), une
  entité `User`, `tsera.config.ts` complet, `deno.jsonc`, `import_map.json`, README court.
- Dossier `web/` (Fresh) pour le frontend SSR avec architecture islands.
- Page racine affichant le component Fresh avec partage direct des types backend/frontend.
- **Fresh est inclus par défaut** et peut être désactivé via `--no-fresh` lors de l'init.

---

## 6) Dev environment tips (Deno‑first)

- **Exiger Deno v2** (`deno --version`) ; MAJ : `deno upgrade`.
- **ESM only**, TS `strict`; zéro `any` implicite.
- **JSR imports** (`jsr:@std/...`) ; en dev, utiliser `import_map.json`.
- **Run CLI** : `deno run -A src/cli/main.ts --help`.
- **Cache/lock** : `deno cache --lock=deno.lock --lock-write src/cli/main.ts`.
- **Non‑interactif CI** : `DENO_NO_PROMPT=1`.

---

## 7) Tasks Deno (racine `deno.jsonc`)

```jsonc
{
  "tasks": {
    "fmt": "deno fmt",
    "lint": "deno lint",
    "test": "deno test -A --unstable-kv",
    "e2e": "deno test -A --unstable-kv e2e.test.ts",
    "compile": "deno compile -A --output dist/tsera src/cli/main.ts",
    "publish": "deno publish" // optionnel si JSR
  }
}
```

---

## 8) Tests & Qualité

- **Unit** : noyau (defineEntity + helpers), CLI (resolve-config, DAG hash/diff, parser Cliffy).
- **Golden** : snapshot exact du `tsera.config.ts` généré + `openapi.json` trié.
- **E2E** : `e2e.test.ts` :

  1. crée un tmp dir → `tsera init demo` → `cd demo` → `tsera dev --json` (1 cycle),
  2. vérifie artefacts (`.tsera/openapi.json`, `drizzle/**`, docs, tests),
  3. modifie `User.entity.ts` → attend regen → vérifie **plan**/**apply**.
- **Lint/format** : `deno lint` + `deno fmt`; JSON stable.

---

## 9) CI/CD (GitHub Actions)

- **ci.yml** : jobs `fmt`, `lint`, `test`, `compile` (ubuntu/macos/windows).
- **release.yml** : sur tag `v*` : compile binaires et upload; (optionnel) `deno publish` du module
  `tsera`.

---

## 10) PR & Conventions

- **Commits** : Conventional Commits (`feat(cli): …`, `feat(core): …`, `fix(applier): …`,
  `test(e2e): …`).
- **PR title** : `[cli]` / `[core]` / `[repo]` + titre.
- **Avant merge** : `deno task fmt && deno task lint && deno task test` ; E2E vert.
- **Docs** : si changement de contrat (flags CLI, artefacts) → maj `README.md`, `AGENTS.md`, tests.

---

## 11) Sécurité & DX

- Pas d’I/O hors racine projet; watcher ignore `.tsera/**`.
- Masquer les secrets issus de `.env` dans les logs.
- Messages **courts**, **actionnables** (verbe à l’infinitif + résultat). Pas de prompts bloquants.

---

## 12) Roadmap (post‑MVP)

1. Types enrichis (enums, relations, index/unique) → migrations plus riches.
2. Détection de routes (Hono/Fresh) avancée → OpenAPI plus complet avec partage de types.
3. **Policies CC** (ex. `requireValidationSchema`, `forbidUntypedQuery`) + blocages configurables.
4. Observabilité : export métriques (temps d'incohérence) ; badge public.
5. Providers optionnels (GraphQL/gRPC/RBAC) **hors cœur**.
6. **MCP** (plus tard) : interface agents ; **non inclus** ici.
7. **Fresh islands avancées** : hydratation sélective, partage d'état backend/frontend type-safe.

---

## 13) Definition of Done

- [ ] **Structure** repo conforme + tasks + CI opérationnelle.
- [ ] **Noyau** entités + helpers (zod/openapi/drizzle) testés et prêts à l’usage.
- [ ] **CLI** : 4 commandes stables; `init` écrit `tsera.config.ts` _full_; `dev` maintient les
      artefacts; `doctor --fix` et `update` OK.
- [ ] **Template** base + modules (Hono, Fresh, Docker, CI, Secrets) fonctionnels; `tsera dev`
      régénère bien; `--no-*` flags opérationnels.
- [ ] **Tests** unit + golden + e2e verts en CI 3 OS.
- [ ] **Release** : tags → binaires (et JSR optionnel); README à jour.
