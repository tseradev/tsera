/**
 * Type definitions for the help system.
 *
 * @module
 */

import type { Palette } from "../../ui/palette.ts";

export interface ModernHelpCommand {
  label: string;
  description: string;
  category?: string;
}

export interface ModernHelpConfig {
  cliName: string;
  version: string;
  tagline: string;
  usage: string;
  commands: ModernHelpCommand[];
  globalOptions: ModernHelpCommand[];
  examples: string[];
  customSections?: Array<{ title: string; content: string[] }>;
  theme?: Partial<Palette>;
}
