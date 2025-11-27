/**
 * UI component for the deploy sync command.
 *
 * Provides human-friendly console output for CD workflow synchronization,
 * matching the visual style of the init command.
 *
 * @module
 */
import { bold, cyan, dim, gray, green, magenta, yellow } from "../../ui/colors.ts";
import { BaseConsole } from "../../ui/console.ts";
import { formatRelativePath, sanitizeProjectDir } from "../../ui/formatters.ts";
import type { SyncResult } from "./utils/workflow-sync.ts";

/**
 * Options for creating a DeploySyncConsole instance.
 */
export interface DeploySyncConsoleOptions {
  /** The project directory */
  projectDir: string;
  /** Optional custom writer for output */
  writer?: (line: string) => void;
}

/**
 * Human-friendly console reporter for the deploy sync command.
 *
 * Provides visual feedback during CD workflow synchronization,
 * using tree-style formatting consistent with the init command.
 *
 * @example
 * ```typescript
 * const console = new DeploySyncConsole({
 *   projectDir: "/path/to/project",
 * });
 *
 * console.start();
 * console.trackWorkflow(".github/workflows/cd-docker-prod.yml", { action: "created" });
 * console.complete({ created: 2, updated: 0, removed: 0 });
 * ```
 */
export class DeploySyncConsole extends BaseConsole {
  /**
   * Project directory (sanitized).
   * @private
   */
  #projectDir: string;

  /**
   * Normalized project directory for path comparison.
   * @private
   */
  #normalizedDir: string;

  /**
   * Whether any workflows were synchronized.
   * @private
   */
  #hadChanges = false;

  /**
   * Creates a new deploy sync console instance.
   *
   * @param options - Configuration options
   */
  constructor(options: DeploySyncConsoleOptions) {
    super(options.writer);
    this.#projectDir = sanitizeProjectDir(options.projectDir);
    this.#normalizedDir = this.#projectDir.replace(/\\/g, "/");
  }

  /**
   * Announces the beginning of workflow synchronization.
   */
  start(): void {
    this.write("");
    this.write(
      `${magenta("◆")} ${bold("CD")} ${dim("│")} ${gray("Synchronizing workflows…")}`,
    );
  }

  /**
   * Announces that workflow generation is beginning.
   *
   * @param count - Number of workflows to generate
   */
  applyStart(count: number): void {
    const workflowLabel = count === 1 ? "workflow" : "workflows";
    this.writeMiddle(
      `${dim("→")} ${yellow("Writing generated files")} ${dim("│")} ${gray(`${count} ${workflowLabel}`)}`,
    );
  }

  /**
   * Starts tracking workflows for a specific provider.
   *
   * @param providerName - Display name of the provider (e.g., "Docker", "Deno Deploy")
   */
  startProvider(providerName: string): void {
    this.writeMiddle(`${cyan(providerName)}`);
  }

  /**
   * Tracks individual workflow operations.
   *
   * @param workflowPath - The workflow file path
   * @param result - The synchronization result
   */
  trackWorkflow(workflowPath: string, result: SyncResult): void {
    if (result.action === "skipped" || result.action === "conflict") {
      return; // Skip these in the main flow, they're handled separately
    }

    this.#hadChanges = true;
    const relativePath = this.#relative(workflowPath);
    let label: string;

    switch (result.action) {
      case "created":
        label = green("create");
        break;
      case "updated":
        label = yellow("update");
        break;
      default:
        label = gray(result.action);
    }

    this.writeSubItem(
      `  ${label} ${dim("→")} ${cyan(relativePath)}`,
    );
  }

  /**
   * Displays warnings for skipped workflows.
   *
   * @param workflowPath - The workflow file path
   */
  trackSkipped(workflowPath: string): void {
    const relativePath = this.#relative(workflowPath);
    this.writeSubItem(
      `  ${gray("skipped")} ${dim("→")} ${gray(relativePath)} ${dim("(manually modified)")}`,
    );
  }

  /**
   * Displays errors for conflicted workflows.
   *
   * @param workflowPath - The workflow file path
   */
  trackConflict(workflowPath: string): void {
    const relativePath = this.#relative(workflowPath);
    this.writeSubItem(
      `  ${magenta("conflict")} ${dim("→")} ${cyan(relativePath)} ${dim("(use --force)")}`,
    );
  }

  /**
   * Displays removed workflows.
   *
   * @param workflowPath - The workflow file path
   */
  trackRemoved(workflowPath: string): void {
    this.#hadChanges = true;
    const relativePath = this.#relative(workflowPath);
    this.writeSubItem(
      `  ${magenta("removed")} ${dim("→")} ${gray(relativePath)}`,
    );
  }

  /**
   * Provides a summary of the synchronization operation.
   *
   * @param summary - Summary with operation counts
   */
  complete(summary: {
    created: number;
    updated: number;
    removed: number;
    skipped: number;
    conflicts: number;
  }): void {
    if (this.#hadChanges || summary.removed > 0) {
      const parts: string[] = [];
      if (summary.created > 0) {
        parts.push(`${summary.created} ${summary.created === 1 ? "creation" : "creations"}`);
      }
      if (summary.updated > 0) {
        parts.push(`${summary.updated} ${summary.updated === 1 ? "update" : "updates"}`);
      }
      if (summary.removed > 0) {
        parts.push(`${summary.removed} ${summary.removed === 1 ? "removal" : "removals"}`);
      }

      const actions = parts.length > 0 ? gray(parts.join(" • ")) : "";
      this.writeLast(
        `${green("✓")} Workflows synchronized ${dim("│")} ${actions}`,
      );
    } else {
      this.writeLast(`${dim("·")} ${gray("No changes needed")}`);
    }

    if (summary.skipped > 0) {
      this.writeLast(
        `${yellow("⚠")} ${yellow(`${summary.skipped} workflow(s) skipped`)}, ${gray("(manually modified, use --force to overwrite)")}`,
      );
    }

    if (summary.conflicts > 0) {
      this.writeLast(
        `${magenta("✗")} ${magenta(`${summary.conflicts} workflow(s) have conflicts`)}, ${gray("(use --force to overwrite)")}`,
      );
    }
  }

  /**
   * Formats a path to be relative to the project directory.
   *
   * @param path - The absolute or relative path to format
   * @returns The relative path
   * @private
   */
  #relative(path: string): string {
    // If path is already relative (starts with . or doesn't start with / or drive letter), use it as-is
    const normalizedPath = path.replace(/\\/g, "/");
    if (normalizedPath.startsWith(".") || (!normalizedPath.startsWith("/") && !/^[A-Za-z]:/.test(normalizedPath))) {
      return normalizedPath;
    }
    // Otherwise, convert absolute path to relative
    return formatRelativePath(path, this.#normalizedDir);
  }
}

