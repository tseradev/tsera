# TSera Entity Definitions

## Entity Modeling Philosophy

TSera entities are the **single source of truth** for all generated artifacts. Every entity
definition drives the generation of Zod schemas, OpenAPI specifications, database migrations,
documentation, and tests.

## Core Entity Structure

### Entity Definition Pattern

```typescript
import { defineEntity } from "tsera/core/entity.ts";

export default defineEntity({
  name: "User",
  table: true,
  schema: true,
  doc: true,
  test: "smoke",
  fields: {
    id: {
      validator: z.string(),
      description: "Unique identifier",
      db: { primary: true },
    },
    email: {
      validator: z.string().email(),
      description: "User email address",
      visibility: "public",
    },
    password: {
      validator: z.string().min(8),
      description: "Hashed password",
      visibility: "secret",
    },
  },
});
```

## Entity Configuration

### Required Properties

#### `name: string`

- **Format**: PascalCase (e.g., `User`, `Product`, `OrderItem`)
- **Purpose**: Logical entity name used across all generated artifacts
- **Validation**: Must be valid TypeScript identifier and PascalCase

#### `fields: Record<string, FieldDef>`

- **Purpose**: Defines all entity fields with their validators and metadata
- **Requirement**: Must define at least one field
- **Key format**: camelCase (e.g., `firstName`, `createdAt`)

### Optional Properties

#### `table?: boolean`

- **Default**: `false`
- **Purpose**: Indicates if a relational table should be generated
- **When `true`**: Generates database migrations and table schema
- **When `false`**: Logical entity only (no persistence)

#### `schema?: boolean`

- **Default**: `true`
- **Purpose**: Enables Zod schema generation
- **Effect**: Creates validation schemas and TypeScript types

#### `doc?: boolean`

- **Default**: `true`
- **Purpose**: Enables documentation generation
- **Effect**: Generates Markdown documentation and API docs

#### `test?: "smoke" | "full" | false`

- **Default**: `"smoke"`
- **Purpose**: Configures test generation level
- **Options**:
  - `"smoke"`: Basic validation tests
  - `"full"`: Comprehensive test suite
  - `false`: No tests generated

#### `active?: boolean`

- **Default**: `true`
- **Purpose**: Controls entity inclusion in generation pipelines
- **When `false`**: Entity is ignored by all generators

## Field Definition Standards

### Field Definition Structure

```typescript
fieldName: {
  validator: z.ZodType,
  visibility?: "public" | "internal" | "secret",
  immutable?: boolean,
  stored?: boolean,
  description?: string,
  example?: unknown,
  db?: {
    primary?: boolean,
    unique?: boolean,
    index?: boolean,
    defaultNow?: boolean
  }
}
```

### Required Field Properties

#### `validator: z.ZodType`

- **Purpose**: Runtime validation and type definition
- **Requirements**: Must be a valid Zod schema
- **Common patterns**:
  - `z.string()`: Text fields
  - `z.number()`: Numeric fields
  - `z.boolean()`: Boolean fields
  - `z.date()`: Date/time fields
  - `z.array(z.string())`: Array fields
  - `z.enum()`: Enum fields

### Optional Field Properties

#### `visibility?: "public" | "internal" | "secret"`

- **Default**: `"public"`
- **Purpose**: Controls field exposure in APIs and documentation
- **Levels**:
  - `"public"`: Exposed in APIs, OpenAPI, and public docs
  - `"internal"`: Backend-only, not exposed in APIs
  - `"secret"`: Never exposed, masked in logs and docs

#### `immutable?: boolean`

- **Default**: `false`
- **Purpose**: Prevents field modification after creation
- **Effect**: Field is omitted from update schemas
- **Use cases**: IDs, timestamps, audit fields

#### `stored?: boolean`

- **Default**: `true`
- **Purpose**: Controls database persistence
- **When `false`**: Logical/computed field, not persisted
- **Effect**: Field excluded from database migrations

#### `description?: string`

- **Purpose**: Functional description for documentation
- **Usage**: OpenAPI specs, generated docs, tooltips
- **Requirement**: Must be non-empty if provided

#### `example?: unknown`

- **Purpose**: Example value for documentation and testing
- **Usage**: OpenAPI examples, test data generation
- **Type**: Must match validator type

### Database Metadata

#### `db.primary?: boolean`

- **Purpose**: Marks field as primary key
- **Effect**: Generates PRIMARY KEY constraint
- **Common use**: `id` fields

#### `db.unique?: boolean`

- **Purpose**: Enforces uniqueness constraint
- **Effect**: Generates UNIQUE constraint
- **Common use**: Email, username, slug fields

#### `db.index?: boolean`

- **Purpose**: Creates database index
- **Effect**: Improves query performance
- **Common use**: Foreign keys, frequently queried fields

#### `db.defaultNow?: boolean`

