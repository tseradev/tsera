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
  /** Whether logs mode is enabled (shows module logs in real-time) */
  logsMode?: boolean;
  /** Optional custom writer for output */
  writer?: (line: string) => void;
}

/**
 * Status information for a module (secrets, backend, frontend).
 */
export interface ModuleStatus {
  /** Current status of the module */
  status: "stopped" | "starting" | "ready" | "error";
  /** URL where the module is accessible (if ready) */
  url?: string;
  /** Error message (if status is error) */
  error?: string;
}

/**
 * Human-friendly console reporter for the dev command.
 *
 * Provides visual feedback during development mode, including file
 * watch events, plan computation, artifact generation, and coherence
 * status updates.
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
   * Whether logs mode is enabled (shows module logs in real-time).
   * @private
   */
  #logsMode: boolean;

  /**
   * Number of lines currently occupied by the module list.
   * Used to clear the list before re-rendering.
   * @private
   */
  #moduleListLines = 0;

  /**
   * Whether a render is currently in progress.
   * @private
   */
  #rendering = false;

  /**
   * Debounce timer for renderModules.
   * @private
   */
  #renderTimer?: number;

  /**
   * Pending modules to render (last state wins).
   * @private
   */
  #pendingModules?: Map<string, ModuleStatus>;

  /**
   * Last rendered module state (for comparison).
   * @private
   */
  #lastRenderedState?: string;

  /**
   * Timer for the footer loader animation.
   * @private
   */
  #loaderTimer?: number;

  /**
   * Current frame index for the loader animation.
   * @private
   */
  #loaderFrame = 0;

  /**
   * Spinner frames for the loader animation (from TerminalSpinner).
   * @private
   */
  #loaderFrames = [
    gray("⠋"),
    gray("⠙"),
    gray("⠹"),
    gray("⠸"),
    gray("⠼"),
    gray("⠴"),
    gray("⠦"),
    gray("⠧"),
    gray("⠇"),
    gray("⠏"),
  ];

  /**
   * Creates a new dev console instance.
   *
   * @param options - Configuration options
   */
  constructor(options: DevConsoleOptions) {
    super(options.writer);
    this.#spinner = new TerminalSpinner(options.writer);
    this.#projectLabel = formatProjectLabel(options.projectDir);
    this.#logsMode = options.logsMode ?? false;
  }

  /**
   * Writes a line to stdout.
   * Overrides BaseConsole.write to use raw output for better control.
   */
  protected override write(line: string): void {
    this.writeRaw(line + "\n");
  }

  /**
   * Announces that dev mode has started.
   */
  start(): void {
    this.write(
      `⚙️  ${bold("TSera started for")} ${cyan(this.#projectLabel)} ${dim("(")}${green("watch")}${
        dim(")")
      }`,
    );
    this.writeLast(`${gray("Watching entities for changes…")}`);
  }

  /**
   * Displays the coherence check spinner.
   */
  startCoherenceCheck(): void {
    this.#spinner.start(gray("Verifying project coherence…"));
  }

  /**
   * Displays the coherence check success message.
   * @param entities Number of validated entities
   */
  coherenceSuccess(entities: number): void {
    const entityInfo = formatCount(entities, "entity", "entities");
    this.writeRaw(`\x1b[1A\x1b[2K`);
    this.#spinner.succeed(
      `${bold("Project is coherent")} ${dim("│")} ${gray(`${entityInfo} validated`)}`,
    );
  }

  /**
   * Displays the coherence check failure message.
   * @param entities Number of entities needing sync
   */
  coherenceFailure(entities: number): void {
    const entityInfo = formatCount(entities, "entity", "entities");
    this.#spinner.warn(
      `${bold("Inconsistencies detected")} ${dim("│")} ${gray(`${entityInfo} need sync`)}`,
    );
  }

  /**
   * Renders the list of modules with their current status.
   * Uses debouncing to batch rapid updates and clears previous render.
   * In logs mode, this method does nothing (modules are rendered at the end).
   *
   * @param modules Map of module names to their status
   */
  renderModules(modules: Map<string, ModuleStatus>): void {
    if (this.#logsMode) {
      return;
    }

    this.#pendingModules = new Map(modules);
    if (this.#renderTimer !== undefined) {
      clearTimeout(this.#renderTimer);
    }
    this.#renderTimer = setTimeout(() => {
      this.#renderTimer = undefined;
      this.#processPendingRender();
    }, 50) as unknown as number;
  }

  /**
   * Processes the pending render if one exists.
   * Checks state changes and prevents concurrent renders.
   * @private
   */
  #processPendingRender(): void {
    if (!this.#pendingModules || this.#rendering) {
      return;
    }

    const modules = this.#pendingModules;
    this.#pendingModules = undefined;

    const stateKey = Array.from(modules.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, status]) => `${name}:${status.status}:${status.url || ""}:${status.error || ""}`)
      .join("|");

    if (this.#lastRenderedState === stateKey) {
      return;
    }

    this.#rendering = true;
    try {
      this.#renderModulesSimple(modules, stateKey);
    } finally {
      this.#rendering = false;
    }
  }

  /**
   * Renders modules with proper line clearing.
   * Clears previous module lines before writing new ones.
   *
   * @param modules Map of module names to their status
   * @param stateKey String representation of the current state (for comparison)
   * @private
   */
  #renderModulesSimple(modules: Map<string, ModuleStatus>, stateKey: string): void {
    const { lines, allReady, anyError } = this.#buildModuleLines(modules);

    const newLineCount = lines.length;

    // Clear previous lines if we've rendered before
    if (this.#moduleListLines > 0) {
      // Go up to first module line, clear all lines, then return to start
      this.writeRaw(`\x1b[${this.#moduleListLines}A`);
      for (let i = 0; i < this.#moduleListLines; i++) {
        this.writeRaw(`\r\x1b[2K`);
        if (i < this.#moduleListLines - 1) {
          this.writeRaw(`\x1b[1B`);
        }
      }
      this.writeRaw(`\x1b[${this.#moduleListLines - 1}A\r`);
    }

    for (const line of lines) {
      this.write(line);
    }

    this.#moduleListLines = newLineCount;
    this.#lastRenderedState = stateKey;

    // Add loader on a new line if everything is ready
    if (allReady && !anyError && modules.size > 0) {
      const loader = this.#loaderFrames[this.#loaderFrame % this.#loaderFrames.length];
      // Write loader at start of line with space after (no newline yet)
      this.writeRaw(`${dim(loader)} `);
      this.#startLoaderAnimation();
    } else {
      this.#stopLoaderAnimation();
    }
  }

  /**
   * Writes raw text to stdout without newline.
   */
  private writeRaw(text: string): void {
    Deno.stdout.writeSync(new TextEncoder().encode(text));
  }

  /**
   * Formats URL information for display with consistent color.
   *
   * @param url The URL to format
   * @returns Formatted URL string with color codes
   * @private
   */
  private formatUrlInfo(url: string): string {
    return magenta(url);
  }

  /**
   * Displays a fatal error message and stops the spinner.
   *
   * @param message The error message to display
   */
  fatalError(message: string): void {
    this.#spinner.stop();
    this.write("");
    this.write(`${red("✖")} ${bold("Fatal Error")}`);
    this.writeLast(`${red(message)}`);
    this.write("");
  }

  /**
   * Announces the start of a dev cycle triggered by file changes.
   *
   * @param reason Reason for the cycle (e.g., "watch")
   * @param paths Array of file paths that changed
   */
  cycleStart(reason: string, paths: string[]): void {
    if (paths.length > 0) {
      const fileCount = formatCount(paths.length, "file");
      this.#spinner.start(
        `${bold("Change detected")} ${dim("│")} ${yellow(`${fileCount} modified`)}`,
      );
    } else if (reason === "watch") {
      this.#spinner.start(gray("Checking for changes..."));
    }
  }

  /**
   * Displays the plan summary showing what artifacts will be regenerated.
   *
   * @param summary Plan summary containing change information
   */
  planSummary(summary: PlanSummary): void {
    if (summary.changed) {
      const actions = formatActionSummaryWithSymbols(summary);
      this.#spinner.update(
        `${yellow("Regenerating artifacts")} ${dim("│")} ${actions}`,
      );
    } else {
      this.#spinner.stop();
    }
  }

  /**
   * Reports that artifact application is complete.
   *
   * @param steps Number of artifacts that were refreshed
   * @param changed Whether any artifacts were actually changed
   */
  applyComplete(steps: number, changed: boolean): void {
    if (changed) {
      const label = formatCount(steps, "artifact");
      this.#spinner.succeed(
        `${bold(`${label} refreshed`)} ${dim("│")} ${gray("Project synchronized")}`,
      );
    }
  }

  /**
   * Renders the final state of modules (used in logs mode or on completion/error).
   * This method always renders, even in logs mode, and doesn't clear previous lines.
   *
   * @param modules Map of module names to their status
   */
  renderModulesFinal(modules: Map<string, ModuleStatus>): void {
    if (this.#logsMode) {
      this.write("");
    }
    const { lines } = this.#buildModuleLines(modules);

    // Write all lines directly (they already contain the branch characters)
    for (const line of lines) {
      this.write(line);
    }
  }

  /**
   * Builds the module lines for display.
   * Creates formatted lines with status icons, labels, and footer message.
   *
   * @param modules Map of module names to their status
   * @returns Object containing lines array, sorted modules, and status flags
   * @private
   */
  #buildModuleLines(modules: Map<string, ModuleStatus>) {
    const lines: string[] = [];
    lines.push("");
    lines.push(`${magenta("◆")} ${bold("Modules")}`);

    const order = ["secrets", "backend", "frontend"];
    const sortedModules = Array.from(modules.entries()).sort((a, b) => {
      const indexA = order.indexOf(a[0]);
      const indexB = order.indexOf(b[0]);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });

    let allReady = true;
    let anyError = false;
    for (const [_, info] of sortedModules) {
      if (info.status === "error") anyError = true;
      if (info.status !== "ready") allReady = false;
    }

    for (const [name, info] of sortedModules) {
      const label = name === "secrets"
        ? "Secrets Manager"
        : name.charAt(0).toUpperCase() + name.slice(1);
      const paddedLabel = label.padEnd(15);

      let statusIcon = gray("○");
      let statusText = gray("Stopped");
      let details = "";

      switch (info.status) {
        case "starting":
          statusIcon = yellow("⠋");
          statusText = yellow("Starting...");
          break;
        case "ready":
          statusIcon = green("✓");
          statusText = green("Ready");
          if (info.url) {
            details = `${dim("│")} ${this.formatUrlInfo(info.url)}`;
          }
          break;
        case "error":
          statusIcon = red("✗");
          statusText = red("Error");
          if (info.error) {
            details = `${dim("│")} ${red(info.error)}`;
          }
          break;
        case "stopped":
        default:
          statusIcon = gray("○");
          statusText = gray("Stopped");
          break;
      }

      lines.push(
        `${dim("├─")} ${statusIcon} ${cyan(paddedLabel)} ${dim("│")} ${statusText} ${details}`,
      );
    }

    let footerMessage = "";
    if (anyError) {
      footerMessage = `${red("Error detected.")} ${gray("Check logs for details.")}`;
    } else if (allReady && sortedModules.length > 0) {
      footerMessage = `${green("Ready.")} ${gray("Watching for file changes…")}`;
    } else {
      footerMessage = `${yellow("Starting services…")}`;
    }
    lines.push(`${dim("└─")} ${footerMessage}`);

    return { lines, sortedModules, allReady, anyError };
  }

  /**
   * Starts the loader animation on the last line.
   * Updates only the loader character in place without re-rendering everything.
   * @private
   */
  #startLoaderAnimation(): void {
    if (this.#loaderTimer !== undefined) {
      return; // Already running
    }

    this.#loaderTimer = setInterval(() => {
      this.#loaderFrame = (this.#loaderFrame + 1) % this.#loaderFrames.length;
      const loader = this.#loaderFrames[this.#loaderFrame % this.#loaderFrames.length];
      // Update only the last line (loader line) in place
      // Go to start of current line, clear it, write new loader with space before cursor
      this.writeRaw(`\r\x1b[2K${dim(loader)} `);
    }, 100) as unknown as number;
  }

  /**
   * Stops the loader animation.
   * @private
   */
  #stopLoaderAnimation(): void {
    if (this.#loaderTimer !== undefined) {
      clearInterval(this.#loaderTimer);
      this.#loaderTimer = undefined;
    }
  }
}
