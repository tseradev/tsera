/**
 * @module export-env
 * Export environment variables command for TSera CLI.
 *
 * This module provides a CLI command for exporting environment variables
 * in various formats suitable for runtime configuration.
 *
 * ## Supported Formats
 *
 * - **sh**: Shell dotenv format (KEY=value) for sourcing or .env files
 * - **json**: JSON format for programmatic consumption
 *
 * ## Output Modes
 *
 * - **Console mode** (default): Outputs raw content only, no status messages
 * - **File mode** (--file): Writes to `config/secrets/<file>` with status messages and spinner
 *
 * ## Security Considerations
 *
 * - Values are never logged in plain text (only written to files or stdout)
 * - Validation errors show only variable names, not values
 *
 * ## Usage Examples
 *
 * ```bash
 * # Export to console in shell format (raw output)
 * tsera export-env --format sh --env prod
 *
 * # Export to file in config/secrets/
 * tsera export-env --format sh --file .env.prod --env prod
 *
 * # Export to JSON for programmatic use
 * tsera export-env --format json
 *
 * # Export to JSON file in config/secrets/
 * tsera export-env --format json --file secrets.json --env prod
 * ```
 */

import { Command } from "cliffy/command";
import {
  type EnvName,
  type EnvSchema,
  isValidEnvName,
  parseEnvFile,
  validateSecrets,
} from "../../../core/secrets.ts";
import { join } from "../../../shared/path.ts";
import type { GlobalCLIOptions } from "../../router.ts";
import { safeWrite } from "../../utils/fsx.ts";
import { createLogger, type Logger } from "../../utils/log.ts";
import { renderCommandHelp } from "../help/command-help-renderer.ts";
import { ExportEnvConsole } from "./export-env-ui.ts";

/**
 * Supported export formats for environment variables.
 *
 * - `sh`: Shell dotenv format (KEY=value), outputs to stdout or file
 * - `json`: JSON format (compact for console, pretty for file)
 */
export type ExportFormat = "sh" | "json";

/**
 * CLI options accepted by the {@code export-env} command.
 * @internal
 */
type ExportEnvCommandOptions = GlobalCLIOptions & {
  env: string;
  format: ExportFormat;
  prefix: string;
  file?: string;
};

/**
 * Options passed to the export-env action handler by Cliffy.
 * @internal
 */
type ExportEnvActionOptions = {
  json?: boolean;
  env?: string;
  format?: string;
  prefix?: string;
  file?: string;
};

/**
 * Context object passed to export-env command handlers.
 */
export type ExportEnvContext = {
  /** Target environment (dev/staging/prod). */
  env: EnvName;
  /** Export format. */
  format: ExportFormat;
  /** Prefix to add to exported variable names. */
  prefix: string;
  /** Output file name (written in config/secrets/, enables verbose mode with status messages). */
  file?: string;
  /** Current working directory. */
  cwd: string;
  /** Global CLI options. */
  global: GlobalCLIOptions;
};

/**
 * Function signature for export-env command implementations.
 */
export type ExportEnvHandler = (context: ExportEnvContext) => Promise<void> | void;

/**
 * Dependencies for the export-env command handler.
 * @internal
 */
export type ExportEnvDependencies = {
  /** Optional exit function for testing. */
  exit?: (code: number) => never;
  /** Optional file reader for testing. */
  readTextFile?: (path: string) => Promise<string>;
  /** Optional file writer for testing. */
  writeTextFile?: (path: string, data: string) => Promise<void>;
  /** Optional console UI for testing. */
  console?: ExportEnvConsole;
  /** Optional logger for testing. */
  logger?: Logger;
  /** Optional writer for output. */
  writer?: (line: string) => void;
  /** Optional environment getter for testing. */
  getEnv?: (key: string) => string | undefined;
};

/**
 * Interface for the dynamically imported env config module.
 * @internal
 */
interface EnvConfigModule {
  default?: EnvSchema;
  envSchema?: EnvSchema;
  schema?: EnvSchema;
}

