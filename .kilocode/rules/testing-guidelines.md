# TSera Testing Guidelines

## Testing Philosophy

TSera testing ensures **coherence between entities and generated artifacts**. Tests validate that
entity definitions correctly drive the generation of Zod schemas, OpenAPI specifications, database
migrations, documentation, and tests.

## Test Structure

### Test Organization

```
src/
├── core/tests/           # Core entity system tests
├── cli/tests/            # CLI functionality tests
├── cli/engine/tests/      # Generation engine tests
├── cli/ui/tests/         # UI component tests
├── cli/utils/tests/       # CLI utility tests
└── shared/tests/          # Shared utility tests

e2e.test.ts                # End-to-end tests
__golden__/                 # Golden files for snapshots
```

### Test Types

- **Unit Tests**: Test individual functions and classes in isolation
- **Integration Tests**: Test interaction between components
- **Golden Tests**: Snapshot testing for generated content
- **E2E Tests**: Full workflow testing from CLI to generated artifacts

## Deno Testing Standards

### Test Structure

```typescript
// Standard test structure
Deno.test("test description", async (t) => {
  // Arrange
  const testData = setupTestData();

  // Act
  const result = await functionUnderTest(testData);

  // Assert
  assertEquals(result.expected, result.actual);
});

// Test steps for complex scenarios
Deno.test("complex scenario", async (t) => {
  await t.step("setup", async () => {
    // Setup code
  });

  await t.step("execute", async () => {
    // Main test code
  });

  await t.step("verify", async () => {
    // Verification code
  });
});
```

### Test Permissions

- Tests run with `-A` but should document required permissions
- Use `Deno.permissions.query()` to check available permissions
- Mock external dependencies in unit tests
- Integration tests should test with minimal permissions

### Test Utilities

```typescript
// Test helpers for temporary directories
export async function withTempDir<T>(
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const tempDir = await Deno.makeTempDir();

  try {
    return await fn(tempDir);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

// Test helpers for CLI execution
export async function runCli(
  args: string[],
  options: { cwd?: string } = {},
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const cmd = new Deno.Command(Deno.execPath(), "deno", {
    args: ["run", "-A", "src/cli/main.ts", ...args],
    ...options,
  });

  const { success, stdout, stderr } = await cmd.output();
  return { success, stdout, stderr };
}
```

## Core Entity Testing

### Entity Definition Tests

```typescript
Deno.test("defineEntity validates entity configuration", async () => {
  const entity = defineEntity({
    name: "User",
    fields: {
      id: { validator: z.string() },
      email: { validator: z.string().email() },
    },
  });

  assertEquals(entity.name, "User");
  assertEquals(Object.keys(entity.fields).length, 2);
});

Deno.test("defineEntity rejects invalid entity name", async () => {
  assertThrows(() => {
    defineEntity({
      name: "invalid-name", // Not PascalCase
      fields: { id: { validator: z.string() } },
    });
  }, Error);
});
```

### Schema Generation Tests

```typescript
Deno.test("entityToZod generates correct schema", async () => {
  const entity = createTestEntity();
  const schema = entityToZod(entity);

  assertEquals(schema.shape.id.type, "ZodString");
  assertEquals(schema.shape.email.type, "ZodString");
});

Deno.test("public schema filters secret fields", async () => {
  const entity = createTestEntityWithSecretField();
  const publicSchema = buildPublicSchema(entity);

  assert(!("password" in publicSchema.shape));
});
```

## CLI Testing

### Command Testing

```typescript
Deno.test("init command creates project structure", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    await runCli(["init", "test-project"], { cwd: tempDir });

    // Verify generated files
    assert(await exists(join(tempDir, "test-project", "config", "tsera.config.ts")));
    assert(await exists(join(tempDir, "test-project", "core", "entities")));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
```

### Golden File Testing

```typescript
Deno.test("generated config matches golden file", async () => {
  const config = await generateConfig({
    projectName: "test",
    modules: { hono: true, fresh: false },
  });

  const goldenConfig = await Deno.readTextFile(
    join(import.meta.dirname!, "__golden__", "tsera.config.ts"),
  );

  assertEquals(
    normalizeConfig(config),
    normalizeConfig(goldenConfig),
  );
});
```

### Error Handling Tests

```typescript
Deno.test("command handles missing config gracefully", async () => {
  const result = await runCli(["doctor"], {
    cwd: "non-existent-dir",
  });

  assertEquals(result.success, false);
  assert(result.stderr.includes("No TSera project found"));
  assertEquals(Deno.exitCode, 2); // Usage error
});
```

## Generation Engine Testing

### Planner Tests

```typescript
Deno.test("planner detects entity changes", async () => {
  const oldState = createTestState();
  const newEntities = [createModifiedEntity()];

  const plan = await planner.generatePlan(newEntities, oldState);

  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].type, "update");
});
```

### Applier Tests

```typescript
Deno.test("applier writes files atomically", async () => {
  const tempDir = await Deno.makeTempDir();
  const testPath = join(tempDir, "test.txt");

  await applier.applyStep({
    type: "create",
    path: testPath,
    content: "test content",
  });

  // Verify file exists and has correct content
  assert(await exists(testPath));
  assertEquals(await Deno.readTextFile(testPath), "test content");
});
```

## Artifact Testing

### Generated Schema Tests

```typescript
Deno.test("generated Zod schema validates correctly", async () => {
  const generatedSchema = await loadGeneratedSchema("User");
  const validData = { id: "123", email: "test@example.com" };

  // Should not throw for valid data
  await generatedSchema.parseAsync(validData);

  // Should throw for invalid data
  await assertRejects(
    generatedSchema.parseAsync({ id: "123", email: "invalid" }),
    z.ZodError,
  );
});
```

