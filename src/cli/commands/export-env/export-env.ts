/**
 * @module export-env
 * Export environment variables command for TSera CLI.
 *
 * This module provides a CLI command for exporting environment variables
 * in various formats suitable for CI/CD pipelines and runtime configuration.
 *
 * ## Supported Formats
 *
 * - **github-env**: GitHub Actions environment file format with auto-masking
 * - **sh**: Shell export format for sourcing in bash/zsh
 * - **gitlab-dotenv**: GitLab CI dotenv format for job variables
 * - **json**: JSON format for programmatic consumption
 *
 * ## Security Considerations
 *
 * - GitHub Actions format automatically masks all exported values
 * - Values are never logged in plain text (only written to files or stdout)
 * - Validation errors show only variable names, not values
 *
 * ## Usage Examples
 *
 * ```bash
 * # Export to GitHub Actions environment file
 * tsera export-env --format github-env --env prod
 *
 * # Export to shell format with prefix
 * tsera export-env --format sh --prefix APP_
 *
 * # Export to JSON for programmatic use
 * tsera export-env --format json
 *
 * # Export to GitLab CI dotenv file
 * tsera export-env --format gitlab-dotenv --out .env.ci
 * ```
 */

import { Command } from "cliffy/command";
import { crypto } from "std/crypto";
import { join } from "std/path";
import { EnvName, EnvSchema, isValidEnvName, validateSecrets } from "../../../core/secrets.ts";
import { safeWrite } from "../../utils/fsx.ts";

/**
 * Supported export formats for environment variables.
 *
 * Each format has specific requirements and output destinations:
 * - `github-env`: Writes to GITHUB_ENV file, requires GitHub Actions environment
 * - `sh`: Outputs to stdout, suitable for sourcing in shell scripts
 * - `gitlab-dotenv`: Writes to specified output file, requires --out option
 * - `json`: Outputs to stdout, suitable for programmatic parsing
 */
export type ExportFormat = "github-env" | "sh" | "gitlab-dotenv" | "json";

/**
 * Loads environment schema from config/secret/env.config.ts.
 *
 * Attempts to load the environment schema from the default location.
 * Returns null if the file does not exist (graceful degradation).
 *
 * @returns The loaded environment schema or null if not found
 * @throws Error for file system errors other than NotFound
 *
 * @example
 * ```ts
 * const schema = await loadSchema();
 * if (!schema) {
 *   console.error("Schema not found");
 *   Deno.exit(1);
 * }
 * ```
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
 * Exports environment variables to GitHub Actions format.
 *
 * Writes environment variables to the GITHUB_ENV file with proper escaping
 * and automatic value masking. Supports multi-line values using heredoc syntax.
 *
 * The function automatically masks all exported values when running in GitHub
 * Actions to prevent sensitive data from appearing in logs.
 *
 * @param secrets - Environment variables to export
 * @throws Error if GITHUB_ENV environment variable is not set
 *
 * @example
 * ```ts
 * await exportToGithubEnv({ DATABASE_URL: "postgres://...", PORT: "5432" });
 * ```
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
  const payload = lines.join("\n") + "\n";
  await appendTextFileAtomic(githubEnvPath, payload);
}

/**
 * Exports environment variables to shell format.
 *
 * Outputs shell export statements to stdout, suitable for sourcing in
 * bash, zsh, or other POSIX-compliant shells. Values are properly escaped
 * to handle special characters including single quotes.
 *
 * @param secrets - Environment variables to export
 *
 * @example
 * ```ts
 * exportToSh({ DATABASE_URL: "postgres://...", PORT: "5432" });
 * // Output:
 * // export DATABASE_URL='postgres://...'
 * // export PORT='5432'
 * ```
 */
function exportToSh(secrets: Record<string, string>): void {
  for (const [key, value] of Object.entries(secrets)) {
    // Escape for shell: replace ' with '\''
    const escapedValue = value.replace(/'/g, "'\\''");
    console.log(`export ${key}='${escapedValue}'`);
  }
}

/**
 * Exports environment variables to GitLab CI dotenv format.
 *
 * Writes environment variables to a file in GitLab CI dotenv format.
 * This format does not support multi-line values and will reject values
 * containing newlines or NUL characters.
 *
 * @param secrets - Environment variables to export
 * @param outputPath - Path to the output file
 * @throws Error if any value contains invalid characters for the format
 *
 * @example
 * ```ts
 * await exportToGitlabDotenv(
 *   { DATABASE_URL: "postgres://...", PORT: "5432" },
 *   ".env.ci"
 * );
 * ```
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
  await safeWrite(outputPath, lines.join("\n") + "\n");
}

/**
 * Exports environment variables to JSON format.
 *
 * Outputs environment variables as a formatted JSON object to stdout.
 * Suitable for programmatic parsing and API consumption.
 *
 * @param secrets - Environment variables to export
 *
 * @example
 * ```ts
 * exportToJson({ DATABASE_URL: "postgres://...", PORT: "5432" });
 * // Output:
 * // {
 * //   "DATABASE_URL": "postgres://...",
 * //   "PORT": "5432"
 * // }
 * ```
 */
function exportToJson(secrets: Record<string, string>): void {
  console.log(JSON.stringify(secrets, null, 2));
}

/**
 * Export environment variables command.
 *
 * This CLI command exports validated environment variables from the
 * configured schema in various formats for use in CI/CD pipelines or
 * runtime configuration.
 *
 * ## Command Options
 *
 * - `--env <env>`: Target environment (dev|staging|prod), defaults to TSERA_ENV or "dev"
 * - `--format <format>`: Export format (github-env|sh|gitlab-dotenv|json), required
 * - `--prefix <prefix>`: Optional prefix to add to all exported variable names
 * - `--out <path>`: Output file path (required only for gitlab-dotenv format)
 *
 * ## Validation
 *
 * The command validates all environment variables against the schema before
 * export. Validation errors are reported with actionable guidance.
 *
 * ## Exit Codes
 *
 * - 0: Successful export
 * - 1: Validation error, missing schema, or other error
 *
 * @example
 * ```bash
 * # Export to GitHub Actions for production
 * tsera export-env --format github-env --env prod
 *
 * # Export to shell with custom prefix
 * tsera export-env --format sh --prefix APP_
 *
 * # Export to JSON for parsing
 * tsera export-env --format json
 *
 * # Export to GitLab CI dotenv file
 * tsera export-env --format gitlab-dotenv --out .env.ci
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
      const envValue = options.env;
      if (!isValidEnvName(envValue)) {
        console.error(
          `Error: invalid environment "${envValue}". Accepted values: dev, staging, prod`,
        );
        Deno.exit(1);
      }
      const env: EnvName = envValue;

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
      const errors = validateSecrets(secrets, schema, env);
      if (errors.length > 0) {
        console.error("Validation errors:");
        for (const error of errors) {
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

/**
 * Appends content to a file using an atomic rewrite to avoid partial writes.
 *
 * @param path - File path to append to.
 * @param content - Content to append.
 */
async function appendTextFileAtomic(path: string, content: string): Promise<void> {
  let existing = "";
  try {
    existing = await Deno.readTextFile(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
  await safeWrite(path, existing + content);
}
