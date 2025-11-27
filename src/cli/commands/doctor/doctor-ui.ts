/**
 * UI component for the doctor command.
 *
 * Provides human-friendly console output for diagnosing and fixing
 * project coherence issues.
 *
 * @module
 */

import { bold, cyan, dim, gray, green, magenta, yellow } from "../../ui/colors.ts";
import { TerminalSpinner } from "../../ui/spinner.ts";
import { BaseConsole } from "../../ui/console.ts";
import {
  formatActionLabel,
  formatActionSummaryWithSymbols,
  formatCount,
  formatProjectLabel,
  type PlanSummary,
} from "../../ui/formatters.ts";

/**
 * Options for creating a DoctorConsole instance.
 */
export interface DoctorConsoleOptions {
  /** The project directory being diagnosed */
  projectDir: string;
  /** Whether auto-fix mode is enabled */
  fix: boolean;
  /** Whether quick mode is enabled (shows only changes) */
  quick: boolean;
  /** Optional custom writer for output */
  writer?: (line: string) => void;
}

/**
 * Human-friendly console reporter for the doctor command.
 *
 * Provides visual feedback during project diagnosis and repair,
 * using a terminal spinner and formatted tree output. Automatically
 * adapts between fix and analysis modes.
 *
 * @example
 * ```typescript
 * const console = new DoctorConsole({
 *   projectDir: "/path/to/project",
 *   fix: true,
 * });
 *
 * console.start();
 * console.planReady(summary, 5);
 * console.beginFix(3);
 * // ... track fix progress ...
 * console.completeFix(3);
 * ```
 */
export class DoctorConsole extends BaseConsole {
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
   * Whether auto-fix mode is enabled.
   * @private
   */
  #fixEnabled: boolean;

  /**
   * Whether quick mode is enabled.
   * @private
   */
  #quickMode: boolean;

  /**
   * Counter for completed fix operations.
   * @private
   */
  #completed = 0;

  /**
   * Creates a new doctor console instance.
   *
   * @param options - Configuration options
   */
  constructor(options: DoctorConsoleOptions) {
    super(options.writer);
    this.#spinner = new TerminalSpinner(options.writer);
    this.#projectLabel = formatProjectLabel(options.projectDir);
    this.#fixEnabled = options.fix;
    this.#quickMode = options.quick;
  }

