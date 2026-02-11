/**
 * @module export-env-ui
 * UI components for the export-env command.
 *
 * This module provides user interface components for displaying
 * export-env command output, errors, and status messages.
 */

import { blue, green, red, yellow } from "../../ui/colors.ts";

/**
 * Display format options in a formatted table.
 */
export function displayFormatOptions(): void {
  console.log("Available export formats:");
  console.log("");
  console.log("  github-env    Export to GitHub Actions environment file");
  console.log("  sh            Export to shell script format");
  console.log("  gitlab-dotenv Export to GitLab CI dotenv file");
  console.log("  json          Export to JSON format");
  console.log("");
}

/**
 * Display environment options in a formatted table.
 */
export function displayEnvironmentOptions(): void {
  console.log("Available environments:");
  console.log("");
  console.log("  dev     Development environment");
  console.log("  staging Staging environment");
  console.log("  prod    Production environment");
  console.log("");
}

/**
 * Display usage examples for the export-env command.
 */
export function displayUsageExamples(): void {
  console.log("Usage examples:");
  console.log("");
  console.log("  # Export to GitHub Actions for production");
  console.log("  tsera export-env --format github-env --env prod");
  console.log("");
  console.log("  # Export to shell with prefix");
  console.log("  tsera export-env --format sh --prefix APP_");
  console.log("");
  console.log("  # Export to JSON");
  console.log("  tsera export-env --format json");
  console.log("");
  console.log("  # Export to GitLab CI dotenv file");
  console.log("  tsera export-env --format gitlab-dotenv --out .env");
  console.log("");
}

/**
 * Display success message with exported variables count.
 */
export function displaySuccess(count: number, format: string): void {
  console.log(
    `${green("✓")} Export successful: ${count} variable(s) exported in ${format} format`,
  );
}

/**
 * Display validation errors.
 */
export function displayValidationErrors(errors: string[]): void {
  console.error(red("Validation errors:"));
  for (const error of errors) {
    console.error(`  ${red("-")} ${error}`);
  }
}

/**
 * Display error message.
 */
export function displayError(message: string): void {
  console.error(`${red("Error:")} ${message}`);
}

/**
 * Display warning message.
 */
export function displayWarning(message: string): void {
  console.warn(`${yellow("Warning:")} ${message}`);
}

/**
 * Display info message.
 */
export function displayInfo(message: string): void {
  console.log(`${blue("Info:")} ${message}`);
}
