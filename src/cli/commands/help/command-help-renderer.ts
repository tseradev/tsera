/**
 * Command-specific help rendering functions.
 *
 * Provides modern, compact help output for individual commands.
 *
 * @module
 */

import { createPalette } from "../../ui/palette.ts";
import { clampWidth, detectTerminalWidth } from "../../ui/terminal.ts";
import { StringBuilder } from "../../ui/text-utils.ts";
import { formatExamples, formatTwoColumn } from "./formatters.ts";
import type { ModernHelpCommand } from "./types.ts";
import type { Palette } from "../../ui/palette.ts";

/**
 * Configuration for rendering command-specific help.
 */
export interface CommandHelpConfig {
  /** Command name (e.g., "init", "dev") */
  commandName: string;
  /** Brief description of what the command does */
  description: string;
  /** Usage pattern (e.g., "[directory]", "[projectDir]") */
  usage?: string;
  /** List of available options */
  options: ModernHelpCommand[];
  /** Example commands */
  examples: string[];
  /** Optional theme override */
  theme?: Partial<Palette>;
}

/**
 * Render a modern, compact help screen for a specific command.
 *
 * @param config - Configuration for the command help
 * @returns Formatted help text
 */
export function renderCommandHelp(config: CommandHelpConfig): string {
  const palette = createPalette(config.theme);
  const width = clampWidth(detectTerminalWidth() ?? 84);
  const builder = new StringBuilder();

  // Command header with emoji
  const emoji = getCommandEmoji(config.commandName);
  builder.append("\n");
  builder.append(
    "  " + palette.accent(emoji) + "  " + palette.strong(`tsera ${config.commandName}`) + "\n",
  );
  builder.append("  " + palette.subtle(config.description) + "\n");
  builder.append("\n");

  // Usage section
  builder.append(palette.accent("  ◆ ") + palette.heading("USAGE") + "\n");
  const usagePart = config.usage ? ` ${config.usage}` : "";
  builder.append(
    "    " + palette.accent("$") + " " +
      palette.strong(`tsera ${config.commandName}${usagePart}`) + "\n",
  );
  builder.append("\n");

  // Options section
  if (config.options.length > 0) {
    builder.append(palette.accent("  ◆ ") + palette.heading("OPTIONS") + "\n");
    for (const line of formatTwoColumn(config.options, width, palette)) {
      builder.append(line + "\n");
    }
    builder.append("\n");
  }

  // Examples section
  if (config.examples.length > 0) {
    builder.append(palette.accent("  → ") + palette.heading("EXAMPLES") + "\n");
    for (const line of formatExamples(config.examples, width, palette)) {
      builder.append(line + "\n");
    }
    builder.append("\n");
  }

  // Footer
  builder.append(
    "  " + palette.subtle("For general help, run: ") + palette.strong("tsera --help") + "\n",
  );
  builder.append("\n");

  return builder.toString().trimEnd();
}

/**
 * Get the emoji associated with a command.
 *
 * @param commandName - Name of the command
 * @returns Emoji string
 */
function getCommandEmoji(commandName: string): string {
  const emojiMap: Record<string, string> = {
    init: "🚀",
    dev: "⚡",
    doctor: "🩺",
    update: "📦",
    help: "💡",
  };
  return emojiMap[commandName] || "⚙️";
}

