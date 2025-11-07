/**
 * UI component for the init command.
 *
 * Provides human-friendly console output for project initialization,
 * scaffolding, and artifact generation.
 *
 * @module
 */
import { join } from "../../../shared/path.ts";
import { bold, cyan, dim, gray, green, magenta, yellow } from "../../ui/colors.ts";
import { BaseConsole } from "../../ui/console.ts";
import {
  formatActionLabel,
  formatActionSummary,
  formatCount,
  formatProjectLabel,
  formatRelativePath,
  type PlanSummary,
  sanitizeProjectDir,
} from "../../ui/formatters.ts";
import type { PlanStepKind } from "../../engine/planner.ts";

/**
 * Options for creating an InitConsole instance.
 */
export interface InitConsoleOptions {
  /** The project directory being initialized */
  projectDir: string;
  /** The template being used */
  template: string;
  /** Optional custom writer for output */
  writer?: (line: string) => void;
}

/**
 * Human-friendly console reporter for the init command.
 *
 * Provides visual feedback during project scaffolding and initialization,
 * using tree-style formatting for structured output.
 *
 * @example
 * ```typescript
 * const console = new InitConsole({
 *   projectDir: "/path/to/new-project",
 *   template: "base",
 * });
 *
 * console.start();
 * console.templateReady(12, 0);
 * console.configReady("tsera.config.ts");
 * console.complete();
 * ```
 */
export class InitConsole extends BaseConsole {
  /**
   * Project directory (sanitized).
   * @private
   */
  #projectDir: string;

  /**
   * Project label derived from directory path.
   * @private
   */
  #projectLabel: string;

  /**
   * Template name being used.
   * @private
   */
  #template: string;

  /**
   * Whether any changes were made during initialization.
   * @private
   */
  #hadChanges = false;

  /**
   * Normalized project directory for path comparison.
   * @private
   */
  #normalizedDir: string;

  /**
   * Creates a new init console instance.
   *
   * @param options - Configuration options
   */
  constructor(options: InitConsoleOptions) {
    super(options.writer);
    this.#projectDir = sanitizeProjectDir(options.projectDir);
    this.#normalizedDir = this.#projectDir.replace(/\\/g, "/");
    this.#projectLabel = formatProjectLabel(this.#projectDir);
    this.#template = options.template;
  }

  /**
   * Announces the beginning of the scaffolding process.
   *
   * Displays the project name and template being used.
   */
  start(): void {
    this.write(
      `${magenta("◆")} ${bold("Init")} ${dim("│")} ${cyan(this.#projectLabel)}`,
    );
    this.writeMiddle(`${dim("→")} ${gray(`Using template: ${this.#template}`)}`);
    this.writeLast(`${dim("→")} ${gray("Preparing project folder…")}`);
  }

  /**
   * Reports how many template files were copied or reused.
   *
   * @param copied - Number of files copied
   * @param skipped - Number of files skipped (already exist)
   */
  templateReady(copied: number, skipped: number): void {
    const copiedLabel = formatCount(copied, "file copied", "files copied");
    const skippedInfo = skipped > 0
      ? `${dim(" • ")}${gray(formatCount(skipped, "file skipped", "files skipped"))}`
      : "";
    this.writeMiddle(`${green("✓")} ${copiedLabel}${skippedInfo}`);
  }

  /**
   * Highlights that the configuration file is ready.
   *
   * @param path - The path to the config file
   */
  configReady(path: string): void {
    this.writeMiddle(
      `${green("✓")} Configuration ready ${dim("→")} ${gray(this.#relative(path))}`,
    );
  }

  /**
   * Reports whether a .gitignore file was written.
   *
   * @param path - The path to the .gitignore file
   * @param created - Whether the file was created (true) or kept as-is (false)
   */
  gitignoreReady(path: string, created: boolean): void {
    if (created) {
      this.writeMiddle(
        `${green("✓")} Added .gitignore ${dim("→")} ${gray(this.#relative(path))}`,
      );
    } else {
      this.writeMiddle(`${dim("·")} ${gray("Existing .gitignore kept as-is")}`);
    }
  }

  /**
   * Summarizes the discovered entities and plan outcome.
   *
   * @param summary - The plan summary
   * @param entities - The number of entities discovered
   */
  planReady(summary: PlanSummary, entities: number): void {
    const entityInfo = formatCount(entities, "entity", "entities") + " detected";
    this.write("");
    this.writeMiddle(`${magenta("◆")} ${bold("Artifacts")} ${dim("│")} ${gray(entityInfo)}`);
    if (summary.changed) {
      this.writeMiddle(
        `${dim("→")} ${yellow("Generating project assets…")}`,
      );
    } else {
      this.writeMiddle(`${green("✓")} ${gray("Artifacts already in sync")}`);
    }
  }

  /**
   * Announces that artifact generation is beginning.
   *
   * @param summary - The plan summary with operation counts
   */
  applyStart(summary: PlanSummary): void {
    this.#hadChanges = true;
    const actions = formatActionSummary(summary);
    this.writeMiddle(
      `${dim("→")} ${yellow("Writing generated files")} ${dim("│")} ${gray(actions)}`,
    );
  }

  /**
   * Tracks individual artifact operations.
   *
   * @param kind - The operation kind (create/update/delete)
   * @param path - The file path being modified
   * @param changed - Whether the file was actually changed
   */
  trackStep(kind: PlanStepKind, path: string | undefined, changed: boolean): void {
    if (!changed && kind !== "delete") {
      return;
    }
    const label = formatActionLabel(kind);
    const location = path ? cyan(this.#relative(join(this.#projectDir, path))) : gray("internal");
    this.writeSubItem(`  ${label} ${dim("→")} ${location}`);
  }

  /**
   * Confirms that all requested artifacts were written.
   *
   * @param summary - The plan summary with operation counts
   */
  applyComplete(summary: PlanSummary): void {
    const actions = formatActionSummary(summary);
    this.writeMiddle(`${green("✓")} Artifacts updated ${dim("│")} ${gray(actions)}`);
  }

  /**
   * Reports that no artifacts required regeneration.
   */
  alreadySynced(): void {
    this.writeMiddle(`${dim("·")} ${gray("Everything was already up to date")}`);
  }

  /**
   * Provides closing guidance on the next recommended steps.
   *
   * Displays success message and suggests next commands to run.
   */
  complete(): void {
    this.write("");
    this.write(`${green("✓")} ${bold("Project ready!")}`);
    const recap = this.#hadChanges
      ? gray("Generated project assets for you.")
      : gray("Project files were already current.");
    this.writeMiddle(recap);
    this.write("");
    this.writeMiddle(`${magenta("◆")} ${bold("Next Steps")}`);
    this.writeMiddle(`${dim("→")} ${cyan(`cd ${this.#projectLabel}`)}`);
    this.writeMiddle(
      `${dim("→")} ${cyan('git init && git add -A && git commit -m "feat: boot tsera"')}`,
    );
    this.writeMiddle(`${dim("→")} ${cyan("tsera dev")}`);
    this.write("");
  }

  /**
   * Formats an absolute path to be relative to the project directory.
   *
   * @param path - The absolute path to format
   * @returns The relative path or original path
   * @private
   */
  #relative(path: string): string {
    return formatRelativePath(path, this.#normalizedDir);
  }
}
