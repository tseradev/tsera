# TSera

> Full TypeScript · Unification · Simplicité · Automatisation · Cohérence Continue (CC)

TSera est un moteur CLI et un noyau d'entités pour les projets Deno v2 qui promettent **cohérence
continue** et **livraison automatique** des artefacts (schemas Zod, OpenAPI, migrations Drizzle,
docs, tests) à partir d'un modèle unique. L'objectif est de fournir un outillage Deno-first où
chaque entité décrite reste alignée avec l'application, de la phase `plan` jusqu'à l'`apply` final.

## Promesse produit

1. **Une source unique** (`defineEntity`) décrit le domaine métier.
2. **Un moteur CLI** traduit ce modèle en artefacts prêts à l'emploi (API, migrations, docs, tests).
3. **Une cohérence continue** maintient ces artefacts synchronisés sans effort manuel.

TSera vise à réduire le temps entre une idée d'entité et sa disponibilité dans le code, la base de
données et la documentation partagée avec l'équipe.

## Stack actuelle

- **Deno v2** (ESM strict, tâches via `deno.jsonc`).
- **Cliffy** pour le CLI modulaire (`init`, `dev`, `doctor`, `update`).
- **Zod**, **zod-to-openapi** et **Drizzle** pour projeter les entités.
- **TS-Morph** pour piloter la génération TypeScript.
- **Templates** Hono/Fresh pour bootstraper un projet `app-minimal`.

## Quick start

```bash
# 1. Vérifier/formatter le dépôt
 deno task fmt
# 2. Lancer le linting strict
 deno task lint
# 3. Exécuter la suite de tests
 deno task test
```

Une fois le noyau CLI disponible, les commandes suivantes permettront d'explorer le workflow complet
:

```bash
# Initialiser un nouveau projet
 deno run -A src/cli/main.ts init my-app
# Regénérer les artefacts avec surveillance continue
 deno run -A src/cli/main.ts dev
```

## Documentation

- [Guide architecture détaillé](./docs/ARCHITECTURE.md)
- [Landing communauté & ressources](./docs/README.md)
- [Playbook communication & assets](./docs/COMMUNICATION.md)

## Release & distribution

Les releases officielles suivent la stratégie suivante :

1. Créer un tag `vX.Y.Z` et pousser vers le dépôt distant.
2. Lancer la compilation multi-plateforme :
   ```bash
   deno compile -A --output dist/tsera src/cli/main.ts
   ```
3. Publier les binaires dans la release GitHub.
4. (Optionnel) Publier le module JSR :
   ```bash
   deno publish
   ```

Un script automatisé sera ajouté pour empaqueter et publier simultanément les binaires (Linux,
macOS, Windows) et, si activé, pousser le package `jsr:tsera`.

### Préparer un tag stable

Avant chaque release :

1. Vérifier la cohérence locale :
   ```bash
   deno task fmt && deno task lint && deno task test
   ```
2. Réaliser un cycle `dev` dans un projet d'exemple généré via `tsera init demo`.
3. Mettre à jour les numéros de version dans `deno.jsonc`, `src/cli/main.ts` et la documentation.
4. Rédiger un changelog synthétique (section `## Release vX.Y.Z` dans `docs/COMMUNICATION.md`).
5. Préparer les assets de communication textuels (script de thread, messages prêts à publier) et
   planifier la capture visuelle à venir.

Une fois ces vérifications effectuées, créer le tag `vX.Y.Z` et suivre la procédure ci-dessus.

## Workflow cohérence continue

1. **Observation** — `watch.ts` agrège les changements sur les entités et la config.
2. **Planification** — `planner.ts` calcule les steps (`create`, `update`, `delete`, `noop`).
3. **Application** — `applier.ts` écrit les artefacts avec `safeWrite` et met à jour `.tsera/`.
4. **Rapport** — les sorties `--json` décrivent le statut (`coherence: ok/drift/error`).

Le cycle peut être exécuté manuellement (commande `plan/apply`) ou automatiquement via `tsera dev`.

## Commandes CLI (aperçu)

| Commande               | Description rapide                                                             | Statut      |
| ---------------------- | ------------------------------------------------------------------------------ | ----------- |
| `tsera init <name>`    | Génère `tsera.config.ts`, le template `app-minimal` et la structure `.tsera/`. | 🛠️ En cours |
| `tsera dev [--json]`   | Observe les entités, calcule le plan et applique les artefacts en boucle.      | 🛠️ En cours |
| `tsera doctor [--fix]` | Diagnostique les incohérences, peut réparer automatiquement les cas sûrs.      | 🛠️ En cours |
| `tsera update`         | Met à jour le binaire installé et synchronise les dépendances CLI.             | 🛠️ En cours |

Chaque commande est conçue pour fonctionner en mode interactif (`TUI`) ou machine (`--json`). La
spécification détaillée des options sera ajoutée une fois l'implémentation stabilisée.

## Structure du dépôt

```text
.
├─ src/               # Noyau TypeScript (entités, CLI Cliffy, moteur plan/apply)
├─ templates/         # Projets d'exemple générés par `tsera init`
├─ docs/              # Documentation technique, communication et releases
├─ scripts/           # Automations (E2E, release, utilitaires)
├─ deno.jsonc         # Configuration Deno tasks et lint/formatter
└─ import_map.json    # Alias d'import pour le développement local
```

## Contribuer

1. Forker le dépôt et créer une branche `feat/...` ou `docs/...`.
2. Implémenter la modification en respectant les contraintes décrites dans
   [`AGENTS.md`](./AGENTS.md).
3. Lancer la suite de vérifications locales (`deno task fmt`, `deno task lint`, `deno task test`).
4. Ouvrir une PR avec un titre `[scope] Description concise` et un résumé clair.
5. Documenter toute modification de contrat (CLI, artefacts, config) dans les fichiers pertinents.

Pour toute discussion ou proposition, utiliser les issues GitHub ou contacter l'équipe via les
canaux listés dans `docs/COMMUNICATION.md`.

## Roadmap immédiate

1. Finaliser l'implémentation de `defineEntity` et des helpers Zod/OpenAPI/Drizzle.
2. Stabiliser le moteur CLI et les commandes Cliffy.
3. Fournir le template `app-minimal` complet avec ses artefacts générés.
4. Mettre en place la CI 3 OS (fmt, lint, test, compile) et le pipeline release.
5. Publier un premier binaire expérimental pour retours utilisateurs.
