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
├── domain/              # Entity definitions
├── .tsera/              # Generated schemas and manifests
├── drizzle/             # Database migrations
├── docs/                # Generated documentation
├── tests/               # Generated and custom tests
└── tsera.config.ts      # TSera configuration
```

## Entities

Entities are defined in the `domain/` directory and serve as the single source of truth for:

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

