# TSera Project Structure

## Repository Organization

TSera follows a monorepo structure with clear separation of concerns:

```
/                         # Root of monorepo
├── deno.jsonc           # Deno tasks, compiler options, import map
├── deno.lock             # Dependency lock file
├── .github/workflows/     # CI/CD workflows
├── src/                  # Source code
│   ├── core/             # Entity system core
│   ├── cli/              # CLI implementation
│   └── shared/          # Shared utilities
├── templates/            # Project scaffolding templates
│   ├── base/            # Base template (always included)
│   └── modules/         # Optional modules
├── .kilocode/           # Kilo Code custom rules
├── .vscode/             # VS Code configuration
├── e2e.test.ts          # End-to-end tests
├── AGENTS.md            # Project development guide
├── README.md            # Project documentation
├── LICENSE              # Apache-2.0 license
└── .tsera/            # Generated artifacts (gitignored)
```

## Core Module Structure

### `src/core/` - Entity System

- `entity.ts` - Core `defineEntity` function and types
- `schema.ts` - Zod schema generation helpers
- `openapi.ts` - OpenAPI document generation
- `drizzle.ts` - Database schema generation
- `secrets.ts` - Type-safe secrets management
- `drizzle-schema.ts` - Drizzle schema utilities
- `index.ts` - Core module exports
- `utils/` - Core utilities (object, strings, zod)
- `tests/` - Unit tests for core functionality
- `secrets/` - Secrets management implementation

### `src/cli/` - CLI Implementation

- `main.ts` - CLI entry point
- `router.ts` - Command routing
- `definitions.ts` - Type definitions for configuration
- `commands/` - Individual command implementations
  - `init/` - Project initialization command
  - `dev/` - Development server command
  - `doctor/` - Project diagnostics command
  - `deploy/` - Deployment commands
  - `update/` - CLI update command
  - `mcp/` - MCP server command
  - `help/` - Help system
- `engine/` - Generation engine (planner, applier, watcher)
  - `artifacts/` - Artifact generators (openapi, zod, drizzle, docs, tests)
  - `tests/` - Engine tests
- `ui/` - CLI UI components (colors, console, formatters)
- `utils/` - CLI utilities (config resolution, file operations)

### `src/shared/` - Shared Utilities

- Cross-cutting utilities used by both core and CLI
- `path.ts` - Path manipulation utilities
- `newline.ts` - Newline handling
- `file-url.ts` - File URL utilities

## Template Structure

### `templates/base/` - Base Template

Always included when initializing a TSera project:

- `deno.jsonc` - Project configuration
- `deno.lock` - Dependency lock file
- `README.md` - Project documentation
- `app/` - Application structure
  - `back/` - Backend application code
  - `db/` - Database configuration and migrations
- `core/` - Entity definitions
  - `entities/` - Entity files
  - `types/` - Shared types
  - `validation/` - Validation schemas
  - `utils/` - Core utilities
- `config/` - Configuration files
  - `db/` - Database configuration
  - `secrets/` - Secrets management

### `templates/modules/` - Optional Modules

Each module is self-contained and optional:

- `hono/` - API framework module
- `fresh/` - Frontend framework module
- `docker/` - Docker configuration module
- `ci/` - CI/CD workflows module
- `secrets/` - Secrets management module
- `cd/` - Continuous deployment workflows

## Generated Output Structure

### `.tsera/` - Generated Artifacts

- `graph.json` - Dependency graph and state
- `manifest.json` - Artifact manifest
- Generated schemas, types, and documentation

### Generated Project Structure

When `tsera init` creates a project:

- `config/` - Configuration files (tsera.config.ts)
- `app/` - Application code (back, front)
- `core/` - Entity definitions
- `docs/` - Generated documentation
- `drizzle/` - Database migrations
- `tests/` - Generated tests

## File Naming Conventions

- **Entity files**: `PascalCase.entity.ts` (e.g., `User.entity.ts`)
- **CLI commands**: `kebab-case.ts` (e.g., `init.ts`, `dev.ts`)
- **Test files**: Same name as source file with `.test.ts` suffix
- **Template files**: Descriptive names matching their purpose
- **Configuration**: `kebab-case.config.ts` (e.g., `tsera.config.ts`)
- **Golden files**: In `__golden__/` directories for snapshots

## Import Organization

1. External dependencies (JSR, npm)
2. Internal modules (`src/`)
3. Relative imports within the same module
4. Type-only imports when possible

## Module Boundaries

- **Core**: No dependencies on CLI, pure entity system
- **CLI**: Can import from core and shared
- **Shared**: No dependencies on core or CLI
- **Templates**: Self-contained, minimal dependencies

## Documentation Placement

- **API docs**: Generated in `docs/` directory
- **Entity docs**: Generated alongside entities
- **CLI help**: Built into CLI commands
- **Development docs**: In repository root (`README.md`, `AGENTS.md`)

## Configuration Files

- **Root `deno.jsonc`**: CLI tool configuration with imports map
- **Project `tsera.config.ts`**: Generated project configuration
- **Import aliases**: Defined in `deno.jsonc` imports section
- **Editor config**: `.editorconfig` for consistent editor settings

## Testing Structure

- **Unit tests**: Co-located with source files in `tests/` subdirectories
- **Integration tests**: In dedicated `tests/` directories
- **E2E tests**: Repository root (`e2e.test.ts`)
- **Golden files**: In `__golden__/` directories for snapshots
- **Test utilities**: In `test-utils/` directories

## Build and Distribution

- **Source**: `src/cli/main.ts` for CLI entry point
- **Compiled**: `dist/tsera` for binary distribution
- **JSR package**: `src/core/index.ts` for library distribution
- **Templates**: Included in CLI for project scaffolding

## Deno Configuration

- **Import map**: Integrated in `deno.jsonc` imports section
- **Tasks**: Defined in `deno.jsonc` tasks section
- **Compiler options**: Strict TypeScript enabled in `deno.jsonc`
- **Linting**: Deno linter configuration in `deno.jsonc`
- **Formatting**: Deno formatter configuration in `deno.jsonc`
