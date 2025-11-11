# Secrets Management

TSera provides a secure, type-safe secrets management system with optional encryption.

## Quick Start

### 1. Set Environment

Choose which environment to use (default: `dev`):

```bash
# Windows
$env:TSERA_ENV="dev"

# macOS/Linux
export TSERA_ENV=dev
```

### 2. Configure Environment Variables

Copy the example file and edit it:

```bash
cp config/secrets/.env.example config/secrets/.env.dev
```

Edit `config/secrets/.env.dev` with your actual values.

### 3. Optional: Enable Encryption

To encrypt secrets in the local KV store, set a strong passphrase:

```bash
# Windows
$env:TSERA_SECRET_KEY="your-strong-passphrase-32chars-min"

# macOS/Linux
export TSERA_SECRET_KEY="your-strong-passphrase-32chars-min"
```

**Without `TSERA_SECRET_KEY`**: Secrets are stored in plain text (warning displayed).

**With `TSERA_SECRET_KEY`**: Secrets are encrypted with AES-256-GCM before storage.

## Environment Files

- `.env.example` - Template with all available variables
- `.env.dev` - Development environment
- `.env.staging` - Staging environment
- `.env.prod` - Production environment

## Schema Definition

Environment variables are validated against the schema in `manager.ts`:

```typescript
export const envSchema = defineEnvSchema({
  DATABASE_URL: {
    type: "string",
    required: true,
    description: "Database connection URL",
  },
  PORT: {
    type: "number",
    required: false,
    default: 8000,
    description: "Backend server port",
  },
  // ... more variables
});
```

## Usage

Access validated variables via the global `tsera` API:

```typescript
const dbUrl = tsera.env("DATABASE_URL");
const port = tsera.env("PORT") as number;
console.log(`Running in ${tsera.currentEnvironment} mode`);
```

## Git-Crypt (Optional)

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
   - `config/secrets/.env.*` (all environment files)
   - `.tsera/kv/**` (KV store database)
   - `.tsera/salt` (encryption salt)

**Note**: git-crypt is **optional**. Without it, the files listed in `.gitignore` won't be committed.

## Security Best Practices

- Never commit `.env.*` files without git-crypt
- Use strong passphrases for `TSERA_SECRET_KEY` (32+ characters)
- Rotate secrets regularly
- Use different secrets for each environment
- Store production secrets in your deployment platform's secrets manager

