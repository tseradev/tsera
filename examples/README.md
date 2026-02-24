# Exemples TSera

Ce dossier contient des exemples d'utilisation de l'API TSera.

## Exemples disponibles

### `with-secrets.ts`

Montre comment utiliser TSera avec le module secret activé pour accéder aux variables
d'environnement.

```bash
deno run --allow-net --allow-env examples/with-secrets.ts
```

### `without-secrets.ts`

Montre comment utiliser TSera sans le module secret.

```bash
deno run --allow-net examples/without-secrets.ts
```

### `config-usage.ts`

Montre comment utiliser la configuration centralisée depuis `tsera.config.ts`.

```bash
deno run --allow-net examples/config-usage.ts
```

## API TSera

```typescript
import { TSera } from "tsera";

// Attendre l'initialisation
await TSera.ready;

// Accès à la configuration
TSera.config; // Objet TseraConfig complet

// Accès aux secrets (si modules.secret = true)
TSera.env.VARIABLE_NAME; // Accès par propriété
TSera.env.get("VAR"); // Retourne undefined si absent
TSera.env.require("VAR"); // Throw si absent
TSera.env.has("VAR"); // Boolean
```