### OpenAPI Tests

```typescript
Deno.test("generated OpenAPI matches entity structure", async () => {
  const openApiSpec = await loadGeneratedOpenAPI();

  // Verify User schema exists
  assert(openApiSpec.components.schemas.User);

  // Verify field types
  assertEquals(
    openApiSpec.components.schemas.User.properties.id.type,
    "string",
  );
  assertEquals(
    openApiSpec.components.schemas.User.properties.email.format,
    "email",
  );
});
```

### Migration Tests

```typescript
Deno.test("generated migration creates correct SQL", async () => {
  const migration = await loadLatestMigration();

  // Verify table creation
  assert(migration.sql.includes("CREATE TABLE users"));

  // Verify field definitions
  assert(migration.sql.includes("id TEXT PRIMARY KEY"));
  assert(migration.sql.includes("email TEXT UNIQUE NOT NULL"));
});
```

## E2E Testing

### Full Workflow Tests

```typescript
Deno.test("complete init -> dev -> modify -> regenerate workflow", async () => {
  const workspace = await Deno.makeTempDir({ dir: Deno.cwd() });
  const projectDir = join(workspace, "demo");

  try {
    // 1. Initialize project
    const initResult = await runCli([
      "init",
      "demo",
      "--no-fresh",
      "--no-docker",
      "--yes",
    ], { cwd: workspace });

    assert(initResult.success, `Init failed: ${initResult.stderr}`);

    // 2. Start dev mode
    const devProcess = new Deno.Command(Deno.execPath(), "deno", {
      args: ["run", "-A", "src/cli/main.ts", "dev", "--json"],
      cwd: projectDir,
    });

    // 3. Modify entity
    await modifyEntity(projectDir);

    // 4. Verify regeneration
    await waitForRegeneration(devProcess);

    // 5. Verify generated artifacts
    await verifyGeneratedArtifacts(projectDir);
  } finally {
    // Clean up generated directories after test
    await Deno.remove(workspace, { recursive: true });
  }
});
```

### Test Data Management

```typescript
// Test data factories
export function createTestUser(overrides?: Partial<User>): User {
  return {
    id: overrides?.id || "test-id",
    email: overrides?.email || "test@example.com",
    createdAt: overrides?.createdAt || new Date(),
    ...overrides,
  };
}

// Test database setup
export async function setupTestDatabase(): Promise<void> {
  const testDb = await Deno.makeTempFile();
  // Setup test database schema
  // Insert test data
}
```

## Performance Testing

### Benchmark Tests

```typescript
Deno.test("entity generation performance", async () => {
  const startTime = performance.now();

  for (let i = 0; i < 1000; i++) {
    defineEntity(createLargeEntity());
  }

  const endTime = performance.now();
  const duration = endTime - startTime;

  // Should complete within reasonable time
  assert(duration < 1000, "Entity generation too slow");
});
```

### Memory Usage Tests

```typescript
Deno.test("memory usage stays within bounds", async () => {
  const initialMemory = getMemoryUsage();

  // Perform memory-intensive operation
  await generateLargeProject();

  const finalMemory = getMemoryUsage();
  const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

  // Memory increase should be reasonable
  assert(memoryIncrease < 100 * 1024 * 1024, "Memory leak detected");
});
```

## Continuous Integration

### Test Execution

```bash
# Run all tests
deno task test

# Run E2E tests
deno task e2e

# Run tests with coverage
deno task test --coverage

# Run performance benchmarks
deno task test --bench
```

### Quality Gates

- All unit tests must pass
- All integration tests must pass
- All E2E tests must pass
- Code coverage must be above threshold
- Performance benchmarks must meet targets
- No memory leaks in long-running tests

## Test Documentation

### Test Documentation Standards

- Each test file should have clear documentation
- Test descriptions should explain what is being tested
- Complex tests should use test steps with descriptions
- Edge cases and error conditions should be documented

### Test Naming Conventions

- Test files: `*.test.ts`
- Test functions: Descriptive names starting with `test` or `should`
- Golden files: In `__golden__/` directories
- Test utilities: In `test-utils/` directories

## Best Practices

### Test Design Principles

1. **Isolation**: Each test should be independent of others
2. **Repeatability**: Tests should produce same results on multiple runs
3. **Clarity**: Test intent should be obvious from name and description
4. **Coverage**: Tests should cover happy paths, edge cases, and error conditions
5. **Maintainability**: Tests should be easy to understand and modify

### Common Test Patterns

- **Arrange-Act-Assert**: Standard test structure
- **Given-When-Then**: BDD-style test structure
- **Test Tables**: Multiple similar test cases with data tables
- **Parameterized Tests**: Tests with multiple input variations

### Error Testing

- Test all error conditions and edge cases
- Verify error messages are clear and actionable
- Test error recovery and cleanup procedures
- Ensure proper exit codes for CLI commands

### Cleanup and Verification

```typescript
// Clean up generated directories after test
Deno.test("cleanup after test", async () => {
  const tempDir = await Deno.makeTempDir();
  const generatedDir = join(tempDir, "generated");

  try {
    // Simulate generation that creates directories
    await Deno.mkdir(generatedDir, { recursive: true });
    await Deno.writeTextFile(join(generatedDir, "artifact.txt"), "content");

    // Verify generation worked
    assert(await exists(generatedDir));
  } finally {
    // Clean up: remove generated directories if they exist
    if (await exists(generatedDir)) {
      await Deno.remove(generatedDir, { recursive: true });
    }
  }
});
```
