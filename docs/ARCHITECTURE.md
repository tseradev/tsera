# Architecture TSera (placeholder)

Cette note décrit la vision haut niveau de l'architecture TSera. Les détails d'implémentation seront
ajoutés au fur et à mesure de la livraison du noyau et du CLI.

## Vision

- **Noyau entités** : un modèle déclaratif (`defineEntity`) validé par Zod, converti en schémas,
  migrations Drizzle et artefacts docs/tests.
- **Moteur CLI** : un pipeline `watch → plan → apply` produisant des sorties diff-friendly et
  persistées dans `.tsera/`.
- **Templates** : des projets de démarrage opinionated (`app-minimal`) alignés sur les alias définis
  dans `import_map.json`.

## Composants clés (à implémenter)

1. `src/core/` : helpers TypeScript, Zod, OpenAPI et Drizzle.
2. `src/cli/` : commandes Cliffy (`init`, `dev`, `doctor`, `update`) et moteur interne (DAG, hash,
   planner, applier, watch).
3. `templates/app-minimal/` : exemples concrets de configuration, entités et routes Hono.
4. `docs/` : guides cohérents avec les artefacts générés par le CLI.

Chaque composant suivra les valeurs de TSera : simplicité, cohérence continue et automatisation
complète.
