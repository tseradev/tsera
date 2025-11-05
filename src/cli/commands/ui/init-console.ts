import { join } from "../../../shared/path.ts";
import { bold, cyan, dim, gray, green, magenta, yellow } from "../../ui/colors.ts";
import type { PlanStepKind, PlanSummary } from "../../engine/planner.ts";
import { formatProjectLabel, sanitizeProjectDir } from "../utils/file-ops.ts";

/**
 * Human-friendly progress reporter for {@code tsera init} when JSON output is disabled.
 */
export class InitConsole {
  #writer: (line: string) => void;
  #projectDir: string;
  #projectLabel: string;
  #template: string;
  #hadChanges = false;
  #normalizedDir: string;

  constructor(options: {
    projectDir: string;
    template: string;
    writer?: (line: string) => void;
  }) {
    this.#writer = options.writer ?? ((line: string) => console.log(line));
    this.#projectDir = sanitizeProjectDir(options.projectDir);
    this.#normalizedDir = this.#projectDir.replace(/\\/g, "/");
    this.#projectLabel = formatProjectLabel(this.#projectDir);
    this.#template = options.template;
  }

  /** Announces the beginning of the scaffolding process. */
  start(): void {
    this.#writer(
      `${magenta("Init")} ${dim("•")} ${cyan(this.#projectLabel)} ${dim("│ using template ")}${gray(this.#template)
      }`,
    );
    this.#writer(`${dim("└─")} ${gray("Preparing project folder…")}`);
  }

  /** Reports how many template files were copied or reused. */
  templateReady(copied: number, skipped: number): void {
    const copiedLabel = copied === 1 ? "file copied" : "files copied";
    const skippedLabel = skipped > 0
      ? `${dim(" • ")}${gray(`${skipped} ${skipped === 1 ? "file skipped" : "files skipped"}`)}`
      : "";
    this.#writer(
      `${dim("├─")} ${green(`${copied} ${copiedLabel}`)}${skippedLabel}`,
    );
  }

  /** Highlights that the configuration file is ready to edit. */
  configReady(path: string): void {
    this.#writer(
      `${dim("├─")} ${green("Configuration ready")}${dim(" • ")}${gray(this.#relative(path))}`,
    );
  }

  /** States whether a .gitignore file was written. */
  gitignoreReady(path: string, created: boolean): void {
    if (created) {
      this.#writer(
        `${dim("├─")} ${green("Added .gitignore")}${dim(" • ")}${gray(this.#relative(path))}`,
      );
    } else {
      this.#writer(`${dim("├─")} ${gray("Existing .gitignore kept as-is")}`);
    }
  }

  /** Summarises the discovered entities and plan outcome. */
  planReady(summary: PlanSummary, entities: number): void {
    const entityLabel = entities === 1 ? "entity" : "entities";
    const base = `${entities} ${entityLabel} detected`;
    if (summary.changed) {
      this.#writer(
        `${dim("├─")} ${yellow("Generating project assets")}${dim(" • ")}${gray(base)}`,
      );
    } else {
      this.#writer(`${dim("├─")} ${green("Artifacts already in sync")}${dim(" • ")}${gray(base)}`);
    }
  }

  /** Announces that artifact generation is about to begin. */
  applyStart(summary: PlanSummary): void {
    this.#hadChanges = true;
    const actions = formatActionSummary(summary);
    this.#writer(`${dim("├─")} ${yellow("Writing generated files")}${dim(" • ")}${gray(actions)}`);
  }

  /** Tracks individual artifact operations while generating outputs. */
  trackStep(kind: PlanStepKind, path: string | undefined, changed: boolean): void {
    if (!changed && kind !== "delete") {
      return;
    }
    const label = formatStepLabel(kind);
    const location = path ? cyan(this.#relative(join(this.#projectDir, path))) : gray("internal");
    this.#writer(`${dim("│  ")} ${label}${dim(" → ")}${location}`);
  }

  /** Confirms that all requested artifacts were written. */
  applyComplete(summary: PlanSummary): void {
    const actions = formatActionSummary(summary);
    this.#writer(`${dim("├─")} ${green("Artifacts updated")}${dim(" • ")}${gray(actions)}`);
  }

  /** Shares that no artifacts required regeneration. */
  alreadySynced(): void {
    this.#writer(`${dim("├─")} ${gray("Everything was already up to date")}`);
  }

  /** Provides closing guidance on the next recommended steps. */
  complete(): void {
    this.#writer(`${green("✔")} ${bold("Project ready!")}`);
    const recap = this.#hadChanges
      ? gray("Generated project assets for you.")
      : gray("Project files were already current.");
    this.#writer(`${dim("├─")} ${recap}`);
    this.#writer(`${dim("└─")} ${gray("Next steps:")}`);
    this.#writer(`${dim("   • ")}${cyan(`cd ${this.#projectDir}`)}`);
    this.#writer(
      `${dim("   • ")}${cyan('git init && git add -A && git commit -m "feat: boot tsera"')}`,
    );
    this.#writer(`${dim("   • ")}${cyan("tsera dev --watch")}`);
  }

  /** Formats an absolute path so it is shown relative to the project directory when possible. */
  #relative(path: string): string {
    const normalised = path.replace(/\\/g, "/");
    if (normalised.startsWith(this.#normalizedDir)) {
      const suffix = normalised.slice(this.#normalizedDir.length).replace(/^\//, "");
      return suffix.length > 0 ? suffix : ".";
    }
    return path;
  }
}

/** Converts plan summary counts into a short human readable phrase. */
function formatActionSummary(summary: PlanSummary): string {
  const parts: string[] = [];
  if (summary.create > 0) {
    parts.push(`${summary.create} ${summary.create === 1 ? "creation" : "creations"}`);
  }
  if (summary.update > 0) {
    parts.push(`${summary.update} ${summary.update === 1 ? "update" : "updates"}`);
  }
  if (summary.delete > 0) {
    parts.push(`${summary.delete} ${summary.delete === 1 ? "deletion" : "deletions"}`);
  }
  return parts.length > 0 ? parts.join(" • ") : "no changes";
}

/** Chooses a color-coded label for the given plan step kind. */
function formatStepLabel(kind: PlanStepKind): string {
  switch (kind) {
    case "create":
      return green("create");
    case "update":
      return yellow("update");
    case "delete":
      return magenta("delete");
    default:
      return gray(kind);
  }
}


