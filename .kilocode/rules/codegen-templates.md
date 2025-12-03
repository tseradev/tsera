# TSera Codegen Templates

## Template Philosophy

TSera templates are **dumb scaffolding templates** that project entity data into generated code.
Templates contain no business logic and serve only as structured placeholders for data insertion.

## Template Organization

### Template Directory Structure

```
templates/
├── base/                    # Base template (always included)
│   ├── deno.jsonc         # Project configuration
│   ├── deno.lock            # Dependency lock file
│   ├── README.md             # Project documentation
│   ├── app/                 # Application structure
│   │   ├── back/           # Backend application code
│   │   ├── db/            # Database client and migrations
│   │   └── front/          # Frontend application code
│   ├── core/                 # Entity definitions
│   │   ├── entities/        # Entity files
│   │   ├── validation/      # Validation schemas
│   │   ├── types/          # Shared types
│   │   └── utils/          # Core utilities
│   ├── config/               # Configuration files
│   │   ├── db/            # Database configuration
│   │   ├── secrets/       # Secrets management
│   │   └── tsera.config.ts # TSera configuration
│   └── test-utils/          # Testing utilities
└── modules/               # Optional modules
    ├── hono/               # API framework module
    ├── fresh/              # Frontend framework module
    ├── docker/             # Docker configuration module
    ├── ci/                 # CI/CD workflows module
    ├── secrets/            # Secrets management module
    └── cd/                 # Continuous deployment workflows
```

## Template Standards

### File Naming Conventions

- **Template files**: Descriptive names matching their purpose
- **Generated files**: Consistent naming patterns
- **Configuration files**: `kebab-case.config.ts` format
- **Documentation**: Clear headers and structure

### Template Syntax

- **Variable Substitution**: Use `{{variable}}` syntax for placeholders
- **Conditional Blocks**: Use `{{#if condition}}...{{/if}}` for conditional content
- **Loops**: Use `{{#each items}}...{{/each}}` for iteration
- **Partials**: Reusable template fragments

## Base Template Standards

### Core Files

#### deno.jsonc

```jsonc
{
  "compilerOptions": {
    "strict": true
  },
  "fmt": {
    "useTabs": false,
    "lineWidth": 100,
    "indentWidth": 2
  },
  "lint": {
    "rules": {
      "tags": ["recommended"]
    }
  },
  "imports": {
    "hono": "hono",
    "fresh": "fresh",
    "zod": "zod"
  },
  "tasks": {
    "dev": "deno run -A app/back/main.ts",
    "fmt": "deno fmt",
    "lint": "deno lint",
    "test": "deno test -A"
  }
}
```

#### tsera.config.ts

````typescript
/**
 * TSera Configuration
 *
 * Complete configuration for TSera project.
 * Generated with full profile and comments.
 *
 * @example
 * ```typescript
 * export default {
 *   openapi: true,
 *   docs: true,
 *   tests: true,
 *   telemetry: false,
 *   outDir: ".tsera",
 *   paths: { entities: ["core/entities"] },
 *   db: {
 *     dialect: "postgres",
 *     urlEnv: "DATABASE_URL",
 *     ssl: "prefer"
 *   },
 *   deploy: {
 *     target: "deno_deploy",
 *     entry: "app/back/main.ts"
 *   }
 * };
 * ```
 */
export default {
  openapi: true,
  docs: true,
  tests: true,
  telemetry: false,
  outDir: ".tsera",
  paths: { entities: ["core/entities"] },
  db: {
    dialect: "postgres",
    urlEnv: "DATABASE_URL",
    ssl: "prefer",
  },
  deploy: {
    target: "deno_deploy",
    entry: "app/back/main.ts",
  },
};
````

### Entity Template

#### User.entity.ts

```typescript
import { defineEntity } from "tsera/core/entity.ts";
import { z } from "zod";

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
      db: { unique: true },
    },
    createdAt: {
      validator: z.date(),
      description: "Creation timestamp",
      immutable: true,
      db: { defaultNow: true },
    },
  },
});
```

## Module Templates

