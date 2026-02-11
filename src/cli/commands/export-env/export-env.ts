/**
 * @module export-env
 * Export environment variables command for TSera CLI.
 *
 * This module provides a simplified CLI command for exporting environment
 * variables in various formats (GitHub Actions, shell, GitLab CI, JSON).
 */

import { Command } from "cliffy/command";
import { crypto } from "jsr:@std/crypto@^1.0.4";
import { join } from "std/path";

/**
 * Environment schema definition.
 */
interface EnvSchema {
  [key: string]: EnvKeyConfig;
}

/**
 * Configuration for a single environment variable.
 * - type: REQUIRED - "string" | "number" | "boolean" | "url"
 * - required: REQUIRED - true | false | ["env1", "env2"]
 * - description: OPTIONAL - human-readable description
 */
interface EnvKeyConfig {
  type: "string" | "number" | "boolean" | "url";
  required: boolean | string[];
  description?: string;
}

/**
 * Loads environment schema from config/secret/env.config.ts.
 */
export async function loadSchema(): Promise<EnvSchema | null> {
  try {
    const schemaPath = join(Deno.cwd(), "config", "secret", "env.config.ts");
    const module = await import(`file://${schemaPath}`);
    return module.default || module.envSchema || module.schema || null;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw error;
  }
}

/**
 * Validates a value against its type.
 */
function validateType(
  value: string,
  type: "string" | "number" | "boolean" | "url",
): { valid: boolean; reason?: string } {
  switch (type) {
    case "string":
      return { valid: typeof value === "string" };
    case "number":
      const num = Number(value);
      return { valid: !isNaN(num) && isFinite(num), reason: "must be a number" };
    case "boolean":
      const boolValue = value.toLowerCase();
      return {
        valid: boolValue === "true" || boolValue === "false",
        reason: "must be 'true' or 'false'",
      };
    case "url":
      try {
        new URL(value);
        return { valid: true };
      } catch {
        return { valid: false, reason: "must be a valid URL" };
      }
  }
}

/**
 * Validates secrets against schema (strict mode only).
 * Iterates over ALL schema keys, not just provided secrets.
 */
function validateSecrets(
  secrets: Record<string, string | undefined>,
  schema: EnvSchema,
  env: string,
): { errors: string[] } {
  const errors: string[] = [];

  for (const [key, keyConfig] of Object.entries(schema)) {
    const value = secrets[key];

    // Check if key is required for this environment
    let isRequired = false;
    if (keyConfig.required === true) {
      isRequired = true;
    } else if (Array.isArray(keyConfig.required) && keyConfig.required.includes(env)) {
      isRequired = true;
    }

    if (value === undefined) {
      if (isRequired) {
        errors.push(
          `[${env}] Missing required env var "${key}". Set it in config/secret/.env.${env}.`,
        );
      }
      continue;
    }

    // Validate type
    const typeValidation = validateType(value, keyConfig.type);
    if (!typeValidation.valid && typeValidation.reason) {
      errors.push(
        `[env] Invalid env var "${key}": expected ${keyConfig.type}. Fix in config/secret/.env.${env}.`,
      );
    }
  }

  return { errors };
}

/**
 * Exports to GitHub Actions format.
 */
async function exportToGithubEnv(secrets: Record<string, string>): Promise<void> {
  const githubEnvPath = Deno.env.get("GITHUB_ENV");
  if (!githubEnvPath) {
    throw new Error("GITHUB_ENV environment variable is not set");
  }

  const isGitHubActions = Deno.env.get("GITHUB_ACTIONS") === "true";
  const lines: string[] = [];

  for (const [key, value] of Object.entries(secrets)) {
    // Auto-mask if in GitHub Actions
    if (isGitHubActions) {
      console.log(`::add-mask::${value}`);
    }

    // Handle multi-line values
    if (value.includes("\n")) {
      const delimiter = `__TSERA__${await crypto.randomUUID()}__`;
      lines.push(`${key}<<${delimiter}`);
      lines.push(value);
      lines.push(delimiter);
    } else {
      // Escape special characters
      const escapedValue = value
        .replace(/\\/g, "\\\\")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");
      lines.push(`${key}=${escapedValue}`);
    }
  }

  // Write to GITHUB_ENV file
  await Deno.writeTextFile(githubEnvPath, lines.join("\n") + "\n", {
    append: true,
  });
}

