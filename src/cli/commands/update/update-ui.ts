/**
 * UI component for the update command.
 *
 * Provides human-friendly console output for CLI update operations,
 * including version checks, installation, and post-update instructions.
 *
 * @module
 */

import { cyan, dim, gray, green, magenta, yellow } from "../../ui/colors.ts";
import { TerminalSpinner } from "../../ui/spinner.ts";
import { BaseConsole } from "../../ui/console.ts";

/**
 * Options for creating an UpdateConsole instance.
 */
export interface UpdateConsoleOptions {
  /** The update channel being used */
  channel: "stable" | "beta" | "canary";
  /** Whether binary installation is being used */
  binary: boolean;
  /** The current CLI version */
  currentVersion: string;
  /** Optional custom writer for output */
  writer?: (line: string) => void;
}

/**
 * Human-friendly console reporter for the update command.
 *
 * Provides visual feedback during CLI update operations, including
 * version checks, download/installation progress, and next steps.
 *
 * @example
 * ```typescript
 * const console = new UpdateConsole({
 *   channel: "stable",
 *   binary: false,
 *   currentVersion: "0.1.0",
 * });
 *
 * console.start();
 * console.denoVersionChecked("2.0.0");
 * console.updateInProgress("deno install");
 * console.updateComplete();
 * console.showNextSteps(["tsera doctor --fix"]);
 * ```
 */
export class UpdateConsole extends BaseConsole {
  /**
   * Terminal spinner for animated progress display.
   * @private
   */
  #spinner: TerminalSpinner;

  /**
   * The update channel being used.
   * @private
   */
  #channel: string;

  /**
   * Whether binary installation is enabled.
   * @private
   */
  #binary: boolean;

  /**
   * The current CLI version.
   * @private
   */
  #currentVersion: string;

  /**
   * Creates a new update console instance.
   *
   * @param options - Configuration options
   */
  constructor(options: UpdateConsoleOptions) {
    super(options.writer);
    this.#spinner = new TerminalSpinner(options.writer);
    this.#channel = options.channel;
    this.#binary = options.binary;
    this.#currentVersion = options.currentVersion;
  }

  /**
   * Announces the start of the update process.
   */
  start(): void {
    const method = this.#binary ? "binary" : "deno install";
    const channelLabel = this.#channel !== "stable" ? ` (${this.#channel})` : "";
    this.#spinner.start(
      `${magenta("◆")} ${bold("Update")} ${dim("│")} ${cyan(`${method}${channelLabel}`)} ${
        dim("│")
      } ${gray(`current: ${this.#currentVersion}`)}`,
    );
  }

  /**
   * Reports that the Deno version check is complete.
   *
   * @param version - The detected Deno version
   */
  denoVersionChecked(version: string): void {
    this.#spinner.update(
      `${dim("→")} ${gray("Deno version checked")} ${dim("│")} ${cyan(`v${version}`)}`,
    );
  }

  /**
   * Reports that the update is in progress.
   *
   * @param command - The command being executed
   */
  updateInProgress(command: string): void {
    this.#spinner.update(
      `${dim("→")} ${yellow("Installing…")} ${dim("│")} ${gray(command)}`,
    );
  }

  /**
   * Confirms that the update completed successfully.
   */
  updateComplete(): void {
    this.#spinner.succeed(
      `${green("✓")} ${bold("Update complete")} ${dim("│")} ${
        gray("TSera CLI updated successfully")
      }`,
    );
  }

  /**
   * Reports that the operation is in dry-run mode.
   *
   * @param command - The command that would be executed
   */
  dryRun(command: string): void {
    this.#spinner.warn(
      `${yellow("⚠")} ${bold("Dry run")} ${dim("│")} ${gray("No changes made")}`,
    );
    this.write("");
    this.writeMiddle(`${magenta("◆")} ${bold("Command Preview")}`);
    this.writeMiddle(`${dim("→")} ${cyan(command)}`);
    this.write("");
  }

  /**
   * Displays recommended post-update steps.
   *
   * @param steps - Array of command strings to run
   */
  showNextSteps(steps: string[]): void {
    this.write("");
    this.writeMiddle(`${magenta("◆")} ${bold("Next Steps")}`);
    this.writeMiddle(`${dim("→")} ${gray("Recommended post-update actions:")}`);
    for (const step of steps) {
      this.writeMiddle(`  ${dim("→")} ${cyan(step)}`);
    }
    this.write("");
  }

  /**
   * Reports an update error.
   *
   * @param message - The error message
   */
  updateError(message: string): void {
    this.#spinner.fail(`${yellow("✕")} ${bold("Update failed")} ${dim("│")} ${gray(message)}`);
    this.writeLast(`${dim("→")} ${yellow("Check your network connection and try again.")}`);
  }
}
