# Architecture TSera

Cette note décrit l'agencement interne du moteur TSera, le graphe de dépendances (DAG) qui orchestre
la génération d'artefacts et la manière dont la Cohérence Continue (CC) est garantie via les flux
`plan` et `apply`.

## Vue d'ensemble

TSera repose sur un modèle unique : les **entités**. Chaque entité est transformée en plusieurs
artefacts (schemas Zod, documents OpenAPI, migrations SQL, docs Markdown, tests smoke). Le moteur
CLI observe le projet et maintient un état cohérent dans `.tsera/` grâce à un DAG déterministe.

```
     ┌─────────────┐
     │  EntityDef  │
     └──────┬──────┘
            │ defineEntity
            ▼
  ┌─────────────────────┐
  │   DAG root (entity) │
  └──────┬──────┬──────┘
         │      │
 ┌───────▼──┐ ┌─▼────────┐
 │ schema   │ │ openapi  │
 └────┬─────┘ └─────┬────┘
      │             │
┌─────▼──────┐ ┌────▼───────┐
│ migration  │ │ docs/test  │
└────────────┘ └────────────┘
```

Chaque nœud produit un artefact et stocke son hash (contenu + options + version CLI) dans
`.tsera/graph.json`. Le manifest `.tsera/manifest.json` référence les fichiers générés pour
permettre des diff stables.

## Cohérence Continue (CC)

La CC est le principe central de TSera : **chaque modification d'entité doit être propagée
automatiquement**. Pour y parvenir :

1. **Observation** : `watch.ts` écoute les fichiers pertinents (entités, config, templates) et
   regroupe les changements.
2. **Planification** : `planner.ts` compare les hashes actuels avec l'état précédent et calcule une
   liste de `steps` (`create`, `update`, `delete`, `noop`).
3. **Appliance** : `applier.ts` exécute ces steps avec `safeWrite` afin d'écrire uniquement si un
   diff est détecté, assurant des commits propres.
4. **Rapports** : les sorties `--json` permettent de détecter les incohérences dans des pipelines
   automatisés (`coherence` events, exit code 2 en mode `--strict`).

Ce cycle garantit que les artefacts générés, les migrations et les tests sont toujours alignés avec
la source de vérité.

## Flux `plan` et `apply`

Le moteur CLI expose deux phases bien distinctes, même si elles peuvent être enchaînées
automatiquement par `dev` :

1. **Plan**
   - Reconstruit le DAG et calcule les changements requis.
   - Fournit un résumé (`plan:summary`) qui liste pour chaque entité les artefacts affectés.
   - Peut s'exécuter en mode `--json` pour inspection programmatique (CI, dashboards).
2. **Apply**
   - Exécute les steps issus du plan courant.
   - Écrit les fichiers (`*.schema.ts`, `openapi.json`, migrations `drizzle/`, docs/tests) via
     `safeWrite`.
   - Met à jour `.tsera/graph.json` et `.tsera/manifest.json`.

Ces deux flux sont orchestrés par `engine/dag.ts`, `engine/hash.ts`, `engine/planner.ts` et
`engine/applier.ts`. Lorsqu'une commande `dev` est lancée, elle enchaîne les étapes suivantes :

1. `watch:start` (initialisation du watcher).
2. `plan:start` → `plan:summary` (calcul des steps).
3. `apply:step` (application de chaque step) → `apply:done`.
4. `coherence` (statut final : `ok`, `drift`, `error`).

## Gestion des flux multiples

- **`init`** : bootstrappe un projet et génère un `tsera.config.ts` complet. Aucun plan/apply n'est
  exécuté, mais la structure `.tsera/` est préparée.
- **`dev`** : exécute en boucle le duo `plan/apply`. Idéal pour la CC.
- **`doctor`** : inspecte les incohérences. Avec `--fix`, il déclenche `plan/apply` ciblé sur les
  nœuds identifiés.
- **`update`** : gère la mise à jour du binaire et des dépendances (`deno install`, `deno compile`).

## État persistant

- `.tsera/graph.json` : représentation du DAG, des hashes par nœud et des dépendances.
- `.tsera/manifest.json` : inventaire des fichiers générés (chemins, date de mise à jour, hash
  disque).
- `drizzle/` : migrations SQL générées avec timestamps stabilisés.
- `docs/` : documentation dérivée des entités (synchronisée).

Ces éléments permettent de redémarrer un cycle `dev` sans perdre l'historique des artefacts.

## Définition des entités

- Les entités sont décrites via `defineEntity` (`src/core/entity.ts`).
- Chaque entité possède un nom PascalCase, un drapeau `table` (pour migrations) et un dictionnaire
  de colonnes (`TColumn`).
- Les helpers `schema.ts`, `openapi.ts` et `drizzle.ts` transforment ce modèle en artefacts typed.
- Une entité peut activer la génération de documentation (`doc: true`) ou d'un test smoke
  (`test: "smoke"`).

Le template `templates/app-minimal/domain/User.entity.ts` illustre la structure attendue. Pendant
les prochaines itérations, des contraintes supplémentaires (relations, index) seront ajoutées en
restant rétro-compatibles.

## Configuration projet (`tsera.config.ts`)

Le fichier `tsera.config.ts` généré par `tsera init` regroupe :

1. Les entités enregistrées et leur chemin disque.
2. Les paramètres de sortie (`docsDir`, `migrationsDir`, `testsDir`).
3. Les politiques de Cohérence Continue (ex. `requireValidationSchema`).

`src/cli/core/resolve-config.ts` valide ce fichier à l'aide de Zod et produit une structure interne
consommée par le moteur. Toute modification de configuration déclenche un recalcul complet du DAG
pour garantir l'alignement.

## Gestion des erreurs et cohérence

- **Validation** : les erreurs Zod sont agrégées et remontées via `plan:summary` avec un
  `status:
  "error"`.
- **Drift** : lorsqu'un fichier généré est modifié manuellement, son hash diverge et `coherence`
  devient `drift`. En mode `--strict`, le CLI retourne `exit code 2`.
- **Crash safety** : `applier.ts` écrit les fichiers dans un dossier temporaire puis les déplace
  atomiquement pour éviter les artefacts partiels.

Le manifeste `.tsera/manifest.json` conserve les métadonnées nécessaires pour comparer l'état disque
et l'état calculé.

## Interfaces CLI & modes d'exécution

- **TUI** (par défaut) : affiche les étapes en temps réel, les hashes et un résumé final.
- **Mode JSON** (`--json`) : chaque étape émet une ligne NDJSON, parfaite pour des scripts CI/CD.
- **Strict mode** (`--strict`) : n'autorise aucun drift persistant ; utile pour gatekeeper.

Les commandes `plan`/`apply` seront exposées directement dans des versions futures pour faciliter
les pipelines personnalisés. D'ici là, `tsera dev --json` reste le mode recommandé pour
l'intégration continue.
