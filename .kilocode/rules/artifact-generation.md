# TSera Artifact Generation

## Generation Philosophy

TSera generates **coherent artifacts** from a single source of truth - entity definitions. Every
generated artifact maintains synchronization with its source entity and follows consistent patterns
across all output types.

## Generated Artifact Types

### Core Artifacts

1. **Zod Schemas** → `*.schema.ts` (runtime validation)
2. **OpenAPI Specifications** → `openapi.json` (API contracts)
3. **Database Migrations** → `drizzle/YYYYMMDDHHMM_ssssss_desc.sql`
4. **TypeScript Types** → `*.types.ts` (compile-time types)
5. **Documentation** → Markdown files per entity
6. **Tests** → Smoke tests and validation tests

### Optional Artifacts

- **SDK Generation** → Client SDKs (hono/client)
- **Configuration Files** → Environment-specific configs
- **CI/CD Workflows** → GitHub Actions workflows

## Generation Pipeline

### Watch → Plan → Apply Cycle

```typescript
// 1. Watch: Detect changes in entities/config
Deno.watchFs(paths, { recursive: true });

// 2. Plan: Compare current vs previous state
const plan = await planner.generatePlan(entities, previousState);

// 3. Apply: Generate artifacts based on plan
await applier.applyPlan(plan);
```

### Planning Phase

- **Hash Calculation**: SHA-256 of content + options + CLI version
- **State Comparison**: Current hash vs stored hash
- **Change Detection**: `create | update | delete | noop` operations
- **Dependency Resolution**: Build DAG of artifact dependencies

### Application Phase

- **Atomic Operations**: Use `safeWrite` for all file writes
- **Order Preservation**: Stable ordering of generated content
- **Rollback Safety**: Cleanup on generation failure
- **State Update**: Update `.tsera/manifest.json` after success

## Artifact Standards

### Zod Schema Generation

```typescript
// Generated schema structure
export const UserSchema = z.object({
  id: z.string().describe("Unique identifier"),
  email: z.string().email().describe("User email address"),
  createdAt: z.date().describe("Creation timestamp"),
});

export type UserType = z.infer<typeof UserSchema>;
```

#### Schema Requirements

- **Complete**: Include all entity fields
- **Validated**: Use field validators from entity definition
- **Described**: Include field descriptions in schema
- **Typed**: Export inferred TypeScript type

#### File Organization

- **Location**: `.tsera/schemas/` or `core/validation/`
- **Naming**: `PascalCase.schema.ts`
- **Exports**: Schema object and inferred type

### OpenAPI Generation

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "TSera API",
    "version": "1.0.0"
  },
  "paths": {
    "/users": {
      "get": {
        "summary": "List users",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/User" }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "email": { "type": "string", "format": "email" }
        }
      }
    }
  }
}
```

#### OpenAPI Requirements

- **Entity-Based**: Generate from entity definitions
- **Public Fields Only**: Exclude internal/secret fields
- **Validation**: Include validation rules from Zod schemas
- **Examples**: Include example values from entity definitions

#### File Organization

- **Location**: `.tsera/openapi.json` or `docs/openapi/`
- **Format**: JSON with sorted keys for diff stability
- **Versioning**: Include API version in specification

### Database Migration Generation

```sql
-- Migration: 20231203183000_create_user_table.sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
```

#### Migration Requirements

- **Incremental**: Generate only what changed
- **Reversible**: Include rollback statements when possible
- **Type Mapping**: Map entity types to SQL types correctly
- **Constraints**: Include primary keys, unique constraints, indexes

#### File Organization

- **Location**: `drizzle/migrations/`
- **Naming**: `YYYYMMDDHHMM_ssssss_description.sql`
- **Ordering**: Chronological order for proper execution

### Documentation Generation

````markdown
# User Entity

Represents application users with authentication and profile information.

## Properties

| Name      | Type   | Description        | Example                |
| --------- | ------ | ------------------ | ---------------------- |
| id        | string | Unique identifier  | "123"                  |
| email     | string | User email address | "user@example.com"     |
| createdAt | date   | Creation timestamp | "2023-01-01T00:00:00Z" |

## Examples

### Basic User

```json
{
  "id": "123",
  "email": "user@example.com",
  "createdAt": "2023-01-01T00:00:00Z"
}
```
````

#### Documentation Requirements

- **Entity Description**: Functional overview of entity purpose
- **Field Documentation**: Type, description, and examples for each field
- **Code Examples**: Practical usage examples
- **Cross-References**: Links to related entities

#### File Organization

- **Location**: `docs/` or `.tsera/docs/`
- **Format**: Markdown with consistent structure
- **Navigation**: Include table of contents for multi-entity docs

### Test Generation

```typescript
Deno.test("User schema validation", async (t) => {
  const validUser = {
    id: "123",
    email: "test@example.com",
    createdAt: new Date(),
  };

  await assertSchema(t, UserSchema, validUser);
});

