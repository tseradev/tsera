/**
 * @module export-env
 * Export environment variables command for TSera CLI.
 */

import { Command } from "cliffy/command";
import {
  type EnvConfigSchema,
  type EnvName,
  isValidEnvName,
  parseEnvFile,
} from "../../../core/secrets.ts";
import { z } from "../../../core/utils/zod.ts";
import { join } from "../../../shared/path.ts";
import type { GlobalCLIOptions } from "../../router.ts";
import { safeWrite } from "../../utils/fsx.ts";
import { createLogger, type Logger } from "../../utils/log.ts";
import { renderCommandHelp } from "../help/command-help-renderer.ts";
import { ExportEnvConsole } from "./export-env-ui.ts";

/** Supported export formats for environment variables. */
export type ExportFormat = "sh" | "json";

/** CLI options accepted by the export-env command. */
type ExportEnvCommandOptions = GlobalCLIOptions & {
  env: string;
  format: ExportFormat;
  prefix: string;
  file?: string;
};

/** Options passed to the export-env action handler by Cliffy. */
type ExportEnvActionOptions = {
  json?: boolean;
  env?: string;
  format?: string;
  prefix?: string;
  file?: string;
};

/** Context object passed to export-env command handlers. */
export type ExportEnvContext = {
  env: EnvName;
  format: ExportFormat;
  prefix: string;
  file?: string;
  cwd: string;
  global: GlobalCLIOptions;
};

/** Function signature for export-env command implementations. */
export type ExportEnvHandler = (
  context: ExportEnvContext,
) => Promise<void> | void;

/** Dependencies for the export-env command handler. */
export type ExportEnvDependencies = {
  exit?: (code: number) => never;
  readTextFile?: (path: string) => Promise<string>;
  writeTextFile?: (path: string, data: string) => Promise<void>;
  console?: ExportEnvConsole;
  logger?: Logger;
  writer?: (line: string) => void;
  getEnv?: (key: string) => string | undefined;
};

/** Interface for the dynamically imported env config module (EnvConfigSchema format). */
interface EnvConfigModule {
  default?: EnvConfigSchema;
}

/** Result of loading an env config with the built Zod schema. */
export type LoadedSchema = {
  /** The Zod schema built from EnvConfigSchema. */
  zodSchema: z.ZodType<Record<string, unknown>>;
};

/**
 * Checks if a value is a valid EnvConfigSchema.
 * The format must have at least one property with a `validator` key.
 */
function isEnvConfigSchema(value: unknown): value is EnvConfigSchema {
  if (value === null || typeof value !== "object") {
    return false;
  }
  // Check if it's a Zod schema (has safeParse or parse methods) - not valid
  if ("safeParse" in value || "parse" in value) {
    return false;
  }
  // Check if at least one entry has the `validator` property
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return false;
  }
  // Valid format: { KEY: { validator: z.ZodType, required: boolean | string[] } }
  const hasValidator = entries.some((entry) => {
    const def = entry[1];
    return (
      typeof def === "object" &&
      def !== null &&
      "validator" in def
    );
  });
  return hasValidator;
}

/**
 * Builds a Zod schema from an EnvConfigSchema for the given environment.
 * Similar to buildZodSchema in secrets.ts but respects required constraints.
 */
function buildZodSchemaFromConfig(
  config: EnvConfigSchema,
  envName: EnvName,
): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {};

  for (const [key, def] of Object.entries(config)) {
    // Check if this field is required for the current environment
    let isRequired = false;
    if (def.required === true) {
      isRequired = true;
    } else if (Array.isArray(def.required)) {
      isRequired = def.required.includes(envName);
    }

    if (isRequired) {
      // Required fields must be present
      shape[key] = def.validator;
    } else {
      // Optional fields can be missing
      shape[key] = def.validator.optional();
    }
  }

  return z.object(shape);
}

/**
 * Loads env config from config/secrets/env.config.ts.
 * Requires EnvConfigSchema format (defineEnvConfig).
 */
export async function loadSchema(cwd: string): Promise<LoadedSchema | null> {
  try {
    const schemaPath = join(cwd, "config", "secrets", "env.config.ts");
    const module = (await import(`file://${schemaPath}`)) as EnvConfigModule;
    const config = module.default;

    if (!config) {
      return null;
    }

    // Validate that config is in EnvConfigSchema format
    if (!isEnvConfigSchema(config)) {
      console.error(
        "Invalid env.config.ts format. Expected EnvConfigSchema (use defineEnvConfig).",
      );
      return null;
    }

    // Build Zod schema from EnvConfigSchema (use "dev" as default env for export)
    const zodSchema = buildZodSchemaFromConfig(config, "dev");
    return { zodSchema };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    if (error instanceof TypeError && error.message.includes("Module not found")) {
      return null;
    }
    throw error;
  }
}