  /**
   * Announces the beginning of the diagnosis process.
   *
   * Displays the project name and current mode (analysis or auto-fix).
   */
  start(): void {
    let mode: string;
    if (this.#fixEnabled) {
      mode = `${green("auto-fix enabled")}`;
    } else if (this.#quickMode) {
      mode = `${yellow("quick mode")}`;
    } else {
      mode = `${gray("analysis mode")}`;
    }
    this.#spinner.start(
      `${magenta("◆")} ${bold("Doctor")} ${dim("│")} ${cyan(this.#projectLabel)} ${
        dim("│")
      } ${mode}`,
    );
  }

  /**
   * Reports that the plan computation is complete.
   *
   * @param summary - The plan summary with operation counts
   * @param entities - The number of entities analyzed
   */
  planReady(summary: PlanSummary, entities: number): void {
    if (this.#quickMode) {
      // In quick mode, show a simpler message
      this.#spinner.update(
        `${gray("Checking entities and artifacts…")}`,
      );
    } else {
      const checks = formatCount(summary.total ?? 0, "check");
      const entityInfo = gray(formatCount(entities, "entity", "entities"));
      this.#spinner.update(
        `${dim("→")} ${bold(checks)} performed ${dim("│")} ${entityInfo}`,
      );
    }
  }

  /**
   * Confirms that no issues were found.
   *
   * @param entities - The number of entities verified
   * @param quick - Whether quick mode is enabled
   */
  allClear(entities: number, quick: boolean = false): void {
    if (quick) {
      // In quick mode, show a simpler message
      this.#spinner.succeed(
        `${bold("Project is coherent")} ${dim("│")} ${
          gray(formatCount(entities, "entity validated", "entities validated"))
        }`,
      );
    } else {
      const label = formatCount(entities, "entity verified", "entities verified");
      this.#spinner.succeed(
        `${bold("All checks passed")} ${dim("│")} ${gray(label)}`,
      );
      this.writeLast(`${gray("The project is coherent. No fixes required.")}`);
    }
  }

  /**
   * Reports issues that were detected during diagnosis.
   *
   * @param summary - The plan summary with operation counts
   */
  reportIssues(summary: PlanSummary): void {
    if (this.#quickMode) {
      // In quick mode, show a simpler message
      const actions = formatActionSummaryWithSymbols(summary);
      this.#spinner.update(
        `${yellow("Regenerating artifacts")} ${dim("│")} ${actions}`,
      );
    } else {
      const headline = formatActionSummaryWithSymbols(summary);
      this.#spinner.warn(`${bold("Fixes required")} ${dim("│")} ${headline}`);
    }
  }

  /**
   * Announces that auto-fix is beginning.
   *
   * @param total - The total number of actions to apply
   */
  beginFix(total: number): void {
    const label = formatCount(total, "action");
    this.#spinner.update(
      `${dim("→")} ${yellow("Auto-fix in progress")} ${dim("│")} ${gray(label)}`,
    );
    if (total === 0) {
      this.writeLast(`${gray("Analyzing remaining inconsistencies…")}`);
    }
  }

  /**
   * Tracks progress of individual fix operations.
   *
   * @param kind - The kind of operation (create/update/delete)
   * @param path - The file path being fixed (if applicable)
   * @param total - The total number of operations
   */
  trackFixProgress(kind: string, path: string | undefined, total: number): void {
    this.#completed += 1;
    const label = formatActionLabel(kind as "create" | "update" | "delete" | "noop");
    const progress = total > 0 ? `${this.#completed}/${total}` : `${this.#completed}`;
    const target = path ? cyan(path) : gray("(internal)");
    this.#spinner.update(
      `${dim("→")} ${yellow("Auto-fix")} ${dim("│")} ${progress} ${dim("│")} ${label} ${
        dim("→")
      } ${target}`,
    );
  }

  /**
   * Confirms that all fixes were successfully applied.
   *
   * @param applied - The number of fixes applied
   */
  completeFix(applied: number): void {
    const label = formatCount(applied, "fix", "fixes");
    this.#spinner.succeed(
      `${bold("Sync complete")} ${dim("│")} ${gray(`${label} applied`)}`,
    );
    this.writeLast(`${gray("You are ready to continue.")}`);
  }

  /**
   * Reports that some inconsistencies remain after fixing.
   *
   * @param summary - The remaining plan summary
   */
  reportPending(summary: PlanSummary): void {
    const remaining = summary.create + summary.update + summary.delete;
    const label = formatCount(remaining, "action");
    this.#spinner.fail(
      `${bold("Inconsistencies remain")} ${dim("│")} ${gray(`${label} to address`)}`,
    );
    this.writeLast(`${gray("Run the command again to finish repairing.")}`);
  }

  /**
   * Suggests next steps when no fixes were applied.
   *
   * Provides actionable commands for the user to run.
   */
  suggestNextSteps(): void {
    this.#spinner.warn(
      `${bold("No fixes applied")} ${dim("│")} ${gray("read-only mode")}`,
    );
    this.write("");
    this.writeMiddle(`${magenta("◆")} ${bold("Next Steps")}`);
    this.writeMiddle(
      `${gray("Run ")}${cyan("tsera doctor --fix")}${gray(" to correct issues automatically")}`,
    );
    this.writeMiddle(
      `${gray("Or ")}${cyan("tsera dev --apply")}${gray(" to force a full regeneration")}`,
    );
    this.write("");
  }
}