### Hono Module Template

#### app/back/main.ts

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// Middleware
app.use("*", cors());

// Routes
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default {
  port: 3000,
  fetch: app.fetch,
};
```

#### app/back/routes/health.ts

```typescript
import { z } from "zod";

const HealthSchema = z.object({
  status: z.string(),
  timestamp: z.date(),
});

export const healthHandler = () => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
};
```

### Fresh Module Template

#### app/web/main.ts

```typescript
import { fresh } from "fresh";

const handler = async (req: Request) => {
  return new Response("Hello from Fresh!", {
    headers: { "Content-Type": "text/html" },
  });
};

if (import.meta.main) {
  await fresh(handler, {
    port: 8000,
  });
}
```

#### app/web/routes/index.tsx

```typescript
import { useState } from "preact/hooks";

export default function Home() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>Welcome to TSera</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}
```

### Docker Module Template

#### docker-compose.yml

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@localhost:5432/tsera
      - PORT=3000
```

#### Dockerfile

```dockerfile
FROM denoland/deno:latest

WORKDIR /app

COPY deno.jsonc deno.lock ./
COPY . .

RUN deno cache --lock=deno.lock --lock-write

EXPOSE 3000

CMD ["run", "--allow-net", "app/back/main.ts"]
```

### CI Module Template

#### ci-lint.yml

```yaml
name: CI Lint

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
      - run: deno fmt --check
      - run: deno lint
```

#### ci-test.yml

```yaml
name: CI Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
      - run: deno test -A --unstable-kv
```

## Template Variables

### Standard Variables

- **projectName**: Project name (PascalCase)
- **projectNameKebab**: Project name (kebab-case)
- **projectDescription**: Project description
- **authorName**: Author name
- **authorEmail**: Author email
- **databaseUrl**: Database connection URL
- **databaseDialect**: Database type (postgres/mysql/sqlite)

### Entity Variables

- **entityName**: Entity name (PascalCase)
- **entityNamePlural**: Entity name plural
- **entityNameKebab**: Entity name (kebab-case)
- **fields**: Array of entity field definitions
- **tableName**: Database table name

### Configuration Variables

- **openapiEnabled**: Boolean for OpenAPI generation
- **docsEnabled**: Boolean for documentation generation
- **testsEnabled**: Boolean for test generation
- **telemetryEnabled**: Boolean for telemetry
- **outDir**: Output directory for generated artifacts

## Template Processing

### Variable Substitution

```typescript
// Simple variable replacement
function processTemplate(template: string, variables: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, "g"), value);
  }

  return result;
}
```

### Conditional Processing

```typescript
// Conditional template processing
function processConditionals(template: string): string {
  // Process {{#if condition}}...{{/if}} blocks
  const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

  return template.replace(ifRegex, (match, condition, content) => {
    if (variables[condition]) {
      return content;
    }
    return "";
  });
}
```

### Loop Processing

```typescript
// Loop template processing
function processLoops(template: string): string {
  // Process {{#each items}}...{{/each}} blocks
  const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  return template.replace(eachRegex, (match, itemName, content) => {
    const items = variables[itemName] as any[];
    if (!Array.isArray(items)) return "";

    return items.map((item) =>
      content.replace(/\{\{(\w+)\}\}/g, (fieldMatch) => {
        const fieldName = fieldMatch[1];
        return item[fieldName] || "";
      })
    ).join("");
  });
}
```

## Template Validation

### Template Syntax Validation

