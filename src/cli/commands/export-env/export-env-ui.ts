/**
 * @module export-env-ui
 * UI components for the export-env command.
 *
 * This module provides user interface components for displaying
 * export-env command output, errors, and status messages.
 */

import { bold, dim, gray, green, magenta, red } from "../../ui/colors.ts";
import { BaseConsole } from "../../ui/console.ts";
import { TerminalSpinner } from "../../ui/spinner.ts";

/**
 * Options for creating an ExportEnvConsole instance.
 */
export type ExportEnvConsoleOptions = {
  /** Optional custom writer for output */
  writer?: (line: string) => void;
};

/**
 * Human-friendly console reporter for the export-env command.
 *
 * Provides visual feedback during environment variable export,
 * using a terminal spinner and formatted output.
 *
 * @example
 * ```typescript
 * const console = new ExportEnvConsole();
 *
 * console.start("prod", "github-env");
 * console.schemaLoaded(5);
 * console.exporting("github-env");
 * console.success(5, "github-env");
 * ```
 */
export class ExportEnvConsole extends BaseConsole {
  /**
   * Terminal spinner for animated progress display.
   * @private
   */
  #spinner: TerminalSpinner;

  /**
   * Creates a new export-env console instance.
   *
   * @param options - Configuration options
   */
  constructor(options: ExportEnvConsoleOptions = {}) {
    const writer = options.writer ?? ((line: string) => console.log(line));
    super(writer);
    this.#spinner = new TerminalSpinner(writer);
  }

  /**
   * Announces the beginning of the export process.
   *
   * @param env - Target environment (dev/staging/prod)
   * @param format - Export format
   */
  start(env: string, _format: string): void {
    this.#spinner.start(
      `${magenta("◆")} ${bold("Export")} ${dim("│")} ${gray(`Loading schema for ${env}...`)}`,
    );
  }

  /**
   * Reports that the schema was loaded and validation is starting.
   *
   * @param count - Number of variables to validate
   */
  schemaLoaded(count: number): void {
    this.#spinner.update(
      `${dim("→")} ${gray(`Validating ${count} variable(s)...`)}`,
    );
  }

  /**
   * Reports that export is in progress.
   *
   * @param format - Export format being used
   */
  exporting(format: string): void {
    this.#spinner.update(
      `${dim("→")} ${gray(`Exporting to ${format} format...`)}`,
    );
  }

  /**
   * Confirms successful export completion (console mode).
   *
   * @param count - Number of variables exported
   * @param format - Export format used
   */
  success(count: number, format: string): void {
    this.#spinner.succeed(
      `${green("✓")} ${bold("Export complete")} ${dim("│")} ${gray(`${count} variable(s) exported as ${format}`)
      }`,
    );
  }

  /**
   * Confirms successful export to file.
   *
   * @param filePath - Path to the output file
   * @param count - Number of variables exported
   * @param format - Export format used
   */
  fileSuccess(filePath: string, count: number, format: string): void {
    this.#spinner.succeed(
      `${green("✓")} ${bold("Exported to")} ${filePath} ${dim("│")} ${gray(`${count} variable(s) as ${format}`)
      }`,
    );
  }

  /**
   * Reports an export failure.
   *
   * @param message - Error message describing the failure
   */
  error(message: string): void {
    this.#spinner.fail(
      `${bold("Export failed")} ${dim("│")} ${gray(message)}`,
    );
  }

  /**
   * Displays an info message.
   *
   * @param message - Info message to display
   */
  info(message: string): void {
    this.write(`${dim("ℹ")} ${gray(message)}`);
  }

  /**
   * Displays validation errors.
   *
   * @param errors - List of validation error messages
   */
  validationErrors(errors: string[]): void {
    this.write(`${red("✖")} ${bold("Validation errors:")}`);
    for (const error of errors) {
      this.write(`  ${red("-")} ${gray(error)}`);
    }
  }
}