/**
 * Loads environment schema from config/secrets/env.config.ts.
 *
 * Attempts to load the environment schema from the default location.
 * Returns null if the file does not exist (graceful degradation).
 *
 * @param cwd - Current working directory
 * @param _readTextFile - Unused, kept for API compatibility
 * @returns The loaded environment schema or null if not found
 * @throws Error for file system errors other than NotFound
 *
 * @example
 * ```ts
 * const schema = await loadSchema(Deno.cwd());
 * if (!schema) {
 *   console.error("Schema not found");
 *   Deno.exit(1);
 * }
 * ```
 */
export async function loadSchema(
  cwd: string,
  _readTextFile?: (path: string) => Promise<string>,
): Promise<EnvSchema | null> {
  try {
    const schemaPath = join(cwd, "config", "secrets", "env.config.ts");
    const module = await import(`file://${schemaPath}`) as EnvConfigModule;
    return module.default || module.envSchema || module.schema || null;
  } catch (error) {
    // Handle both Deno.errors.NotFound and TypeError from dynamic import
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    // Dynamic import throws TypeError with "Module not found" for missing files
    if (error instanceof TypeError && error.message.includes("Module not found")) {
      return null;
    }
    throw error;
  }
}

/**
 * Exports environment variables to shell dotenv format.
 *
 * Outputs KEY=value lines, suitable for .env files or shell sourcing.
 * Values containing special characters are quoted appropriately.
 *
 * @param secrets - Environment variables to export
 * @param write - Function to write output
 *
 * @example
 * ```ts
 * exportToSh({ DATABASE_URL: "postgres://...", PORT: "5432" }, console.log);
 * // Output:
 * // DATABASE_URL=postgres://...
 * // PORT=5432
 * ```
 */
function exportToSh(
  secrets: Record<string, string>,
  write: (line: string) => void = console.log,
): void {
  for (const [key, value] of Object.entries(secrets)) {
    // Quote values that contain spaces, quotes, or special characters
    if (
      value.includes(" ") || value.includes('"') || value.includes("'") ||
      value.includes("\n") || value.includes("\t")
    ) {
      // Escape double quotes and backslashes
      const escapedValue = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      write(`${key}="${escapedValue}"`);
    } else {
      write(`${key}=${value}`);
    }
  }
}

/**
 * Exports environment variables to JSON format.
 *
 * @param secrets - Environment variables to export
 * @param write - Function to write output
 * @param compact - Whether to output compact (single-line) JSON
 *
 * @example
 * ```ts
 * // Compact format (for console)
 * exportToJson({ DATABASE_URL: "postgres://...", PORT: "5432" }, console.log, true);
 * // Output: {"DATABASE_URL":"postgres://...","PORT":"5432"}
 *
 * // Pretty format (for files)
 * exportToJson({ DATABASE_URL: "postgres://...", PORT: "5432" }, console.log, false);
 * // Output:
 * // {
 * //   "DATABASE_URL": "postgres://...",
 * //   "PORT": "5432"
 * // }
 * ```
 */
function exportToJson(
  secrets: Record<string, string>,
  write: (line: string) => void = console.log,
  compact: boolean = true,
): void {
  if (compact) {
    write(JSON.stringify(secrets));
  } else {
    write(JSON.stringify(secrets, null, 2));
  }
}

/**
 * Creates the default export-env command handler.
 *
 * @param dependencies - Optional dependencies for testing
 * @returns The command handler function
 */
