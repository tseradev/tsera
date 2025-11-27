/**
 * Help rendering functions.
 *
 * @module
 */

import { createPalette } from "../../ui/palette.ts";
import { clampWidth, detectTerminalWidth } from "../../ui/terminal.ts";
import { StringBuilder } from "../../ui/text-utils.ts";
import { centerInBox, formatExamples, formatTwoColumn, formatUsage } from "./formatters.ts";
import type { ModernHelpConfig } from "./types.ts";

/**
 * Render a concise fallback help output when modern rendering fails.
 *
 * @param config - Descriptor of commands and metadata to display.
 * @returns Plain text fallback help copy.
 */
export function renderFallback(config: ModernHelpConfig): string {
  const lines: string[] = [
    `${config.cliName} v${config.version}`,
    "",
    config.tagline,
    "",
    `Usage: ${config.cliName} ${config.usage}`.trim(),
    "",
  ];

  if (config.globalOptions.length > 0) {
    lines.push("Global Options:");
    const maxLabelLength = config.globalOptions.reduce(
      (max, opt) => Math.max(max, opt.label.length),
      0,
    );
    for (const opt of config.globalOptions) {
      const padded = opt.label.padEnd(maxLabelLength + 2, " ");
      lines.push(`  ${padded}${opt.description}`);
    }
    lines.push("");
  }

  if (config.commands.length > 0) {
    lines.push("Commands:");
    const maxLabelLength = config.commands.reduce(
      (max, cmd) => Math.max(max, cmd.label.length),
      0,
    );
    for (const cmd of config.commands) {
      const padded = cmd.label.padEnd(maxLabelLength + 2, " ");
      lines.push(`  ${padded}${cmd.description}`);
    }
    lines.push("");
  }

  if (config.examples.length > 0) {
    lines.push("Examples:");
    for (const example of config.examples) {
      lines.push(`  ${example}`);
    }
  }

  return lines.join("\n");
}

/**
 * Render the full modern help layout with accent colors and structured sections.
 *
 * @param config - Descriptor of commands and metadata to display.
 * @returns Fully formatted help screen.
 */
export function renderModernHelp(config: ModernHelpConfig): string {
  const palette = createPalette(config.theme);
  const width = clampWidth(detectTerminalWidth() ?? 84);
  const builder = new StringBuilder();

  // Modern header with logo
  // Adaptive box width: 75% of terminal width, clamped between 50 and 64
  const boxWidth = Math.min(64, Math.max(50, Math.floor(width * 0.75)));
  const topLine = "╭" + "─".repeat(boxWidth - 2) + "╮";
  const bottomLine = "╰" + "─".repeat(boxWidth - 2) + "╯";

  // Build header content
  const versionText = `v${config.version}`;
  const emoji = "⚙️ ";
  const titleContent = palette.accent(emoji) + " " + palette.strong(config.cliName);

  // Center-align content in box using helper function
  builder.append(palette.highlight("  " + topLine) + "\n");
  builder.append(
    palette.highlight("  │") + " ".repeat(boxWidth - 2) + palette.highlight("│") + "\n",
  );
  builder.append(centerInBox(titleContent, boxWidth, palette) + "\n");
  builder.append(centerInBox(palette.subtle(config.tagline), boxWidth, palette) + "\n");
  builder.append(centerInBox(palette.subtle(versionText), boxWidth, palette) + "\n");
  builder.append(
    palette.highlight("  │") + " ".repeat(boxWidth - 2) + palette.highlight("│") + "\n",
  );
  builder.append(palette.highlight("  " + bottomLine) + "\n");
  builder.append("\n");

  // TSera description
  builder.append(
    "  " + palette.subtle("TSera is a DX engine that unifies backend, frontend, and infra.") + "\n",
  );
  builder.append(
    "  " + palette.subtle("It keeps your code, schema, tests, and docs continuously coherent.") +
      "\n",
  );
  builder.append("\n");

  // Usage section
  builder.append(palette.accent("  ◆ ") + palette.heading("USAGE") + "\n");
  builder.append(formatUsage(config.cliName.toLowerCase(), config.usage, palette) + "\n");
  builder.append("\n");

  // Calculate label width for all entries (commands + global options) to ensure alignment
  const allEntries = [...config.commands, ...config.globalOptions];
  const maxLabelWidth = Math.min(
    allEntries.reduce((max, entry) => Math.max(max, entry.label.length), 0),
    38,
  );

  // Commands section
  builder.append(palette.accent("  ◆ ") + palette.heading("COMMANDS") + "\n");
  for (const line of formatTwoColumn(config.commands, width, palette, maxLabelWidth)) {
    builder.append(line + "\n");
  }
  builder.append("\n");

  // Global options section
  builder.append(palette.accent("  ◆ ") + palette.heading("GLOBAL OPTIONS") + "\n");
  for (const line of formatTwoColumn(config.globalOptions, width, palette, maxLabelWidth)) {
    builder.append(line + "\n");
  }
  builder.append("\n");

  // Divider
  builder.append(palette.subtle("─".repeat(width)) + "\n");
  builder.append("\n");

  // Quick start section
  builder.append(palette.success("  ✓ ") + palette.heading("QUICK START") + "\n");
  builder.append(
    "    " + palette.subtle("1.") + " " + palette.label("Initialize a new project:") + "\n",
  );
  builder.append(
    "       " + palette.accent("$") + " " +
      palette.strong(`${config.cliName.toLowerCase()} init my-app`) + "\n",
  );
  builder.append("\n");
  builder.append(
    "    " + palette.subtle("2.") + " " + palette.label("Start development mode:") + "\n",
  );
  builder.append(
    "       " + palette.accent("$") + " " +
      palette.strong(`cd my-app && ${config.cliName.toLowerCase()} dev`) + "\n",
  );
  builder.append("\n");

  // Examples section
  if (config.examples.length > 0) {
    builder.append(palette.accent("  → ") + palette.heading("EXAMPLES") + "\n");
    for (const line of formatExamples(config.examples, width, palette)) {
      builder.append(line + "\n");
    }
    builder.append("\n");
  }

  // Custom sections
  if (config.customSections && config.customSections.length > 0) {
    for (const section of config.customSections) {
      builder.append(
        palette.accent("  ◆ ") + palette.heading(section.title.toUpperCase()) + "\n",
      );
      for (const contentLine of section.content) {
        builder.append("    " + contentLine + "\n");
      }
      builder.append("\n");
    }
  }

  // Footer
  builder.append("\n");
  builder.append(
    "  " + palette.subtle("Need help? Run: ") +
      palette.strong(`${config.cliName.toLowerCase()} <command> --help`) + "\n",
  );
  builder.append("\n");

  return builder.toString().trimEnd();
}
