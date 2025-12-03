# TSera CLI Conventions

## CLI Architecture

TSera CLI is built with **Cliffy** framework and follows modular command structure. Each command is
self-contained with its own UI, logic, and tests.

## Command Structure

### Basic Command Template

```typescript
import { Command } from "cliffy/command";
import { TseraConfig } from "tsera/cli/definitions.ts";

const command = new Command()
  .name("my-command")
  .description("Description of what the command does")
  .option("--option", "Option description", { default: defaultValue })
  .option("-f, --flag", "Flag description")
  .action(async (options) => {
    // Command implementation
  });

export default command;
```

### Command File Organization

```
src/cli/commands/
├── init/
│   ├── init.ts           # Main command logic
│   ├── init-ui.ts        # User interface components
│   ├── init.test.ts      # Tests
│   └── utils/           # Command-specific utilities
├── dev/
├── doctor/
├── deploy/
├── update/
├── mcp/
└── help/
```

## Global Options

### Standard Global Options

All TSera commands must support these global options:

#### `--json` - NDJSON Output

- **Purpose**: Enable machine-readable output for CI/automation
- **Format**: NDJSON (one JSON object per line)
- **Usage**: `tsera command --json`
- **Implementation**: Wrap all console output in NDJSON format

#### `-h, --help` - Help Display

- **Purpose**: Show command help and usage
- **Format**: Consistent help formatting across all commands
- **Implementation**: Use Cliffy's built-in help system

#### `-V, --version` - Version Display

- **Purpose**: Display CLI version
- **Format**: `TSera CLI X.Y.Z`
- **Implementation**: Exit after displaying version

### Global Option Implementation

```typescript
const JSON_OPTION_DESC = "Enable NDJSON output for automation";

const root = new Command()
  .name(CLI_NAME)
  .description("TSera CLI — The next era of fullstack TypeScript starts here.")
  .globalOption("--json", JSON_OPTION_DESC, { default: false })
  .globalOption("-v, -V, --version", "Display CLI version.", {
    override: true,
    action: () => {
      console.log(`TSera CLI ${metadata.version}`);
      Deno.exit(0);
    },
  });
```

## Command Implementation Patterns

### Error Handling

```typescript
// Standard error handling pattern
try {
  // Command logic
  await executeCommand(options);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Error: ${error.message}`);
    Deno.exit(2); // Usage error
  } else if (error instanceof FileSystemError) {
    console.error(`File system error: ${error.message}`);
    Deno.exit(1); // General error
  } else {
    console.error(`Unexpected error: ${error.message}`);
    Deno.exit(1);
  }
}
```

### Exit Codes

- **0**: Success
- **1**: General error (file system, network, validation)
- **2**: Usage error (invalid arguments, missing required options)

### Progress Indicators

```typescript
// Use spinner for long operations
import { spinner } from "tsera/ui/spinner.ts";

