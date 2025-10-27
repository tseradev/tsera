# TSera

> Full TypeScript · Unification · Simplicité · Automatisation · Cohérence Continue (CC)

TSera vise à proposer un moteur CLI et un noyau d'entités cohérents pour accélérer les projets Deno
v2. Cette itération livre un socle exploitable : définition d'entités, helpers dérivés, structure
CLI et template `app-minimal` de référence.

## État du dépôt

- ✅ Structure de base conforme au guide TSera
- ✅ Configuration Deno (`deno.jsonc`, `import_map.json`)
- ✅ Noyau d'entités (`defineEntity`, helpers Zod/OpenAPI/Drizzle) avec tests unitaires
- ✅ Squelette CLI (router, commandes, moteur interne, contrats)
- ✅ Template `app-minimal` prêt pour itérations ultérieures
- ⏳ Intégration Cliffy, zod-to-openapi, Drizzle runtime et génération d'artefacts réels

## Démarrage rapide

```bash
deno task fmt
deno task lint
deno task test
```

Les tâches `e2e`, `compile` et `publish` seront opérationnelles lorsque les binaires et scripts
correspondants seront livrés.

## Ressources

- [docs/README.md](docs/README.md) — Présentation OSS courte
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Vision DAG & Cohérence Continue
- [templates/app-minimal](templates/app-minimal) — Exemple de squelette applicatif
