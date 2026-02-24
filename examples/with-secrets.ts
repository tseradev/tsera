/**
 * Exemple d'utilisation de TSera avec le module secret activé.
 *
 * Pour exécuter :
 *   deno run --allow-net --allow-env examples/with-secrets.ts
 */

import { TSera } from "@tsera/core";

// TSera est immédiatement disponible (pas de await)
// Vérifier si le module secret est activé
if (TSera.env) {
  // Accès par propriété
  console.log("DB_URL:", TSera.env.DB_URL);

  // Accès par méthode get (retourne undefined si absent)
  const dbUrl = TSera.env.get("DB_URL");
  console.log("DB_URL via get:", dbUrl);

  // Accès par méthode require (throw si absent)
  try {
    const requiredUrl = TSera.env.require("DB_URL");
    console.log("DB_URL via require:", requiredUrl);
  } catch (e) {
    console.error("Variable requise manquante:", (e as Error).message);
  }

  // Vérifier l'existence
  if (TSera.env.has("DB_URL")) {
    console.log("DB_URL est définie");
  }
} else {
  console.log("Module secret non activé");
}

// Accéder à la configuration
console.log("Configuration:", TSera.config);
