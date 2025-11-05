/**
 * Shared formatting utilities for CLI output.
 *
 * This module provides reusable formatting functions for converting
 * data structures into human-readable, color-coded terminal output.
 * All formatters respect the {@link Deno.noColor} setting.
 *
 * @module
 *
 * @example
 * ```typescript
 * import { formatProjectLabel, formatActionSummary } from "./formatters.ts";
 *
 * const label = formatProjectLabel("/path/to/my-project");
 * console.log(label); // "my-project"
 *
 * const summary = formatActionSummary({ create: 3, update: 2, delete: 1 });
 * console.log(summary); // "3 creations • 2 updates • 1 deletion"
 * ```
 */

import { gray, green, magenta, yellow } from "./colors.ts";
import type { PlanStepKind } from "../engine/planner.ts";

/**
 * Plan summary containing operation counts.
 */
export interface PlanSummary {
  /** Number of create operations */
  create: number;
  /** Number of update operations */
  update: number;
  /** Number of delete operations */
  delete: number;
  /** Number of no-op operations */
  noop?: number;
  /** Total number of operations */
  total?: number;
  /** Whether any changes are present */
  changed?: boolean;
}

/**
 * Formats a directory path into a concise project label.
 *
 * Extracts and returns the last segment of the path, which typically
 * represents the project name.
 *
 * @param dir - The full directory path
 * @returns The last segment of the path (project name)
 *
 * @example
 * ```typescript
 * formatProjectLabel("/home/user/projects/my-app");
 * // Returns: "my-app"
 *
 * formatProjectLabel("C:\\Projects\\demo-app");
 * // Returns: "demo-app"
 *
 * formatProjectLabel(".");
 * // Returns: "."
 * ```
 */
export function formatProjectLabel(dir: string): string {
  const segments = dir.split(/[/\\]+/).filter((part) => part.length > 0);
  return segments[segments.length - 1] ?? dir;
}

/**
 * Normalizes trailing path separators from a directory path.
 *
 * Removes trailing slashes or backslashes to ensure consistent
 * path representation.
 *
 * @param projectDir - The directory path to sanitize
 * @returns The path without trailing separators
 *
 * @example
 * ```typescript
 * sanitizeProjectDir("/path/to/project/");
 * // Returns: "/path/to/project"
 *
 * sanitizeProjectDir("C:\\project\\");
 * // Returns: "C:\\project"
 * ```
 */
export function sanitizeProjectDir(projectDir: string): string {
  return projectDir.replace(/[\\/]+$/, "");
}

/**
 * Formats an absolute path to be relative to a project directory.
 *
 * If the path is within the project directory, returns a relative path.
 * Otherwise, returns the original path unchanged.
 *
 * @param path - The absolute path to format
 * @param projectDir - The project root directory
 * @returns The relative path or original path
 *
 * @example
 * ```typescript
 * formatRelativePath("/project/src/main.ts", "/project");
 * // Returns: "src/main.ts"
 *
 * formatRelativePath("/other/file.ts", "/project");
 * // Returns: "/other/file.ts"
 * ```
 */
export function formatRelativePath(path: string, projectDir: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const normalizedDir = projectDir.replace(/\\/g, "/");

  if (normalizedPath.startsWith(normalizedDir)) {
    const suffix = normalizedPath.slice(normalizedDir.length).replace(/^\//, "");
    return suffix.length > 0 ? suffix : ".";
  }

  return path;
}

/**
 * Formats a plan step action into a color-coded label.
 *
 * Converts action types (create/update/delete) into styled terminal
 * output with appropriate colors:
 * - create: green
 * - update: yellow
 * - delete: magenta
 * - other: gray
 *
 * @param kind - The plan step action type
 * @returns Color-coded action label
 *
 * @example
 * ```typescript
 * formatActionLabel("create");  // Green "create"
 * formatActionLabel("update");  // Yellow "update"
 * formatActionLabel("delete");  // Magenta "delete"
 * ```
 */
export function formatActionLabel(kind: PlanStepKind): string {
  switch (kind) {
    case "create":
      return green("create");
    case "update":
      return yellow("update");
    case "delete":
      return magenta("delete");
    case "noop":
      return gray("noop");
    default:
      return gray(kind);
  }
}

/**
 * Formats a plan step action with a symbolic prefix.
 *
 * Similar to {@link formatActionLabel} but adds symbolic prefixes:
 * - create: +
 * - update: ⇄
 * - delete: −
 *
 * @param kind - The plan step action type
 * @returns Color-coded action with symbol
 *
 * @example
 * ```typescript
 * formatActionWithSymbol("create");  // Green "+creation"
 * formatActionWithSymbol("update");  // Yellow "⇄update"
 * formatActionWithSymbol("delete");  // Magenta "−deletion"
 * ```
 */
export function formatActionWithSymbol(kind: PlanStepKind): string {
  switch (kind) {
    case "create":
      return green("creation");
    case "update":
      return yellow("update");
    case "delete":
      return magenta("deletion");
    default:
      return gray(kind);
  }
}

/**
 * Formats a plan summary into a human-readable text description.
 *
 * Converts operation counts into a natural language summary with
 * proper pluralization. Operations with zero count are omitted.
 *
 * @param summary - The plan summary with operation counts
 * @returns Human-readable summary text
 *
 * @example
 * ```typescript
 * formatActionSummary({ create: 3, update: 1, delete: 0 });
 * // Returns: "3 creations • 1 update"
 *
 * formatActionSummary({ create: 0, update: 0, delete: 0 });
 * // Returns: "no changes"
 * ```
 */
export function formatActionSummary(summary: PlanSummary): string {
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

/**
 * Formats a plan summary with color-coded symbols and counts.
 *
 * Creates a detailed summary with symbolic prefixes and colors for each
 * operation type. Operations with zero count are omitted.
 *
 * @param summary - The plan summary with operation counts
 * @returns Color-coded summary with symbols
 *
 * @example
 * ```typescript
 * formatActionSummaryWithSymbols({ create: 3, update: 2, delete: 1 });
 * // Returns: "+3 creations  •  ⇄2 updates  •  −1 deletion"
 * ```
 */
export function formatActionSummaryWithSymbols(summary: PlanSummary): string {
  const actions: string[] = [];

  if (summary.create > 0) {
    actions.push(
      `${green("+" + summary.create)} ${gray(summary.create === 1 ? "creation" : "creations")}`,
    );
  }
  if (summary.update > 0) {
    actions.push(
      `${yellow("⇄" + summary.update)} ${gray(summary.update === 1 ? "update" : "updates")}`,
    );
  }
  if (summary.delete > 0) {
    actions.push(
      `${magenta("−" + summary.delete)} ${gray(summary.delete === 1 ? "deletion" : "deletions")}`,
    );
  }

  return actions.length > 0 ? actions.join(`  ${gray("•")}  `) : gray("Comparison complete");
}

/**
 * Formats a count with a pluralized label.
 *
 * Helper function to format numeric counts with singular/plural forms.
 *
 * @param count - The number to format
 * @param singular - The singular form of the label
 * @param plural - The plural form of the label (defaults to singular + "s")
 * @returns Formatted count with appropriate label
 *
 * @example
 * ```typescript
 * formatCount(1, "file");      // "1 file"
 * formatCount(5, "file");      // "5 files"
 * formatCount(1, "entity", "entities");  // "1 entity"
 * formatCount(3, "entity", "entities");  // "3 entities"
 * ```
 */
export function formatCount(count: number, singular: string, plural?: string): string {
  const label = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${label}`;
}
