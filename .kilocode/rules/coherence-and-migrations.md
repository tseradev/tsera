# TSera Coherence and Migrations

## Coherence Philosophy

TSera maintains **continuous coherence** between entities and all generated artifacts. Any change to
entity definitions automatically triggers regeneration to maintain synchronization across the entire
project ecosystem.

## Coherence Invariants

### Entity Consistency

- **Single Source of Truth**: Entity definitions drive all artifacts
- **Synchronization**: All generated artifacts must match entity definitions
- **No Manual Editing**: Generated files are never manually edited
- **Atomic Updates**: All changes are applied atomically

### Artifact Consistency

- **Type Synchronization**: TypeScript types match Zod schemas
- **API Consistency**: OpenAPI specifications match entity definitions
- **Database Consistency**: Migrations match entity field definitions
- **Documentation Consistency**: Documentation matches current entity state

## Migration Strategy

### Incremental Migrations

- **Change Detection**: Only regenerate what changed since last generation
- **Forward Compatibility**: Migrations should never break existing data
- **Rollback Support**: Include rollback statements when possible
- **Migration Ordering**: Maintain chronological order for proper execution

### Migration Types

```typescript
// Database migration types
export interface Migration {
  id: string; // Unique identifier
  name: string; // Human-readable name
  description: string; // What this migration does
  sql: string; // SQL to execute
  rollbackSql?: string; // SQL to rollback changes
  timestamp: Date; // When migration was created
}

// Migration direction types
export type MigrationDirection = "up" | "down" | "auto";

export interface MigrationPlan {
  migrations: Migration[];
  direction: MigrationDirection;
  dryRun: boolean;
}
```

## Coherence Checks

### Type Coherence

```typescript
// Verify TypeScript types match Zod schemas
export function validateTypeCoherence(entities: Entity[]): CoherenceReport {
  const issues: CoherenceIssue[] = [];

  for (const entity of entities) {
    const schema = entityToZod(entity);
    const generatedType = inferGeneratedType(entity);

    if (!typesMatch(schema, generatedType)) {
      issues.push({
        type: "type-mismatch",
        entity: entity.name,
        message: `Type mismatch between Zod schema and generated types for ${entity.name}`,
      });
    }
  }

  return {
    issues,
    isCoherent: issues.length === 0,
  };
}
```

### API Coherence

```typescript
// Verify OpenAPI matches entity definitions
export function validateApiCoherence(entities: Entity[]): CoherenceReport {
  const issues: CoherenceIssue[] = [];

  const openApiSpec = generateOpenApiSpec(entities);

  for (const entity of entities) {
    const schema = openApiSpec.components.schemas[entity.name];
    if (!schema) {
      issues.push({
        type: "missing-schema",
        entity: entity.name,
        message: `Missing OpenAPI schema for ${entity.name}`,
      });
    }

    // Verify field consistency
    for (const [fieldName, field] of Object.entries(entity.fields)) {
      if (field.visibility === "public" && !schema.properties[fieldName]) {
        issues.push({
          type: "missing-field",
          entity: entity.name,
          field: fieldName,
          message: `Public field ${fieldName} missing from OpenAPI schema for ${entity.name}`,
        });
      }
    }
  }

  return {
    issues,
    isCoherent: issues.length === 0,
  };
}
```

### Database Coherence

```typescript
// Verify database schema matches entity definitions
export function validateDatabaseCoherence(entities: Entity[]): CoherenceReport {
  const issues: CoherenceIssue[] = [];

  for (const entity of entities) {
    if (!entity.table) continue;

    const migration = generateMigration(entity);
    const existingSchema = await getDatabaseSchema(entity.name);

    // Check for missing fields
    for (const [fieldName, field] of Object.entries(entity.fields)) {
      if (field.stored !== false && !hasColumn(existingSchema, fieldName)) {
        issues.push({
          type: "missing-column",
          entity: entity.name,
          field: fieldName,
          message: `Database column ${fieldName} missing for ${entity.name}`,
        });
      }
    }

    // Check for extra fields
    for (const columnName of Object.keys(existingSchema)) {
      if (!entity.fields[columnName] && hasColumn(existingSchema, columnName)) {
        issues.push({
          type: "extra-column",
          entity: entity.name,
          field: columnName,
          message: `Extra database column ${columnName} for ${entity.name}`,
        });
      }
    }
  }

  return {
    issues,
    isCoherent: issues.length === 0,
  };
}
```

## Coherence Issues

### Issue Types

```typescript
export interface CoherenceIssue {
  type:
    | "type-mismatch"
    | "missing-schema"
    | "missing-field"
    | "extra-column"
    | "stale-artifact"
    | "orphaned-file"
    | "version-conflict";
  entity: string;
  field?: string;
  message: string;
  severity: "error" | "warning" | "info";
  suggestion?: string;
}
```

### Issue Severity

- **Error**: Breaking coherence issues that must be fixed
- **Warning**: Non-breaking issues that should be addressed
- **Info**: Informational issues that don't require immediate action

## Automated Resolution

### Auto-Fix Rules

```typescript
// Automatic fixes for common coherence issues
export async function autoFixCoherenceIssues(
  issues: CoherenceIssue[],
): Promise<FixResult> {
  const fixes: FixResult[] = [];

  for (const issue of issues) {
    switch (issue.type) {
      case "stale-artifact":
        await removeStaleArtifact(issue);
        fixes.push({ issue, action: "removed", success: true });
        break;

      case "orphaned-file":
        await removeOrphanedFile(issue);
        fixes.push({ issue, action: "removed", success: true });
        break;

      case "version-conflict":
        // Manual resolution required
        fixes.push({
          issue,
          action: "manual",
          success: false,
          suggestion: "Manual merge required",
        });
        break;
    }
  }

  return { fixes, hasFixes: fixes.some((f) => f.success) };
}
```

