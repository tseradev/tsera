/**
 * UI component for the dev command.
 *
 * Provides human-friendly console output for development mode,
 * including watch events, plan summaries, and coherence status.
 *
 * @module
 */

import { bold, cyan, dim, gray, green, magenta, red, yellow } from "../../ui/colors.ts";
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
  /** Whether watch mode is enabled */
  watchEnabled: boolean;
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
 *   watchEnabled: true,
 * });
 *
 * console.start();
 * console.cycleStart("initial", []);
 * console.planSummary({ create: 2, update: 1, delete: 0 });
 * console.applyComplete(3, true);
 * console.complete("clean", 5);
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
   * Whether watch mode is enabled.
   * @private
   */
  #watchEnabled: boolean;

  /**
   * Creates a new dev console instance.
   *
   * @param options - Configuration options
   */
  constructor(options: DevConsoleOptions) {
    super(options.writer);
    this.#spinner = new TerminalSpinner(options.writer);
    this.#projectLabel = formatProjectLabel(options.projectDir);
    this.#watchEnabled = options.watchEnabled;
  }

  /**
   * Announces that dev mode has started.
   */
  start(): void {
    const mode = this.#watchEnabled ? green("watch") : gray("single run");
    this.write(
      `⚙️  ${bold("TSera started for")} ${cyan(this.#projectLabel)} ${dim("(")}${mode}${dim(")")}`,
    );
    if (this.#watchEnabled) {
      this.writeLast(`${gray("Watching entities for changes…")}`);
    } else {
      this.writeLast(`${gray("Verifying project coherence…")}`);
    }
  }

  /**
   * Displays a summary of active modules at startup.
   *
   * @param modules - Object indicating which modules are active
   */
  modulesSummary(modules: { backend?: boolean; frontend?: boolean }): void {
    const active: string[] = [];
    if (modules.backend) active.push("Backend");
    if (modules.frontend) active.push("Frontend");

    if (active.length > 0) {
      this.write("");
      this.write(dim("Detected modules: ") + active.join(", "));
    }
  }

  /**
   * Displays a message when configuration changes and modules are restarting.
   */
  configChanged(): void {
    this.write("");
    this.write(yellow("⚠️  Configuration changed - restarting modules..."));
  }

  /**
   * Displays a module starting message.
   *
   * @param name - Module name (e.g., "backend", "frontend")
   */
  moduleStarting(name: string): void {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    this.write(dim("◆ ") + cyan(label) + dim(" │ Starting..."));
  }

  /**
   * Displays a module ready message.
   *
   * @param name - Module name
   * @param url - Optional URL where the module is running
   */
  moduleReady(name: string, url?: string): void {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    const urlPart = url ? dim(" at ") + cyan(url) : "";
    this.write(green("✓ ") + cyan(label) + dim(" │ Ready") + urlPart);
  }

  /**
   * Displays a module error message.
   *
   * @param name - Module name
   * @param error - Error message
   */
  moduleError(name: string, error: string): void {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    this.write(red("✗ ") + cyan(label) + dim(" │ ") + red(error));
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
        `${gray("Checking entities and artifacts…")}`,
      );
    } else if (paths.length > 0) {
      const fileCount = formatCount(paths.length, "file");
      this.#spinner.start(
        `${bold("Change detected")} ${dim("│")} ${yellow(`${fileCount} modified`)}`,
      );
    } else {
      this.#spinner.start(
        `${gray("Analyzing project state…")}`,
      );
    }
  }

  /**
   * Displays the plan summary with details of affected artifacts.
   *
   * @param summary - The plan summary with operation counts
   * @param steps - The plan steps with node details
   */
  planSummary(
    summary: PlanSummary,
    steps: Array<{ kind: string; node: { id: string; kind: string } }>,
  ): void {
    if (!summary.changed) {
      this.#spinner.update(
        `${gray("Everything is in sync")}`,
      );
    } else {
      const actions = formatActionSummaryWithSymbols(summary);
      this.#spinner.update(
        `${yellow("Regenerating artifacts")} ${dim("│")} ${actions}`,
      );

      // Show affected artifacts
      this.#spinner.stop();
      const affectedSteps = steps.filter((s) => s.kind !== "noop");
      if (affectedSteps.length > 0) {
        this.write("");
        this.write(
          `🔍 ${bold("Change detected")} ${dim("│")} ${
            yellow(`${formatCount(affectedSteps.length, "artifact")} to sync`)
          }`,
        );
        for (const step of affectedSteps) {
          const symbol = step.kind === "create"
            ? green("✚")
            : step.kind === "update"
            ? yellow("↻")
            : red("✖");
          const action = step.kind === "create"
            ? gray("create")
            : step.kind === "update"
            ? gray("update")
            : gray("delete");
          this.writeMiddle(
            `${symbol} ${action} ${dim("│")} ${cyan(step.node.kind)} ${dim("│")} ${
              gray(step.node.id)
            }`,
          );
        }
      }
      this.#spinner.start(`${yellow("Applying changes…")}`);
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
      this.#spinner.succeed(
        `${bold(`${label} refreshed`)} ${dim("│")} ${gray("Project synchronized")}`,
      );
    } else {
      this.#spinner.succeed(
        `${gray("No changes applied")}`,
      );
    }
  }

  /**
   * Displays the final coherence status and next steps.
   *
   * @param status - The coherence status ("clean" or "pending")
   * @param entities - The number of entities in the project
   * @param appliedChanges - Whether changes were applied in this cycle
   */
  complete(status: "clean" | "pending", entities: number, appliedChanges = false): void {
    const entityInfo = formatCount(entities, "entity", "entities");
    if (status === "clean") {
      if (!appliedChanges) {
        // No changes were needed or applied
        this.#spinner.stop();
        this.write("");
        this.#spinner.succeed(
          `${bold("Project is coherent")} ${dim("│")} ${gray(`${entityInfo} validated`)}`,
        );
      }
      // If changes were applied, applyComplete already showed the success message

      if (this.#watchEnabled) {
        this.writeLast(`${gray("Ready. Watching for file changes…")}`);
      } else if (!appliedChanges) {
        this.write("");
        this.writeMiddle(`${magenta("◆")} ${bold("Next Steps")}`);
        this.writeMiddle(
          `${dim("→")} ${gray("Run ")}${cyan("tsera dev")}${gray(" to start watch mode")}`,
        );
        this.writeMiddle(
          `${dim("→")} ${gray("Or ")}${cyan("deno task dev")}${gray(" to launch your app")}`,
        );
        this.write("");
      } else {
        this.write("");
      }
    } else {
      this.#spinner.warn(
        `${bold("Inconsistencies detected")} ${dim("│")} ${gray(`${entityInfo} need sync`)}`,
      );
      this.write("");
      this.writeMiddle(`${magenta("◆")} ${bold("Next Steps")}`);
      this.writeMiddle(
        `${dim("→")} ${gray("Run ")}${cyan("tsera dev --apply")}${gray(" to force regeneration")}`,
      );
      this.writeMiddle(
        `${dim("→")} ${gray("Or ")}${cyan("tsera doctor --fix")}${gray(" to auto-repair issues")}`,
      );
      this.write("");
    }
  }

  /**
   * Reports an error during a dev cycle.
   *
   * @param message - The error message
   */
  cycleError(message: string): void {
    this.#spinner.fail(`${bold("Error")} ${dim("│")} ${gray(message)}`);
    this.write("");
    this.write(`${magenta("◆")} ${bold("What to do")}`);
    this.writeMiddle(`${dim("→")} ${yellow("Fix the error in your code")}`);
    if (this.#watchEnabled) {
      this.writeLast(`${gray("Save the file to retry automatically")}`);
    } else {
      this.writeLast(`${gray("Run ")}${cyan("tsera dev")}${gray(" again to retry")}`);
    }
    this.write("");
  }
}
