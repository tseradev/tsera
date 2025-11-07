/**
 * Color palette utilities for terminal output.
 *
 * @module
 */

import { bold, brightBlue, brightCyan, brightGreen, brightWhite, dim } from "./colors.ts";
import type { Colorizer } from "./colors.ts";

/**
 * A color palette for consistent terminal styling.
 */
export interface Palette {
  /** Accent color for highlighting important elements. */
  accent: Colorizer;
  /** Color for section headings. */
  heading: Colorizer;
  /** Color for labels and metadata. */
  label: Colorizer;
  /** Subtle color for secondary information. */
  subtle: Colorizer;
  /** Strong color for emphasis. */
  strong: Colorizer;
  /** Success color for positive feedback. */
  success: Colorizer;
  /** Highlight color for drawing attention. */
  highlight: Colorizer;
}

/**
 * Create a default color palette for terminal output.
 *
 * The functions from colors.ts automatically handle Deno.noColor, so colors
 * degrade gracefully to plain text when needed.
 *
 * @param overrides - Optional partial palette to override defaults.
 * @returns A complete color palette.
 */
export function createPalette(overrides?: Partial<Palette>): Palette {
  const defaultPalette: Palette = {
    accent: brightCyan,
    heading: (value) => bold(brightCyan(value)),
    label: brightWhite,
    subtle: dim,
    strong: (value) => bold(brightWhite(value)),
    success: brightGreen,
    highlight: brightBlue,
  };

  if (!overrides) {
    return defaultPalette;
  }

  return {
    accent: overrides.accent ?? defaultPalette.accent,
    heading: overrides.heading ?? defaultPalette.heading,
    label: overrides.label ?? defaultPalette.label,
    subtle: overrides.subtle ?? defaultPalette.subtle,
    strong: overrides.strong ?? defaultPalette.strong,
    success: overrides.success ?? defaultPalette.success,
    highlight: overrides.highlight ?? defaultPalette.highlight,
  };
}