### Fix Strategies

- **Stale Artifacts**: Remove outdated generated files
- **Orphaned Files**: Remove generated files without corresponding entities
- **Type Mismatches**: Regenerate affected artifacts
- **Missing Fields**: Add missing database columns or API fields

## Migration Management

### Migration Tracking

```typescript
// Track applied migrations
export interface MigrationState {
  appliedMigrations: string[];
  lastMigration: string;
  schemaVersion: string;
}

export class MigrationManager {
  private state: MigrationState;

  async loadState(): Promise<void> {
    // Load migration state from .tsera/migrations.json
  }

  async saveState(): Promise<void> {
    // Save migration state to .tsera/migrations.json
  }

  async applyMigration(migration: Migration): Promise<void> {
    // Apply migration and update state
  }
}
```

### Migration Commands

```typescript
// CLI commands for migration management
export const migrationCommands = {
  "migrate": "Apply pending migrations",
  "rollback": "Rollback last migration",
  "status": "Show migration status",
  "reset": "Reset migration state",
};
```

## Continuous Coherence

### Watch Loop Integration

```typescript
// Integration with TSera watch loop
export function integrateCoherenceChecks(
  watcher: FileSystemWatcher,
  coherenceChecker: CoherenceChecker,
): void {
  watcher.on(async (event) => {
    if (event.kind === "modify" && isEntityFile(event.paths[0])) {
      const issues = await coherenceChecker.checkCoherence();
      if (!issues.isCoherent) {
        await autoFixCoherenceIssues(issues.issues);
      }
    }
  });
}
```

### Coherence Reporting

```typescript
// Generate coherence reports
export function generateCoherenceReport(
  issues: CoherenceIssue[],
): CoherenceReport {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const info = issues.filter((i) => i.severity === "info");

  return {
    summary: {
      total: issues.length,
      errors: errors.length,
      warnings: warnings.length,
      info: info.length,
      isCoherent: errors.length === 0,
    },
    issues: issues.sort((a, b) => a.severity.localeCompare(b.severity)),
    timestamp: new Date().toISOString(),
  };
}
```

## Best Practices

### Coherence Principles

1. **Single Source of Truth**: Entity definitions drive all generation
2. **Atomic Operations**: Never leave project in inconsistent state
3. **Incremental Changes**: Only regenerate what changed
4. **Validation**: Always validate coherence after changes
5. **Rollback Safety**: Support rollback when possible

### Change Management

- **Tracked Changes**: All modifications go through coherence system
- **Validation Gates**: Coherence checks must pass before acceptance
- **Rollback Points**: Clear rollback points for recovery
- **Documentation**: All changes are documented with impact

### Monitoring

- **Coherence Metrics**: Track time between entity changes and artifact regeneration
- **Error Rates**: Monitor coherence failures and auto-fix success rates
- **Performance Metrics**: Track generation performance over time

### Testing

- **Coherence Tests**: Test entity-to-artifact coherence
- **Migration Tests**: Test migration up/down scenarios
- **Rollback Tests**: Test rollback procedures
- **Integration Tests**: Test full coherence workflows

## Configuration

### Coherence Configuration

```typescript
// Configuration for coherence checks
export interface CoherenceConfig {
  autoFix: boolean; // Enable automatic fixes
  strictMode: boolean; // Fail on any coherence issue
  validateOnSave: boolean; // Validate coherence after entity saves
  migrationStrategy: "safe" | "auto"; // Migration approach
}
```

### Default Configuration

```typescript
export const defaultCoherenceConfig: CoherenceConfig = {
  autoFix: true,
  strictMode: false,
  validateOnSave: true,
  migrationStrategy: "safe",
};
```

## Error Recovery

### Coherence Failures

```typescript
// Handle coherence failures gracefully
export class CoherenceError extends Error {
  constructor(
    message: string,
    public readonly issues: CoherenceIssue[],
    public readonly context: string,
  ) {
    super(message);
  }
}

export async function handleCoherenceFailure(
  error: CoherenceError,
): Promise<void> {
  // Log coherence failure
  console.error(`Coherence failure: ${error.message}`);

  // Attempt automatic fixes
  if (error.issues.length > 0) {
    const fixResult = await autoFixCoherenceIssues(error.issues);
    if (fixResult.hasFixes) {
      console.log(`Applied ${fixResult.fixes.length} automatic fixes`);
    }
  }

  // Exit with appropriate code
  Deno.exit(error.issues.some((i) => i.severity === "error") ? 1 : 0);
}
```

## Quality Assurance

### Coherence Quality Metrics

- **Coherence Score**: Percentage of coherent entities
- **Artifact Freshness**: How up-to-date generated artifacts are
- **Migration Success Rate**: Percentage of successful migrations
- **Auto-Fix Effectiveness**: Success rate of automatic fixes

### Continuous Improvement

- **Pattern Detection**: Detect common coherence issues
- **Prevention**: Prevent coherence issues before they occur
- **Learning**: Improve auto-fix algorithms based on failure patterns
- **Feedback Loop**: Use user feedback to improve coherence system