export function createDefaultExportEnvHandler(
  dependencies: ExportEnvDependencies = {},
): ExportEnvHandler {
  const exitFn = dependencies.exit ?? ((code: number): never => Deno.exit(code));
  const readTextFile = dependencies.readTextFile ?? Deno.readTextFile;
  const getEnv = dependencies.getEnv ?? ((key: string) => Deno.env.get(key));

  return async (context: ExportEnvContext) => {
    const jsonMode = context.global.json ?? false;
    const logger = dependencies.logger ??
      createLogger({ json: jsonMode, writer: dependencies.writer });

    // Determine if we're in verbose mode (file output or json mode)
    const hasFile = context.file !== undefined;
    const verboseMode = hasFile || jsonMode;

    const human = verboseMode
      ? (dependencies.console ?? new ExportEnvConsole({ writer: dependencies.writer }))
      : null;

    const { env, format, prefix, file, cwd } = context;

    // Start event (only in verbose mode)
    if (jsonMode) {
      logger.event("export-env:start", { env, format, prefix, file: file ?? null });
    } else if (verboseMode) {
      human?.start(env, format);
    }

    // Validate format
    const validFormats: ExportFormat[] = ["sh", "json"];
    if (!validFormats.includes(format)) {
      const error = `Invalid format "${format}". Accepted values: sh, json`;
      if (jsonMode) {
        logger.event("export-env:error", { error, type: "usage" });
      } else if (verboseMode) {
        human?.error(error);
      } else {
        console.error(error);
      }
      return exitFn(2); // Usage error
    }

    // Load schema
    const schema = await loadSchema(cwd, readTextFile);
    if (!schema) {
      const error =
        "config/secrets/env.config.ts not found. Please ensure that secrets module is installed.";
      if (jsonMode) {
        logger.event("export-env:error", { error, type: "schema" });
      } else if (verboseMode) {
        human?.error(error);
      } else {
        console.error(error);
      }
      return exitFn(1); // General error
    }

    // Schema loaded
    const schemaKeys = Object.keys(schema);
    if (jsonMode) {
      logger.event("export-env:schema", { count: schemaKeys.length });
    } else if (verboseMode) {
      human?.schemaLoaded(schemaKeys.length);
    }

    // Load .env file from config/secrets/.env.{env}
    const envFilePath = join(cwd, "config", "secrets", `.env.${env}`);
    const fileEnv = await parseEnvFile(envFilePath);

    // Get secrets from environment - build for ALL schema keys
    // Priority: process environment > .env file
    const secrets: Record<string, string | undefined> = {};
    for (const key of schemaKeys) {
      // First check process environment, then fall back to .env file
      const envValue = getEnv(key);
      secrets[key] = envValue ?? fileEnv[key];
    }

    // Validate secrets (strict mode only)
    const errors = validateSecrets(secrets, schema, env);
    if (errors.length > 0) {
      if (jsonMode) {
        logger.event("export-env:error", { errors, type: "validation" });
      } else if (verboseMode) {
        human?.error("Validation failed");
        human?.validationErrors(errors);
      } else {
        // Console mode: just output errors
        console.error("Validation failed:");
        for (const error of errors) {
          console.error(`  - ${error}`);
        }
      }
      return exitFn(1); // General error
    }

    // Exporting (only in verbose mode)
    if (jsonMode) {
      logger.event("export-env:exporting", { format });
    } else if (verboseMode) {
      human?.exporting(format);
    }

    // Apply prefix and filter undefined
    const prefixedSecrets: Record<string, string> = {};
    for (const [key, value] of Object.entries(secrets)) {
      if (value !== undefined) {
        prefixedSecrets[`${prefix}${key}`] = value;
      }
    }

    // Export according to format
    try {
      if (file) {
        // Write to file in config/secrets/
        const outputPath = join(cwd, "config", "secrets", file);
        let content: string;

        switch (format) {
          case "sh": {
            const lines: string[] = [];
            exportToSh(prefixedSecrets, (line) => lines.push(line));
            content = lines.join("\n") + "\n";
            break;
          }
          case "json":
            content = JSON.stringify(prefixedSecrets, null, 2) + "\n";
            break;
          default:
            throw new Error(`Unsupported format: ${format}`);
        }

        await safeWrite(outputPath, content);
      } else {
        // Console output (raw, no decoration)
        const writer = dependencies.writer ?? console.log;
        switch (format) {
          case "sh":
            exportToSh(prefixedSecrets, writer);
            break;
          case "json":
            exportToJson(prefixedSecrets, writer, true); // Compact for console
            break;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (jsonMode) {
        logger.event("export-env:error", { error: message, type: "export" });
      } else if (verboseMode) {
        human?.error(message);
      } else {
        console.error(message);
      }
      return exitFn(1); // General error
    }

    // Success (only in verbose mode)
    const count = Object.keys(prefixedSecrets).length;
    if (jsonMode) {
      logger.event("export-env:success", { count, format, file: file ?? null });
    } else if (verboseMode) {
      if (file) {
        const outputPath = join(cwd, "config", "secrets", file);
        human?.fileSuccess(outputPath, count, format);
      } else {
        human?.success(count, format);
      }
    }
  };
}

/**
 * Constructs the Cliffy command definition for {@code tsera export-env}.
 *
 * The command supports the following options:
 * - `--env <env>`: Target environment (dev|staging|prod), defaults to TSERA_ENV or "dev"
 * - `--format <format>`: Export format (sh|json), required
 * - `--prefix <prefix>`: Optional prefix to add to all exported variable names
 * - `--file <name>`: Output file name (written to config/secrets/, enables status messages)
 * - `--json`: Output machine-readable NDJSON events
 *
 * @param handler - Optional export-env command handler (defaults to {@link createDefaultExportEnvHandler})
 * @returns Configured Cliffy command ready for parsing
 *
 * @example
 * ```typescript
 * const command = createExportEnvCommand();
 * await command.parse(["--format", "json"]);
 * ```
 */
export function createExportEnvCommand(
  handler: ExportEnvHandler = createDefaultExportEnvHandler(),
) {
  const command = new Command()
    .name("export-env")
    .description("Export environment variables for runtime or CI/CD pipelines.")
    .option("--env <env:string>", "Target environment (dev|staging|prod).", {
      default: () => Deno.env.get("TSERA_ENV") || "dev",
    })
    .option(
      "--format <format:string>",
      "Export format (sh|json).",
      {
        required: true,
      },
    )
    .option("--prefix <prefix:string>", "Prefix to add to exported variable names.", {
      default: "",
    })
    .option(
      "-o, --file <name:string>",
      "Output file name (written to config/secrets/, enables status messages).",
    )
    .action(async (options: ExportEnvActionOptions) => {
      const { json = false, env: envValue, format, prefix = "", file } = options;

      // Validate environment
      const env = envValue ?? Deno.env.get("TSERA_ENV") ?? "dev";
      if (!isValidEnvName(env)) {
        console.error(
          `Error: invalid environment "${env}". Accepted values: dev, staging, prod`,
        );
        Deno.exit(2); // Usage error
      }

      // Validate format
      const validFormats: ExportFormat[] = ["sh", "json"];
      if (!format || !validFormats.includes(format as ExportFormat)) {
        console.error(
          `Error: invalid format "${format}". Accepted values: sh, json`,
        );
        Deno.exit(2); // Usage error
      }

      await handler({
        env,
        format: format as ExportFormat,
        prefix,
        file,
        cwd: Deno.cwd(),
        global: { json },
      });
    });

  // Apply modern help rendering
  const originalShowHelp = command.showHelp.bind(command);
  command.showHelp = () => {
    try {
      console.log(
        renderCommandHelp({
          commandName: "export-env",
          description: "Export environment variables for runtime or CI/CD pipelines.",
          options: [
            {
              label: "--env <env>",
              description: "Target environment (dev|staging|prod). Default: dev",
            },
            {
              label: "--format <format>",
              description: "Export format (sh|json). Required",
            },
            {
              label: "--prefix <prefix>",
              description: "Filter variables by prefix",
            },
            {
              label: "--file, -o <name>",
              description: "Output file name (written to config/secrets/)",
            },
            {
              label: "--json",
              description: "Output machine-readable NDJSON events",
            },
          ],
          examples: [
            "tsera export-env --format sh --env dev",
            "tsera export-env --format json --env prod",
            "tsera export-env --format sh --file .env.prod --env prod --json",
            "tsera export-env --format sh --file secrets.txt --env prod --prefix 'export '",
          ],
        }),
      );
    } catch {
      originalShowHelp();
    }
  };

  return command;
}

/**
 * Export environment variables command (legacy export for backwards compatibility).
 *
 * @deprecated Use {@link createExportEnvCommand} instead.
 */
export const exportEnvCommand = createExportEnvCommand();