```typescript
// Validate template syntax before processing
function validateTemplate(template: string): TemplateValidationResult {
  const errors: string[] = [];

  // Check for unmatched conditionals
  const openIfs = (template.match(/\{\{#if/g) || []).length;
  const closeIfs = (template.match(/\{\{\/if\}/g) || []).length;

  if (openIfs !== closeIfs) {
    errors.push("Unmatched conditional blocks");
  }

  // Check for unmatched loops
  const openEaches = (template.match(/\{\{#each/g) || []).length;
  const closeEaches = (template.match(/\{\{\/each\}/g) || []).length;

  if (openEaches !== closeEaches) {
    errors.push("Unmatched loop blocks");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

### Template Context Building

```typescript
// Build template context from entity definitions
function buildTemplateContext(entities: Entity[]): TemplateContext {
  return {
    entities: entities.map((entity) => ({
      name: entity.name,
      className: entity.name,
      tableName: entity.table ? `${entity.name.toLowerCase()}s` : undefined,
      fields: Object.entries(entity.fields).map(([name, field]) => ({
        name,
        type: getFieldType(field.validator),
        description: field.description,
        required: !field.validator._def.type.includes("Optional"),
        nullable: field.validator._def.type.includes("Nullable"),
      })),
    })),
    timestamp: new Date().toISOString(),
    version: metadata.version,
  };
}
```

## Template Generation

### File Generation

```typescript
// Generate file from template
export async function generateFile(
  templatePath: string,
  outputPath: string,
  variables: Record<string, string>
): Promise<void> {
  const template = await Deno.readTextFile(templatePath);
  const processed = processTemplate(template, variables);
  
  await ensureDirectoryExists(dirname(outputPath));
  await Deno.writeTextFile(outputPath, processed);
}

// Generate directory from template
export async function generateDirectory(
  templateDir: string,
  outputDir: string,
  variables: Record<string, string>
): Promise<void> {
  await ensureDirectoryExists(outputDir);
  
  for await Deno.readDir(templateDir) {
    if (entry.isFile) {
      const template = await Deno.readTextFile(join(templateDir, entry.name));
      const outputPath = join(outputDir, entry.name);
      const processed = processTemplate(template, variables);
      await Deno.writeTextFile(outputPath, processed);
    }
  }
}
```

## Best Practices

### Template Design

1. **Keep It Simple**: Templates should be dumb and focused
2. **No Logic**: Templates should not contain business logic
3. **Clear Variables**: Use descriptive variable names
4. **Consistent Syntax**: Use consistent template syntax
5. **Validation**: Validate templates before use

### Template Maintenance

1. **Version Control**: Keep templates under version control
2. **Testing**: Test templates with sample data
3. **Documentation**: Document template variables and structure
4. **Modularity**: Design templates to be composable
5. **Performance**: Optimize template processing for large projects

### Security Considerations

1. **Input Validation**: Validate all template variables
2. **Path Security**: Prevent directory traversal in templates
3. **Code Injection**: Use secure template processing
4. **Output Sanitization**: Sanitize generated file content
5. **Permission Handling**: Respect file system permissions

### Template Testing

```typescript
// Test template generation
Deno.test("template generation", async () => {
  const entities = [createTestEntity()];
  const context = buildTemplateContext(entities);

  const result = await generateFile(
    "templates/base/app/back/main.ts.template",
    "generated/app/back/main.ts",
    context,
  );

  assert(await exists("generated/app/back/main.ts"));
});
```

## Integration Points

### CLI Integration

```typescript
// Template discovery and loading
export async function loadTemplate(templateName: string): Promise<string> {
  const templatePath = join(templatesDir, templateName);
  return await Deno.readTextFile(templatePath);
}

// Template composition for project generation
export async function composeProject(
  projectDir: string,
  options: ProjectOptions,
): Promise<void> {
  const entities = await discoverEntities(projectDir);
  const context = buildTemplateContext(entities);

  // Generate base files
  await generateDirectory("templates/base", projectDir, context);

  // Generate module files
  if (options.modules?.hono) {
    await generateDirectory("templates/modules/hono", projectDir, context);
  }

  if (options.modules?.fresh) {
    await generateDirectory("templates/modules/fresh", projectDir, context);
  }
}
```

### Engine Integration

```typescript
// Template processing in generation engine
export async function processTemplate(
  template: string,
  context: TemplateContext,
): Promise<string> {
  const validation = validateTemplate(template);

  if (!validation.isValid) {
    throw new Error(`Template validation failed: ${validation.errors.join(", ")}`);
  }

  const processed = processTemplate(template, context.variables);
  return processed;
}
```