- **Purpose**: Auto-generates current timestamp
- **Effect**: Sets DEFAULT NOW() in database
- **Common use**: `createdAt`, `updatedAt` fields

## Entity Relationships

### Relations Configuration

```typescript
relations: ((r) => ({
  author: r.belongsTo(User, { foreignKey: "authorId" }),
  posts: r.hasMany(Post, { foreignKey: "authorId" }),
  tags: r.belongsToMany(Tag, { through: "post_tags" }),
}));
```

### Supported Relation Types

- **belongsTo**: Many-to-one relationship
- **hasMany**: One-to-many relationship
- **belongsToMany**: Many-to-many relationship
- **hasOne**: One-to-one relationship

## Entity Actions

### Action Configuration

```typescript
actions: ((a) => ({
  create: a.create(),
  read: a.read(),
  update: a.update(),
  delete: a.delete(),
  list: a.list(),
  customAction: a.custom({
    input: z.object({/* custom input schema */}),
    handler: async (input, context) => {
      // Custom action implementation
    },
  }),
}));
```

### Built-in Actions

- **create**: Create new entity
- **read**: Read single entity by ID
- **update**: Update existing entity
- **delete**: Delete entity
- **list**: List entities with filtering

## OpenAPI Configuration

### OpenAPI Settings

```typescript
openapi: {
  enabled: true,
  tags: ["users", "auth"],
  summary: "User management",
  description: "Operations for user entities including CRUD operations"
}
```

### OpenAPI Properties

- **enabled**: Controls OpenAPI generation for this entity
- **tags**: Array of tags for grouping operations
- **summary**: Brief description for API documentation
- **description**: Detailed description for API documentation

## Documentation Configuration

### Documentation Settings

```typescript
docs: {
  description: "User entity representing application users",
  examples: {
    "basic": {
      id: "123",
      email: "user@example.com",
      createdAt: "2023-01-01T00:00:00Z"
    },
    "with-profile": {
      id: "123",
      email: "user@example.com",
      profile: {
        firstName: "John",
        lastName: "Doe"
      }
    }
  }
}
```

## Best Practices

### Entity Design Principles

1. **Single Responsibility**: Each entity represents one clear concept
2. **Consistent Naming**: Use PascalCase for entities, camelCase for fields
3. **Explicit Types**: Always specify field validators and metadata
4. **Visibility Control**: Use visibility levels appropriately
5. **Documentation**: Provide descriptions and examples for all public fields

### Field Design Guidelines

1. **Required Fields**: Mark required fields in Zod validators
2. **Type Safety**: Use specific Zod types (e.g., `z.string().email()`)
3. **Validation**: Include validation rules in field validators
4. **Immutability**: Mark immutable fields appropriately
5. **Database Constraints**: Use `db` metadata for database-specific rules

### Common Patterns

#### Timestamp Fields

```typescript
createdAt: {
  validator: z.date(),
  description: "Creation timestamp",
  immutable: true,
  db: { defaultNow: true }
},
updatedAt: {
  validator: z.date(),
  description: "Last update timestamp",
  db: { defaultNow: true }
}
```

#### ID Fields

```typescript
id: {
  validator: z.string(),
  description: "Unique identifier",
  immutable: true,
  db: { primary: true, unique: true }
}
```

#### Email Fields

```typescript
email: {
  validator: z.string().email(),
  description: "Email address",
  visibility: "public",
  db: { unique: true }
}
```

#### Password Fields

```typescript
password: {
  validator: z.string().min(8),
  description: "Hashed password",
  visibility: "secret"
}
```

## File Organization

### Entity File Structure

- **Location**: `core/entities/` or `domain/` in generated projects
- **Naming**: `PascalCase.entity.ts` (e.g., `User.entity.ts`)
- **Exports**: Default export of the entity definition

### Import Patterns

```typescript
import { defineEntity } from "tsera/core/entity.ts";
import { z } from "zod";
```

## Validation Rules

### Entity Validation

- **Name**: Must be PascalCase and unique within project
- **Fields**: Must define at least one field
- **Validators**: All field validators must be valid Zod schemas
- **Relations**: Relation functions must return valid configuration

### Field Validation

- **Validator**: Must be a Zod type
- **Visibility**: Must be one of "public", "internal", "secret"
- **Database**: Database metadata must be consistent
- **Types**: Example values must match validator types

## Generated Artifacts

### From Entity Definitions

1. **Zod Schemas**: Runtime validation schemas
2. **TypeScript Types**: Compile-time type definitions
3. **Database Migrations**: SQL DDL for table creation
4. **OpenAPI Specs**: API documentation and contracts
5. **Documentation**: Markdown docs with examples
6. **Tests**: Validation and integration tests

### Consistency Rules

- All generated artifacts are synchronized with entity definitions
- Changes to entities automatically update all dependent artifacts
- Generated files are never manually edited
- Conflicts are resolved through entity modifications
