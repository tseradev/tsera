/**
 * Type definitions for the help system.
 *
 * @module
 */

import type { Palette } from "../../ui/palette.ts";

/**
 * Describes a command or option in the help system.
 */
export interface ModernHelpCommand {
  /** Display label (e.g., "init [directory]", "--json"). */
  label: string;
  /** Human-readable description. */
  description: string;
  /** Optional category for grouping. */
  category?: string;
}

/**
 * Complete configuration for rendering modern help output.
 */
export interface ModernHelpConfig {
  /** CLI binary name. */
  cliName: string;
  /** Version string to display. */
  version: string;
  /** Tagline or brief description. */
  tagline: string;
  /** Usage pattern string. */
  usage: string;
  /** Array of available commands. */
  commands: ModernHelpCommand[];
  /** Array of global options. */
  globalOptions: ModernHelpCommand[];
  /** Array of example command strings. */
  examples: string[];
  /** Optional custom sections to include. */
  customSections?: Array<{ title: string; content: string[] }>;
  /** Optional theme override for colors. */
  theme?: Partial<Palette>;
}
