// Configuration TSera (profil full avec commentaires).
import type { TseraConfig } from "tsera/cli/contracts/types.ts";

const config: TseraConfig = {
  // Nom lisible du projet (utilisé dans les artefacts et la documentation).
  projectName: "DemoApp",
  // Racine du projet. Laisser "." sauf cas très avancés.
  rootDir: ".",
  // Dossier contenant les entités TSera (fichiers *.entity.ts).
  entitiesDir: "domain",
  // Dossier des artefacts générés (schémas, docs, openapi, tests...).
  artifactsDir: ".tsera",
  // Optionnel : liste explicite d'entités à charger au lieu du scan récursif.
  // entities: ["domain/User.entity.ts"],
  db: {
    // Dialecte cible pour les migrations Drizzle (postgres | sqlite).
    dialect: "postgres",
    // Chaîne de connexion utilisée par les tests et le runtime local.
    connectionString: "postgres://localhost/demoapp",
    // Dossier des migrations générées.
    migrationsDir: "drizzle",
    // Dossier des schémas Drizzle (généré automatiquement).
    schemaDir: "drizzle/schema",
  },
  deploy: [
    {
      // Cible de déploiement principale (ex. Deno Deploy).
      name: "production",
      kind: "deno-deploy",
      envFile: ".env.deploy",
    },
    {
      // Exemple de cible custom pilotée par script shell.
      name: "on-premise",
      kind: "custom-script",
      script: "scripts/deploy.sh",
      envFile: ".env.production",
    },
  ],
};

export default config;