/** Exports environment variables to shell dotenv format. */
function exportToSh(
  secrets: Record<string, string>,
  write: (line: string) => void = console.log,
): void {
  for (const [key, value] of Object.entries(secrets)) {
    if (
      value.includes(" ") || value.includes('"') || value.includes("'") ||
      value.includes("\n") || value.includes("\t")
    ) {
      const escapedValue = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      write(`${key}="${escapedValue}"`);
    } else {
      write(`${key}=${value}`);
    }
  }
}

/** Exports environment variables to JSON format. */
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

/** Creates the default export-env command handler. */
export function createDefaultExportEnvHandler(
  dependencies: ExportEnvDependencies = {},
): ExportEnvHandler {
  const exitFn = dependencies.exit ?? ((code: number): never => Deno.exit(code));
  const getEnv = dependencies.getEnv ?? ((key: string) => Deno.env.get(key));

  return async (context: ExportEnvContext) => {
    const jsonMode = context.global.json ?? false;
    const logger = dependencies.logger ??
      createLogger({ json: jsonMode, writer: dependencies.writer });

    const hasFile = context.file !== undefined;
    const verboseMode = hasFile || jsonMode;

    const human = verboseMode
      ? (dependencies.console ?? new ExportEnvConsole({ writer: dependencies.writer }))
      : null;

    const { env, format, prefix, file, cwd } = context;

    // Start event
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
      return exitFn(2);
    }

    // Load schema
    const schema = await loadSchema(cwd);

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
      return exitFn(1);
    }

    // Schema loaded event
    if (jsonMode) {
      logger.event("export-env:schema", {});
    } else if (verboseMode) {
      human?.schemaLoaded();
    }

    // Load .env file
    const envFilePath = join(cwd, "config", "secrets", `.env.${env}`);
    const fileEnv = await parseEnvFile(envFilePath);

    // Get schema keys from the Zod schema shape
    // For ZodObject, the shape is accessible via .shape
    const zodShape = (schema.zodSchema as z.ZodObject<Record<string, z.ZodType>>).shape;
    const schemaKeys = Object.keys(zodShape);

    // Get secrets from environment and file
    const secrets: Record<string, string | undefined> = {};
    for (const key of schemaKeys) {
      const envValue = getEnv(key);
      secrets[key] = envValue ?? fileEnv[key];
    }

    // Validate with Zod
    const parseResult = schema.zodSchema.safeParse(secrets);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return `${path}: ${issue.message}`;
      });

      if (jsonMode) {
        logger.event("export-env:error", { errors, type: "validation" });
      } else if (verboseMode) {
        human?.error("Validation failed");
        human?.validationErrors(errors);
      } else {
        console.error("Validation failed:");
        for (const error of errors) {
          console.error(`  - ${error}`);
        }
      }
      return exitFn(1);
    }

    // Exporting
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
        const writer = dependencies.writer ?? console.log;
        switch (format) {
          case "sh":
            exportToSh(prefixedSecrets, writer);
            break;
          case "json":
            exportToJson(prefixedSecrets, writer, true);
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
      return exitFn(1);
    }

    // Success
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

/** Constructs the Cliffy command definition for export-env. */
export function createExportEnvCommand(
  handler: ExportEnvHandler = createDefaultExportEnvHandler(),
) {
  const command = new Command()
    .name("export-env")
    .description("Export environment variables for runtime or CI/CD pipelines.")
    .option("--env <env:string>", "Target environment (dev|staging|prod|...).", {
      default: "dev",
    })
    .option("--format <format:string>", "Export format (sh|json).", { required: true })
    .option("--prefix <prefix:string>", "Prefix to add to exported variable names.", {
      default: "",
    })
    .option("-o, --file <name:string>", "Output file name (written to config/secrets/).")
    .action(async (options: ExportEnvActionOptions) => {
      const { json = false, env: envValue, format, prefix = "", file } = options;

      const env = envValue ?? "dev";
      if (!isValidEnvName(env)) {
        console.error(`Error: invalid environment "${env}". Accepted values: dev, staging, prod`);
        Deno.exit(2);
      }

      const validFormats: ExportFormat[] = ["sh", "json"];
      if (!format || !validFormats.includes(format as ExportFormat)) {
        console.error(`Error: invalid format "${format}". Accepted values: sh, json`);
        Deno.exit(2);
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
              description: "Target environment (dev|staging|prod|...). Default: dev",
            },
            { label: "--format <format>", description: "Export format (sh|json). Required" },
            { label: "--prefix <prefix>", description: "Filter variables by prefix" },
            {
              label: "--file, -o <name>",
              description: "Output file name (written to config/secrets/)",
            },
            { label: "--json", description: "Output machine-readable NDJSON events" },
          ],
          examples: [
            "tsera export-env --format sh --env dev",
            "tsera export-env --format json --env prod",
            "tsera export-env --format sh --file .env.prod --env prod --json",
          ],
        }),
      );
    } catch {
      originalShowHelp();
    }
  };

  return command;
}

/** @deprecated Use createExportEnvCommand instead. */
export const exportEnvCommand = createExportEnvCommand();
