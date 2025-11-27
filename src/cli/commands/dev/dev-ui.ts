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
    // Pad label to 10 characters to align the separator
    const paddedLabel = label.padEnd(10);
    this.write(dim("◆ ") + cyan(paddedLabel) + dim(" │ Starting..."));
  }

  /**
   * Parses URL to extract protocol, host, and port information.
   *
   * @param url - Full URL string
   * @returns Object with parsed components or null if parsing fails
   */
  private parseUrl(url: string): { protocol: string; host: string; port: string | null } | null {
    try {
      const urlObj = new URL(url);
      return {
        protocol: urlObj.protocol.replace(":", ""),
        host: urlObj.hostname,
        port: urlObj.port || null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Formats URL information for display.
   *
   * @param url - Full URL string
   * @returns Formatted string with protocol, host, and port
   */
  private formatUrlInfo(url: string): string {
    const parsed = this.parseUrl(url);
    if (!parsed) return cyan(url);

    const parts: string[] = [];
    parts.push(gray(parsed.protocol));
    parts.push(dim("@"));
    parts.push(cyan(parsed.host));
    if (parsed.port) {
      parts.push(dim(":"));
      parts.push(yellow(parsed.port));
    }
    return parts.join(" ") + dim(" (") + cyan(url) + dim(")");
  }

  /**
   * Displays a module ready message.
   *
   * @param name - Module name
   * @param url - Optional URL where the module is running
   */
  moduleReady(name: string, url?: string): void {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    // Pad label to 10 characters to align the separator
    const paddedLabel = label.padEnd(10);
    if (url) {
      const urlInfo = this.formatUrlInfo(url);
      this.write(green("✓ ") + cyan(paddedLabel) + dim(" │ Ready") + dim(" at ") + urlInfo);
    } else {
      this.write(green("✓ ") + cyan(paddedLabel) + dim(" │ Ready"));
    }
  }

  /**
   * Displays a module error message.
   *
   * @param name - Module name
   * @param error - Error message
   */
  moduleError(name: string, error: string): void {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    // Pad label to 10 characters to align the separator
    const paddedLabel = label.padEnd(10);
    this.write(red("✗ ") + cyan(paddedLabel) + dim(" │ ") + red(error));
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
          `🔍 ${bold("Change detected")} ${dim("│")} ${yellow(`${formatCount(affectedSteps.length, "artifact")} to sync`)
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
            `${symbol} ${action} ${dim("│")} ${cyan(step.node.kind)} ${dim("│")} ${gray(step.node.id)
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
    this.writeMiddle(`${yellow("Fix the error in your code")}`);
    if (this.#watchEnabled) {
      this.writeLast(`${gray("Save the file to retry automatically")}`);
    } else {
      this.writeLast(`${gray("Run ")}${cyan("tsera dev")}${gray(" again to retry")}`);
    }
    this.write("");
  }

  /**
   * Displays a warning when module errors are detected.
   */
  moduleErrorsWarning(): void {
    this.#spinner.stop();
    this.write("");
    this.write(
      `${yellow("⚠️  Module errors detected")} ${dim("│")} ${gray("Skipping coherence check until modules are fixed")}`,
    );
    // Don't add extra blank line - let the next message decide spacing
  }

  /**
   * Displays a message indicating that the system is checking if all modules have failed.
   */
  checkingModulesStatus(): void {
    this.#spinner.start(
      `${gray("Checking module status…")}`,
    );
  }

  /**
   * Stops the spinner if it's running.
   */
  stopSpinner(): void {
    this.#spinner.stop();
  }

  /**
   * Displays a message when all modules have failed and the process is exiting.
   * Optionally shows a summary of module statuses.
   */
  allModulesFailed(modules?: Map<string, { status: string; url?: string }>): void {
    this.write("");
    if (modules && modules.size > 0) {
      // Show summary without header for cleaner display
      this.write(`${red("✗ All modules failed")} ${dim("│")} ${gray("Status:")}`);
      for (const [name, info] of modules.entries()) {
        const label = name.charAt(0).toUpperCase() + name.slice(1);
        const statusText = info.status === "error"
          ? red("Error")
          : info.status === "starting"
            ? yellow("Starting")
            : gray(info.status);
        this.writeMiddle(`${dim("  •")} ${cyan(label)} ${dim("│")} ${statusText}`);
      }
      this.write("");
    } else {
      this.write(
        `${red("✗ Module loading failed")} ${dim("│")} ${gray("Exiting...")}`,
      );
      this.write("");
    }
  }

  /**
   * Displays a summary of all modules with their status and connection info.
   *
   * @param modules - Map of module names to their status and URLs
   * @param showHeader - Whether to show the "Services" header (default: true)
   */
  modulesStatus(modules: Map<string, { status: string; url?: string }>, showHeader: boolean = true): void {
    if (modules.size === 0) return;

    // Only show summary if at least one module has a meaningful status (not "stopped")
    const hasActiveStatus = Array.from(modules.values()).some(
      (info) => info.status !== "stopped"
    );
    if (!hasActiveStatus) return;

    // Only show summary if at least one module is ready (not just errors)
    // This prevents showing the summary when all modules are failing
    const hasReadyModule = Array.from(modules.values()).some(
      (info) => info.status === "ready"
    );
    if (!hasReadyModule) return; // Don't show summary if no module is ready

    this.write("");
    if (showHeader) {
      this.write(`${magenta("◆")} ${bold("Services")}`);
    }

    for (const [name, info] of modules.entries()) {
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      const statusIcon = info.status === "ready"
        ? green("✓")
        : info.status === "error"
          ? red("✗")
          : info.status === "starting"
            ? yellow("◆")
            : gray("○");

      const statusText = info.status === "ready"
        ? green("Ready")
        : info.status === "error"
          ? red("Error")
          : info.status === "starting"
            ? yellow("Starting")
            : gray("Stopped");

      if (info.url) {
        const urlInfo = this.formatUrlInfo(info.url);
        this.writeMiddle(
          `${statusIcon} ${cyan(label)} ${dim("│")} ${statusText} ${dim("│")} ${urlInfo}`,
        );
      } else {
        this.writeMiddle(`${statusIcon} ${cyan(label)} ${dim("│")} ${statusText}`);
      }
    }
    this.write("");
  }
}