/**
 * Exports to shell format.
 */
function exportToSh(secrets: Record<string, string>): void {
  for (const [key, value] of Object.entries(secrets)) {
    // Escape for shell: replace ' with '\''
    const escapedValue = value.replace(/'/g, "'\\''");
    console.log(`export ${key}='${escapedValue}'`);
  }
}

/**
 * Exports to GitLab CI dotenv format.
 */
async function exportToGitlabDotenv(
  secrets: Record<string, string>,
  outputPath: string,
): Promise<void> {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(secrets)) {
    // Reject multi-line values
    if (value.includes("\n") || value.includes("\0")) {
      throw new Error(
        `Value for "${key}" contains invalid characters (newline or NUL) for gitlab-dotenv format`,
      );
    }

    lines.push(`${key}=${value}`);
  }

  // Write to output file
  await Deno.writeTextFile(outputPath, lines.join("\n") + "\n");
}

/**
 * Exports to JSON format.
 */
function exportToJson(secrets: Record<string, string>): void {
  console.log(JSON.stringify(secrets, null, 2));
}

/**
 * Export environment variables command.
 *
 * Exports environment variables from config/secret/env.config.ts in various formats
 * for use in CI/CD pipelines or runtime configuration.
 *
 * @example
 * ```bash
 * tsera export-env --format github-env --env prod
 * tsera export-env --format sh --prefix APP_
 * tsera export-env --format json
 * ```
 */
export const exportEnvCommand = new Command()
  .name("export-env")
  .description(
    "Export environment variables for runtime or CI",
  )
  .option("--env <env>", "Environment (dev|staging|prod)", {
    default: () => Deno.env.get("TSERA_ENV") || "dev",
  })
  .option("--format <format>", "Export format (github-env|sh|gitlab-dotenv|json)", {
    required: true,
  })
  .option("--prefix <prefix>", "Key prefix", { default: "" })
  .option("--out <path>", "Output path (only for gitlab-dotenv)")
  .action(async (options) => {
    try {
      // 1. Validate options
      const env = options.env;
      if (!["dev", "staging", "prod"].includes(env)) {
        console.error(
          `Error: invalid environment "${env}". Accepted values: dev, staging, prod`,
        );
        Deno.exit(1);
      }

      const format = options.format;
      if (!["github-env", "sh", "gitlab-dotenv", "json"].includes(format)) {
        console.error(
          `Error: invalid format "${format}". Accepted values: github-env, sh, gitlab-dotenv, json`,
        );
        Deno.exit(1);
      }

      if (format === "gitlab-dotenv" && !options.out) {
        console.error(
          `Error: --out option is required for gitlab-dotenv format`,
        );
        Deno.exit(1);
      }

      // 2. Load schema
      const schema = await loadSchema();
      if (!schema) {
        console.error(
          `Error: config/secret/env.config.ts not found. Please ensure that secrets module is installed.`,
        );
        Deno.exit(1);
      }

      // 3. Get secrets from environment - build for ALL schema keys (including undefined)
      const secrets: Record<string, string | undefined> = {};
      for (const key of Object.keys(schema)) {
        secrets[key] = Deno.env.get(key);
      }

      // 4. Validate secrets (strict mode only)
      const validation = validateSecrets(secrets, schema, env);
      if (validation.errors.length > 0) {
        console.error("Validation errors:");
        for (const error of validation.errors) {
          console.error(`  - ${error}`);
        }
        Deno.exit(1);
      }

      // 5. Apply prefix
      const prefix = options.prefix || "";
      const prefixedSecrets: Record<string, string> = {};
      for (const [key, value] of Object.entries(secrets)) {
        if (value !== undefined) {
          prefixedSecrets[`${prefix}${key}`] = value;
        }
      }

      // 6. Export according to format
      switch (format) {
        case "github-env":
          await exportToGithubEnv(prefixedSecrets);
          break;
        case "sh":
          exportToSh(prefixedSecrets);
          break;
        case "gitlab-dotenv":
          await exportToGitlabDotenv(prefixedSecrets, options.out!);
          break;
        case "json":
          exportToJson(prefixedSecrets);
          break;
      }

      // 7. Display success
      console.error(
        `✓ Export successful: ${
          Object.keys(prefixedSecrets).length
        } variable(s) exported in ${format} format`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      Deno.exit(1);
    }
  });
