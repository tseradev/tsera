# TSera (placeholder)

> Full TypeScript · Unification · Simplicité · Automatisation · Cohérence Continue (CC)

TSera vise à proposer un moteur CLI et un noyau d'entités cohérents pour accélérer les projets Deno
v2. Cette première étape se concentre sur la structure du dépôt, la configuration de base et la
documentation de démarrage. Les composants fonctionnels (defineEntity, CLI Cliffy, template
app-minimal) seront livrés dans les itérations suivantes.

## État du dépôt

- ✅ Structure de base conforme au guide TSera
- ✅ Configuration Deno (`deno.jsonc`, `import_map.json`)
- ✅ Documentation initiale et repères pour la communauté
- ⏳ Implémentation du noyau, CLI et artefacts générés

## Démarrage rapide

```bash
deno task fmt
deno task lint
deno task test
```

Les tâches `e2e`, `compile` et `publish` seront opérationnelles lorsque le CLI et les scripts
correspondants seront livrés.

## Prochaines étapes

1. Implémenter `defineEntity` et les helpers (`schema`, `openapi`, `drizzle`).
2. Concevoir le CLI Cliffy (`init`, `dev`, `doctor`, `update`).
3. Fournir le template `app-minimal` complet avec les artefacts générés.
