/**
 * Formatting functions for help output.
 *
 * @module
 */

import type { Palette } from "../../ui/palette.ts";
import { brightMagenta } from "../../ui/colors.ts";
import { visualWidth, wrapText } from "../../ui/text-utils.ts";
import type { ModernHelpCommand } from "./types.ts";

const INDENT_SPACES = 2;

/**
 * Center text within a box of specified width, applying palette highlighting to borders.
 *
 * @param text - Text content to center (may contain ANSI codes).
 * @param boxWidth - Total width of the box including borders.
 * @param palette - Color palette for styling borders.
 * @returns Formatted line with centered text and styled borders.
 */
export function centerInBox(text: string, boxWidth: number, palette: Palette): string {
  // Use the existing visualWidth function which handles ANSI codes
  const visualText = visualWidth(text);

  // Strip ANSI to check for emojis
  // deno-lint-ignore no-control-regex
  const textWithoutAnsi = text.replace(/\u001b\[[0-9;]*m/g, "");

  // Simple check: if text contains emoji-like characters
  const hasEmoji = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(textWithoutAnsi);

  // The content width is boxWidth minus the two border characters (│ on each side)
  const contentWidth = boxWidth - 2;

  // Calculate padding needed to center the text
  const totalPadding = Math.max(0, contentWidth - visualText);
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding; // Ensures exact fill

  const leftPad = " ".repeat(leftPadding);
  // Add extra space on the right if emoji is present (emojis are 2 chars wide visually)
  const rightPad = " ".repeat(rightPadding) + (hasEmoji ? " " : "");

  // Match the exact format of empty lines: "  │" (2 spaces + left border) + content + "│" (right border)
  return palette.highlight("  │") + leftPad + text + rightPad + palette.highlight("│");
}

/**
 * Format the usage section with a prefixed shell prompt accent.
 *
 * @param cliName - CLI binary name.
 * @param usage - Usage descriptor following the name.
 * @param palette - Active color palette.
 * @returns Single formatted usage line.
 */
export function formatUsage(cliName: string, usage: string, palette: Palette): string {
  const indent = " ".repeat(INDENT_SPACES);
  const command = `${cliName} ${usage}`.trim();
  return `${indent}${palette.accent("$")} ${palette.strong(command)}`;
}

/**
 * Format example commands, wrapping to the available width for readability.
 *
 * @param examples - Example commands to display.
 * @param width - Maximum characters per line.
 * @param palette - Active color palette.
 * @returns Array of formatted example lines.
 */
export function formatExamples(examples: string[], width: number, palette: Palette): string[] {
  const indent = "    ";
  const prompt = brightMagenta("$"); // Reserved color for code examples
  const available = Math.max(width - (indent.length + 2), 24);
  const lines: string[] = [];

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    const wrapped = wrapText(example, available);
    if (wrapped.length === 0) {
      lines.push(`${indent}${prompt}`.trimEnd());
      continue;
    }

    const [first, ...rest] = wrapped;
    lines.push(`${indent}${prompt} ${brightMagenta(first)}`.trimEnd()); // Reserved color for code examples
    for (const line of rest) {
      lines.push(`${indent}  ${palette.subtle(line)}`.trimEnd());
    }
  }

  return lines;
}

/**
 * Format entries such as commands or options in a two-column definition layout.
 *
 * Supports grouping entries by category if the category field is present.
 *
 * @param entries - Command or option descriptors.
 * @param width - Maximum characters per line.
 * @param palette - Active color palette.
 * @returns Array of formatted lines.
 */
export function formatTwoColumn(
  entries: ModernHelpCommand[],
  width: number,
  palette: Palette,
): string[] {
  if (entries.length === 0) {
    return [];
  }

  // Group entries by category if categories are present
  const hasCategories = entries.some((entry) => entry.category);
  const groupedEntries: Array<{ category?: string; entries: ModernHelpCommand[] }> = [];

  if (hasCategories) {
    const categoryMap = new Map<string, ModernHelpCommand[]>();
    const uncategorized: ModernHelpCommand[] = [];

    for (const entry of entries) {
      if (entry.category) {
        const category = entry.category;
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(entry);
      } else {
        uncategorized.push(entry);
      }
    }

    // Add categorized entries (sorted by category name)
    const sortedCategories = Array.from(categoryMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    for (const [category, categoryEntries] of sortedCategories) {
      groupedEntries.push({ category, entries: categoryEntries });
    }

    // Add uncategorized entries at the end
    if (uncategorized.length > 0) {
      groupedEntries.push({ entries: uncategorized });
    }
  } else {
    // No categories, just format all entries
    groupedEntries.push({ entries });
  }

  const labelWidth = Math.min(
    entries.reduce((max, entry) => Math.max(max, entry.label.length), 0),
    38,
  );
  const indent = "    ";
  const gap = "  ";
  const bullet = palette.subtle("▸");
  const available = Math.max(width - (indent.length + 2 + labelWidth + gap.length), 24);
  const emptyLabel = " ".repeat(labelWidth);

  const lines: string[] = [];

  for (const group of groupedEntries) {
    // Add category header if present
    if (group.category) {
      lines.push("");
      lines.push(`    ${palette.subtle(group.category)}`);
      lines.push("");
    }

    // Format entries in this group
    for (const entry of group.entries) {
      const paddedLabel = entry.label.padEnd(labelWidth, " ");
      const wrapped = wrapText(entry.description, available);

      if (wrapped.length === 0) {
        lines.push(`${indent}${bullet} ${palette.label(paddedLabel)}`.trimEnd());
        continue;
      }

      const [first, ...rest] = wrapped;
      lines.push(
        `${indent}${bullet} ${palette.strong(paddedLabel)}${gap}${palette.subtle(first)}`.trimEnd(),
      );
      for (const line of rest) {
        lines.push(
          `${indent}  ${palette.label(emptyLabel)}${gap}${palette.subtle(line)}`.trimEnd(),
        );
      }
    }
  }

  return lines;
}
