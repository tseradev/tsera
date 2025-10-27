# Template "app-minimal"

Ce squelette fournit une application Deno ultra-minimale basée sur [Hono](https://hono.dev/) et une
entité `User` définie avec TSera. Il est pensé comme point de départ pour `tsera init`.

## Prérequis

- Deno v2 (`deno --version`)
- Accès au module `tsera` publié sur JSR ou lien local via import map (voir ci-dessous)

## Installation

1. Clonez ou copiez ce dossier dans votre projet cible.
2. Vérifiez/éditez `import_map.json` si vous développez en local contre le dépôt TSera (par exemple
   en pointant `"tsera/"` vers `../src/`).
3. (Optionnel) Installez les dépendances Fresh si vous souhaitez activer le dossier `web/`.

## Démarrage rapide

```bash
# Lancer l'API Hono
deno task dev

# Lancer les vérifications
deno task fmt
deno task lint
deno task test
```

L'API expose un endpoint `GET /health` retournant un JSON `{ "status": "ok" }`.

## Entités TSera

L'entité `User` située dans `domain/User.entity.ts` montre comment utiliser `defineEntity` pour
déclarer une table persistée et documenter les colonnes. Vous pouvez enrichir cette entité ou en
créer de nouvelles dans le même dossier.

## Structure Fresh optionnelle (`web/`)

Le dossier `web/` contient les bases pour brancher Fresh. Les fichiers sont volontairement réduits à
des TODOs explicites : installez Fresh (`deno run -A -r jsr:@fresh/init`) puis remplacez les
placeholders.

## Aller plus loin

- Ajoutez des routes Hono supplémentaires dans `routes/`.
- Synchronisez les entités via `tsera dev` pour générer schémas, migrations et documentation.
- Remplacez l'alias `tsera/` par `jsr:tsera/` une fois le module publié.

Bonne expérimentation !
