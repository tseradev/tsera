# Communication & Build-in-Public

Ce document consolide les assets de communication et les routines "build in public" pour les futures
itérations TSera.

## Assets disponibles

| Asset                         | Usage                                                                                    | Emplacement suggéré |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ------------------- |
| Script texte « plan → apply » | Décrire en quelques phrases le déroulé d'une démo (commandes, résultat, call-to-action). | Section ci-dessous  |

### Préparer une future capture visuelle

1. Rédiger ou mettre à jour le script texte ci-après pour guider la prise de vue.
2. Lorsque les fonctionnalités seront prêtes, enregistrer le workflow (ex. `deno task dev` dans
   `app-minimal`).
3. Convertir l'enregistrement en GIF ou vidéo courte si nécessaire et référencer le fichier dans ce
   document.

#### Script texte (brouillon)

> **Intro** — « Lançons `tsera init demo` pour générer un projet complet, config incluse. »
>
> **Plan** — « Le moteur observe nos entités, calcule un plan cohérent et affiche les étapes
> prévues. »
>
> **Apply** — « En appliquant, TSera régénère les schémas Zod, OpenAPI et migrations Drizzle sans
> intervention manuelle. »
>
> **CTA** — « Testez la cohérence continue avec `deno run -A src/cli/main.ts dev --json` et partagez
> vos retours ! »

## Build in public : checklist hebdomadaire

- ✅ Publier un **devlog** (threads X / LinkedIn) avec :
  - Un aperçu du cycle `plan → apply` (capturé via `--json`).
  - Le statut de la roadmap (cases cochées).
- ✅ Partager un **changelog visuel** (GIF ou capture) montrant les artefacts générés.
- ✅ Ouvrir une discussion sur la prochaine itération (issues GitHub + sondage communauté).
- ✅ Archiver les retours dans `docs/COMMUNITY.md` (à créer) pour les priorisations futures.

## Ton & message

- Mettre en avant la promesse **Cohérence Continue**.
- Souligner la simplicité : Deno v2, TypeScript strict, zéro dépendance Node.
- Inviter les early adopters à tester `tsera init`/`tsera dev` dès qu'ils seront disponibles.

## Cadence de publication

| Moment   | Canal principal             | Contenu clé                                                    |
| -------- | --------------------------- | -------------------------------------------------------------- |
| Lundi    | Newsletter courte / Discord | Roadmap de la semaine, appel à contribution.                   |
| Mercredi | Thread X / LinkedIn         | Zoom sur une fonctionnalité (`plan/apply`, templates, etc.).   |
| Vendredi | Devlog + GIF                | Résumé des progrès, métriques de cohérence, prochaines étapes. |

Les publications doivent renvoyer vers les issues GitHub correspondantes pour encourager les
contributions externes.

## Gabarit de changelog public

```markdown
## Release vX.Y.Z

- ✨ Nouveautés :
  - ...
- 🛠️ Améliorations :
  - ...
- 🧪 Qualité :
  - ...

👉 Télécharger le binaire : <lien> 👉 Documentation mise à jour : <lien>
```

Copier ce bloc dans `docs/COMMUNICATION.md` et dans la description de release GitHub.

## Mesure de l'impact

- **KPI produit** : nombre de projets générés via `tsera init`, temps moyen `plan → apply`.
- **KPI communication** : taux d'engagement des threads, clics sur le README, inscriptions
  newsletter.
- **Feedback loop** : synthétiser les retours dans une issue mensuelle et ajuster la roadmap.
