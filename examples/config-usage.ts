/**
 * Exemple d'utilisation de la configuration centralisée.
 *
 * Pour exécuter :
 *   deno run --allow-net examples/config-usage.ts
 */

import { createTSera, TSera } from "@tsera/core";
import tseraConfig from "../tsera.config.ts";

// Option 1: Utiliser l'instance par défaut (config auto-chargée)
// TSera est immédiatement disponible
console.log("=== Configuration TSera (défaut) ===");
console.log("DB Dialect:", TSera.config.db.dialect);

// Option 2: Créer une instance avec config explicite (recommandé)
const myTSera = createTSera(tseraConfig);

// Utiliser la configuration
const { back, front, db, modules } = myTSera.config;

console.log("=== Configuration TSera (explicite) ===");
console.log("Backend:");
console.log(`  Port: ${back?.port ?? "non défini"}`);
console.log(`  Host: ${back?.host ?? "non défini"}`);
console.log(`  API Prefix: ${back?.apiPrefix ?? "non défini"}`);

console.log("Frontend:");
console.log(`  Port: ${front?.port ?? "non défini"}`);
console.log(`  Src Dir: ${front?.srcDir ?? "non défini"}`);
console.log(`  Dest Dir: ${front?.destDir ?? "non défini"}`);

console.log("Database:");
console.log(`  Dialect: ${db.dialect}`);
if (db.dialect === "sqlite") {
  console.log(`  File: ${db.file}`);
}

console.log("Modules:");
Object.entries(modules).forEach(([name, enabled]) => {
  console.log(`  ${name}: ${enabled ? "activé" : "désactivé"}`);
});
