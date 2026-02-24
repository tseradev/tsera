/**
 * Exemple d'utilisation de TSera sans le module secret.
 *
 * Pour exécuter :
 *   deno run --allow-net examples/without-secrets.ts
 */

import { TSera } from "@tsera/core";

// TSera est immédiatement disponible (pas de await)
// TSera.env n'existe pas si modules.secrets = false
if (TSera.env) {
  console.log("Module secret activé - TSera.env disponible");
} else {
  console.log("Module secret désactivé - TSera.env non disponible");
}

// Accéder à la configuration
const config = TSera.config;
console.log("Configuration DB:", config.db);
console.log("Configuration Backend:", config.back);
console.log("Configuration Frontend:", config.front);
console.log("Modules activés:", config.modules);
