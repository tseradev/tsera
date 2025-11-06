/**
 * UI component for the dev command.
 *
 * Provides human-friendly console output for development mode,
 * including watch events, plan summaries, and coherence status.
 *
 * @module
 */

import { cyan, dim, gray, green, magenta, yellow } from "../../ui/colors.ts";
import { TerminalSpinner } from "../../ui/spinner.ts";
import { BaseConsole } from "../../ui/console.ts";
import {
  formatActionSummaryWithSymbols,
  formatCount,
  formatProjectLabel,
  type PlanSummary,
} from "../../ui/formatters.ts";

/**
 * Options for creating a DevConsole instance.
 */
export interface DevConsoleOptions {
  /** The project directory being watched */
  projectDir: string;
  /** Optional custom writer for output */
  writer?: (line: string) => void;
}

/**
 * Human-friendly console reporter for the dev command.
 *
 * Provides visual feedback during development mode, including file
 * watch events, plan computation, artifact generation, and coherence
 * status updates.
 *
 * @example
 * ```typescript
 * const console = new DevConsole({
 *   projectDir: "/path/to/project",
 * });
 *
 * console.watchStart("/path/to/project", 150);
 * console.cycleStart("initial", []);
 * console.planSummary({ create: 2, update: 1, delete: 0 });
 * console.applyComplete(3, true);
 * console.coherenceStatus("clean", 5);
 * ```
 */
export class DevConsole extends BaseConsole {
  /**
   * Terminal spinner for animated progress display.
   * @private
   */
  #spinner: TerminalSpinner;

  /**
   * Project label derived from directory path.
   * @private
   */
  #projectLabel: string;

  /**
   * Creates a new dev console instance.
   *
   * @param options - Configuration options
   */
  constructor(options: DevConsoleOptions) {
    super(options.writer);
    this.#spinner = new TerminalSpinner(options.writer);
    this.#projectLabel = formatProjectLabel(options.projectDir);
  }

  /**
   * Announces that watch mode has started.
   *
   * @param _root - The root directory being watched (not displayed)
   * @param debounce - The debounce delay in milliseconds
   */
  watchStart(_root: string, debounce: number): void {
    this.write(
      `${magenta("◆")} ${bold("Dev")} ${dim("│")} ${cyan(this.#projectLabel)}`,
    );
    this.writeMiddle(`${dim("→")} ${gray(`Watching for changes (${debounce}ms debounce)`)}`);
    this.writeLast(`${dim("→")} ${gray("Waiting for file changes…")}`);
  }

  /**
   * Announces the start of a dev cycle.
   *
   * @param reason - The reason for the cycle (e.g., "initial", "watch")
   * @param paths - Changed file paths (if applicable)
   */
  cycleStart(reason: string, paths: string[]): void {
    if (reason === "initial") {
      this.#spinner.start(
        `${magenta("◆")} ${bold("Dev")} ${dim("│")} ${gray("Initial coherence check…")}`,
      );
    } else if (paths.length > 0) {
      const fileCount = formatCount(paths.length, "file");
      this.#spinner.start(
        `${magenta("◆")} ${bold("Change detected")} ${dim("│")} ${gray(`${fileCount} modified`)}`,
      );
    } else {
      this.#spinner.start(
        `${magenta("◆")} ${bold("Dev")} ${dim("│")} ${gray("Checking coherence…")}`,
      );
    }
  }

  /**
   * Displays the plan summary.
   *
   * @param summary - The plan summary with operation counts
   */
  planSummary(summary: PlanSummary): void {
    if (!summary.changed) {
      this.#spinner.update(
        `${green("✓")} ${bold("No changes needed")} ${dim("│")} ${gray("artifacts are current")}`,
      );
    } else {
      const actions = formatActionSummaryWithSymbols(summary);
      this.#spinner.update(
        `${dim("→")} ${yellow("Applying changes")} ${dim("│")} ${actions}`,
      );
    }
  }

  /**
   * Reports that artifact application is complete.
   *
   * @param steps - Number of steps applied
   * @param changed - Whether any changes were made
   */
  applyComplete(steps: number, changed: boolean): void {
    if (changed) {
      const label = formatCount(steps, "artifact");
      this.#spinner.update(
        `${green("✓")} ${bold("Artifacts updated")} ${dim("│")} ${gray(`${label} regenerated`)}`,
      );
    }
  }

  /**
   * Displays the final coherence status.
   *
   * @param status - The coherence status ("clean" or "pending")
   * @param entities - The number of entities in the project
   */
  coherenceStatus(status: "clean" | "pending", entities: number): void {
    const entityInfo = formatCount(entities, "entity", "entities");
    if (status === "clean") {
      this.#spinner.succeed(
        `${green("✓")} ${bold("Coherent")} ${dim("│")} ${gray(`${entityInfo} verified`)}`,
      );
    } else {
      this.#spinner.warn(
        `${yellow("⚠")} ${bold("Pending")} ${dim("│")} ${gray(`${entityInfo} need attention`)}`,
      );
    }
  }

  /**
   * Reports an error during a dev cycle.
   *
   * @param message - The error message
   */
  cycleError(message: string): void {
    this.#spinner.fail(`${yellow("✕")} ${bold("Error")} ${dim("│")} ${gray(message)}`);
    this.writeLast(`${dim("→")} ${yellow("Fix the error and save to retry.")}`);
  }

  /**
   * Updates the spinner with a custom message.
   *
   * @param text - The text to display
   */
  update(text: string): void {
    this.#spinner.update(text);
  }
}