Deno.test("User schema rejects invalid email", async (t) => {
  const invalidUser = {
    id: "123",
    email: "invalid-email",
    createdAt: new Date(),
  };

  await assertSchemaRejects(t, UserSchema, invalidUser);
});
```

#### Test Requirements

- **Validation Tests**: Test schema validation rules
- **Edge Cases**: Test boundary conditions
- **Error Messages**: Verify meaningful error messages
- **Integration Tests**: Test with actual database operations

#### File Organization

- **Location**: `tests/` or `.tsera/tests/`
- **Naming**: `*.test.ts` matching entity names
- **Structure**: Unit tests per entity, integration tests for workflows

## File Writing Standards

### Safe Write Operations

```typescript
async function safeWrite(path: string, content: string): Promise<void> {
  const tempPath = `${path}.tmp.${Date.now()}`;

  try {
    // Write to temporary file
    await Deno.writeTextFile(tempPath, content);

    // Atomic rename
    await Deno.rename(tempPath, path);
  } catch (error) {
    // Cleanup on failure
    await Deno.remove(tempPath).catch(() => {});
    throw error;
  }
}
```

### Write Requirements

- **Atomic**: Use temporary files + rename
- **Diff-Aware**: Only write if content changed
- **Backup Safe**: Never overwrite without verification
- **Cleanup**: Remove temporary files on failure

## Configuration Management

### Generation Configuration

```typescript
interface GenerationConfig {
  /** Output directory for generated artifacts */
  outDir: string;
  /** Enable/disable specific artifact types */
  artifacts: {
    zod: boolean;
    openapi: boolean;
    migrations: boolean;
    docs: boolean;
    tests: boolean;
  };
  /** Formatting options */
  formatting: {
    jsonIndent: number;
    sqlDialect: "postgres" | "mysql" | "sqlite";
  };
}
```

### Configuration Sources

- **Entity Definitions**: Primary source of truth
- **CLI Options**: Command-line flags and options
- **Project Config**: `tsera.config.ts` settings
- **Environment Variables**: Runtime configuration

## Error Handling

### Generation Errors

- **Validation Errors**: Clear entity definition errors
- **File System Errors**: Handle permission/disk space issues
- **Template Errors**: Missing or invalid templates
- **Dependency Errors**: Missing required dependencies

### Error Reporting

```typescript
class GenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly entity?: string,
    public readonly artifact?: string,
  ) {
    super(message);
  }
}
```

## Performance Optimization

### Incremental Generation

- **Hash Comparison**: Only regenerate changed artifacts
- **Dependency Tracking**: Skip unchanged dependencies
- **Parallel Processing**: Generate independent artifacts concurrently
- **Caching**: Cache expensive operations

### Memory Management

- **Stream Processing**: Handle large files with streams
- **Resource Cleanup**: Properly close file handles
- **Garbage Collection**: Explicit cleanup of temporary data
- **Memory Monitoring**: Track memory usage during generation

## Quality Assurance

### Consistency Checks

- **Type Synchronization**: Verify TS types match Zod schemas
- **API Consistency**: Ensure OpenAPI matches entity definitions
- **Database Consistency**: Verify migrations match entity fields
- **Documentation Sync**: Ensure docs match current entities

### Validation Rules

- **Schema Validation**: All generated schemas must be valid
- **Type Safety**: No `any` types in generated code
- **Format Consistency**: Consistent formatting across all artifacts
- **Naming Consistency**: Consistent naming patterns

## Integration Points

### CLI Integration

- **Command Registration**: Register generation commands with CLI router
- **Option Parsing**: Parse generation options from command line
- **Progress Reporting**: Provide feedback during generation
- **Error Handling**: Proper error codes and messages

### Template System Integration

- **Template Discovery**: Find and load templates from template paths
- **Template Validation**: Validate template syntax and structure
- **Context Building**: Build template context from entity definitions
- **Output Generation**: Render templates with entity data

### Watcher Integration

- **File Watching**: Monitor entity and configuration changes
- **Debouncing**: Prevent excessive regeneration
- **Change Detection**: Identify specific changes for targeted updates
- **Auto-Apply**: Automatically apply changes when detected

## Best Practices

### Generation Principles

1. **Idempotent**: Multiple runs with same input produce same output
2. **Incremental**: Only regenerate what changed
3. **Atomic**: Never leave project in inconsistent state
4. **Predictable**: Consistent output format and structure

### Code Quality

- **Type Safety**: All generated code must be type-safe
- **Validation**: Include runtime validation where appropriate
- **Documentation**: Generate comprehensive documentation
- **Testing**: Generate tests for all generated code

### User Experience

- **Clear Feedback**: Provide progress indicators
- **Error Messages**: Actionable error messages
- **Performance**: Fast generation for large projects
- **Flexibility**: Support customization through configuration