const s = spinner("Generating artifacts...");
try {
  await generateArtifacts();
  s.succeed("Artifacts generated successfully");
} catch (error) {
  s.fail(`Generation failed: ${error.message}`);
}
```

## Command-Specific Conventions

### `tsera init` Command

#### Purpose

Initialize a new TSera project from templates with selected modules.

#### Options

- `[directory]`: Target directory (default: `.`)
- `--template <name>`: Base template to use (default: "base")
- `--no-hono`: Exclude Hono API framework
- `--no-fresh`: Exclude Fresh frontend framework
- `--no-docker`: Exclude Docker configuration
- `--no-ci`: Exclude CI/CD workflows
- `--no-secrets`: Exclude secrets management
- `-f, --force`: Overwrite existing files
- `-y, --yes`: Non-interactive mode

#### Implementation Pattern

```typescript
.action(async (options) => {
  const projectDir = resolve(options.directory || ".");
  
  // Check for existing project
  if (await exists(join(projectDir, "tsera.config.ts")) {
    if (!options.force) {
      console.error("Project already exists. Use --force to overwrite.");
      Deno.exit(2);
    }
  }
  
  // Generate project
  await initializeProject(projectDir, options);
  console.log(`Project initialized in ${projectDir}`);
});
```

### `tsera dev` Command

#### Purpose

Run continuous coherence loop with watch → plan → apply cycle.

#### Options

- `[projectDir]`: Project directory (default: `.`)
- `--apply`: Force application even if plan is empty

#### Implementation Pattern

```typescript
.action(async (options) => {
  const projectDir = resolve(options.projectDir || ".");
  const config = await loadConfig(projectDir);
  
  if (!config) {
    console.error("No TSera project found.");
    Deno.exit(2);
  }
  
  // Start watch loop
  await startDevServer(projectDir, config, options);
});
```

### `tsera doctor` Command

#### Purpose

Diagnose project coherence and optionally fix issues.

#### Options

- `--cwd <path>`: Project directory (default: `.`)
- `--quick`: Quick validation mode
- `--fix`: Apply automatic fixes

#### Implementation Pattern

```typescript
.action(async (options) => {
  const projectDir = resolve(options.cwd || ".");
  const diagnosis = await diagnoseProject(projectDir);
  
  if (options.quick) {
    console.log(formatQuickDiagnosis(diagnosis));
    Deno.exit(diagnosis.issues.length > 0 ? 1 : 0);
  }
  
  console.log(formatFullDiagnosis(diagnosis));
  
  if (options.fix) {
    await applyFixes(projectDir, diagnosis.fixableIssues);
    console.log("Applied automatic fixes.");
  }
  
  Deno.exit(diagnosis.criticalIssues.length > 0 ? 2 : 0);
});
```

### `tsera update` Command

#### Purpose

Update TSera CLI tool (install vs binary).

#### Options

- `--channel <channel>`: Release channel (stable|beta|canary)
- `--binary`: Install binary instead of deno install
- `--dry-run`: Show steps without applying

#### Implementation Pattern

```typescript
.action(async (options) => {
  const updatePlan = await createUpdatePlan(options);
  
  if (options.dryRun) {
    console.log(formatDryRun(updatePlan));
    return;
  }
  
  await executeUpdate(updatePlan);
  console.log("TSera updated successfully");
});
```

## UI Conventions

### Console Output

```typescript
// Use consistent formatting
import { colors } from "tsera/ui/colors.ts";

console.log(colors.blue("✓") + " Operation completed");
console.log(colors.red("✗") + " Operation failed");
console.log(colors.yellow("⚠") + " Warning message");
```

### User Interaction

```typescript
// Use Cliffy prompts for interactive input
import { Confirm, Input, Select } from "cliffy/prompt";

const projectName = await Input.prompt({
  message: "Project name:",
  validate: (input) => input.length > 0,
});

const useTypeScript = await Confirm.ask({
  message: "Use TypeScript?",
  default: true,
});
```

### Progress Reporting

```typescript
// Structured progress reporting
interface ProgressStep {
  step: string;
  status: "running" | "completed" | "failed";
  message?: string;
}

function reportProgress(step: ProgressStep) {
  if (options.json) {
    console.log(JSON.stringify(step));
  } else {
    const icon = step.status === "completed" ? "✓" : step.status === "failed" ? "✗" : "⟳";
    console.log(`${icon} ${step.step}${step.message ? `: ${step.message}` : ""}`);
  }
}
```

## File Operations

### Configuration Resolution

```typescript
// Standard config loading pattern
export async function loadConfig(projectDir: string): Promise<TseraConfig | null> {
  const configPath = join(projectDir, "config", "tsera.config.ts");

  if (!await exists(configPath)) {
    return null;
  }

  try {
    const configContent = await Deno.readTextFile(configPath);
    return validateConfig(configContent);
  } catch (error) {
    throw new Error(`Failed to load config: ${error.message}`);
  }
}
```

### Safe File Writing

```typescript
// Atomic file operations
export async function safeWrite(path: string, content: string): Promise<void> {
  const tempPath = `${path}.tmp.${Date.now()}`;

  try {
    await Deno.writeTextFile(tempPath, content);
    await Deno.rename(tempPath, path);
  } catch (error) {
    await Deno.remove(tempPath).catch(() => {});
    throw error;
  }
}
```

## Testing Conventions

### Command Testing

```typescript
// Standard test structure
Deno.test("init command creates project", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    await runCommand(["init", "test-project"], { cwd: tempDir });

    // Verify generated files
    assert(await exists(join(tempDir, "test-project", "config", "tsera.config.ts")));
    assert(await exists(join(tempDir, "test-project", "core", "entities")));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
```

### Golden Files

```typescript
// Snapshot testing for generated content
const goldenConfig = await Deno.readTextFile(
  join(import.meta.dirname!, "__golden__", "tsera.config.ts"),
);

const generatedConfig = await generateConfig(options);
assertEquals(
  normalizeConfig(generatedConfig),
  normalizeConfig(goldenConfig),
);
```

## Help System

### Command Help Structure

```typescript
// Consistent help formatting
function formatCommandHelp(command: Command): string {
  const options = command.getOptions();
  const optionsText = options.map((opt) =>
    `  ${opt.flags.join(", ")}${opt.description ? ` - ${opt.description}` : ""}`
  ).join("\n");

  return `
Usage: tsera ${command.getName()} [options]

Options:
${optionsText}

Examples:
  tsera ${command.getName()} --help
  tsera ${command.getName()} --option value
  `.trim();
}
```

### Global Help

```typescript
// Main help command showing all available commands
function showGlobalHelp() {
  const commands = [
    { name: "init", description: "Initialize new project" },
    { name: "dev", description: "Start development server" },
    { name: "doctor", description: "Diagnose project issues" },
    { name: "update", description: "Update CLI tool" },
  ];

  console.log("TSera CLI — The next era of fullstack TypeScript starts here.\n");
  console.log("Commands:");

  commands.forEach((cmd) => {
    console.log(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
  });

  console.log("\nUse 'tsera <command> --help' for more information on a specific command.");
}
```

## Performance Guidelines

### Startup Performance

- Minimize imports on command initialization
- Lazy load heavy dependencies
- Use conditional imports for optional features
- Cache expensive operations

### Memory Usage

- Avoid loading large files into memory
- Use streams for file processing
- Clean up resources properly
- Monitor memory usage in long-running commands

### Error Recovery

- Provide clear error messages with actionable guidance
- Include suggestions for fixing common issues
- Use appropriate exit codes for automation
- Log errors for debugging without exposing sensitive data

## Integration Patterns

### Command Registration

```typescript
// Register all commands in router
import initCommand from "./commands/init/init.ts";
import devCommand from "./commands/dev/dev.ts";
import doctorCommand from "./commands/doctor/doctor.ts";

export function registerCommands(): Command {
  return new Command()
    .name("tsera")
    .description("TSera CLI")
    .command(initCommand)
    .command(devCommand)
    .command(doctorCommand)
    // ... other commands
    .action(() => showGlobalHelp());
}
```

### Plugin System

- Commands should be self-contained and modular
- Use dependency injection for shared services
- Provide clear interfaces for command extensions
- Support command discovery and registration

## Security Considerations

### Input Validation

- Validate all user inputs before processing
- Sanitize file paths to prevent directory traversal
- Check permissions before file operations
- Never execute arbitrary commands

### Sensitive Data

- Never log passwords, tokens, or secrets
- Mask sensitive values in error messages
- Use secure prompts for sensitive input
- Clear sensitive data from memory when done

### File System Security

- Restrict operations to project directory
- Check file permissions before reading/writing
- Use atomic operations to prevent corruption
- Backup important files before modification
