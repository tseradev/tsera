# TSera Project

A fullstack TypeScript project powered by TSera - continuous coherence for modern applications.

## Stack

- **Runtime**: Deno v2
- **Validation**: Zod with automatic schema generation
- **Database**: Drizzle ORM with automatic migrations
- **Documentation**: Auto-generated from entity definitions

## Getting Started

### Prerequisites

- [Deno v2](https://docs.deno.com/runtime/manual/getting_started/installation) installed

### Development

```bash
# Start development mode with hot reload
deno task dev

# Run tests
deno task test

# Format code
deno task fmt

# Lint code
deno task lint
```

### TSera Commands

```bash
# Watch entities and regenerate artifacts
tsera dev

# Check project coherence
tsera doctor

# Fix detected issues automatically
tsera doctor --fix
```

## Project Structure

```
.
├── app/
│   ├── back/            # Backend (Hono API)
│   ├── front/           # Frontend (Fresh SSR)
│   └── db/              # Database client and migrations
├── core/
│   ├── entities/        # Entity definitions (single source of truth)
│   ├── validation/      # Shared validation schemas
│   ├── types/           # Shared TypeScript types
│   └── utils/           # Shared utilities
├── config/
│   ├── docker/          # Docker configuration
│   ├── ci-cd/           # CI/CD workflows
│   ├── secrets/         # Environment-specific secrets
│   ├── db/              # Database configuration
│   └── tsera.config.ts  # TSera configuration
├── tests/               # Tests (unit, integration, e2e)
├── docs/                # Generated documentation
│   ├── openapi/         # OpenAPI specs
│   └── markdown/        # Entity documentation
└── .tsera/              # Generated schemas, manifests, and KV store
```

## Secrets Management

TSera provides a secure, type-safe secrets management system with optional encryption.

### Local Development

1. **Set environment** (default: `dev`):

   ```bash
   # On Windows
   $env:TSERA_ENV="dev"

   # On macOS/Linux
   export TSERA_ENV=dev
   ```

2. **Create your `.env` file**:

   ```bash
   # Copy example file to get started
   cp secrets/.env.example secrets/.env.dev

   # Edit with your actual values
   # secrets/.env.dev
   ```

3. **(Optional) Enable encryption**:

   Set `TSERA_SECRET_KEY` to encrypt secrets in the local KV store:

   ```bash
   # On Windows
   $env:TSERA_SECRET_KEY="your-strong-passphrase-32chars-min"

   # On macOS/Linux
   export TSERA_SECRET_KEY="your-strong-passphrase-32chars-min"
   ```

   **Without `TSERA_SECRET_KEY`**: Secrets are stored in clear text in `.tsera/kv/` (warning
   displayed). **With `TSERA_SECRET_KEY`**: Secrets are encrypted with AES-256-GCM before storage.

### Encrypted Store (Deno KV)

TSera persists validated secrets locally in `.tsera/kv` using Deno KV:

- **With `TSERA_SECRET_KEY`**: Values encrypted with AES-256-GCM
- **Without**: Values stored in clear (warning displayed)
- **Salt**: Fixed per installation in `.tsera/salt`
- **Isolation**: Each environment (dev/preprod/prod) has isolated storage

The global API `tsera.env()` always reads from memory for speed, not from KV.

### Git-Crypt Protection (Optional)

To version secrets in Git securely using **git-crypt**:

1. **Install git-crypt**:

   ```bash
   # macOS
   brew install git-crypt

   # Ubuntu/Debian
   sudo apt-get install git-crypt

   # Windows
   # Download from: https://github.com/AGWA/git-crypt/releases
   ```

2. **Initialize git-crypt**:

   ```bash
   git-crypt init
   ```

3. **Add team member** (using their GPG key):

   ```bash
   git-crypt add-gpg-user <GPG_KEY_ID>
   ```

4. **Commit encrypted files**:

   The `.gitattributes` file already configures which files to encrypt:
   - `secrets/.env.*` (all environment files)
   - `.tsera/kv/**` (KV store database)
   - `.tsera/salt` (encryption salt)

   ```bash
   git add secrets/ .gitattributes
   git commit -m "chore: add encrypted secrets"
   git push
   ```

**Note**: git-crypt is **optional**. Without it, the files listed in `.gitignore` won't be
committed.

### Environment Variables Schema

Environment variables are validated against `env.config.ts`:

```typescript
import { defineEnvSchema } from "tsera/core/secrets.ts";

export const envSchema = defineEnvSchema({
  DATABASE_URL: { type: "string", required: true },
  PORT: { type: "number", required: true, default: 3000 },
  DEBUG: { type: "boolean", required: false, default: false },
});
```

Access validated variables via the global `tsera` API:

```typescript
const dbUrl = tsera.env("DATABASE_URL");
const port = tsera.env("PORT") as number;
console.log(`Running in ${tsera.currentEnvironment} mode`);
```

## Entities

Entities are defined in the `core/entities/` directory and serve as the single source of truth for:

- TypeScript types
- Zod validation schemas
- Database migrations
- API documentation
- Tests

Example entity:

```typescript
import { defineEntity } from "tsera/core/entity.ts";

export default defineEntity({
  name: "User",
  table: true,
  doc: true,
  test: "smoke",
  columns: {
    id: { type: "string", description: "Unique identifier" },
    email: { type: "string", description: "User email address" },
    createdAt: { type: "date", default: "1970-01-01T00:00:00.000Z" },
  },
});
```

## Learn More

- [TSera Documentation](https://github.com/yourusername/tsera)
- [Deno Documentation](https://docs.deno.com)
