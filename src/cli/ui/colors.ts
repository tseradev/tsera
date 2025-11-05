/**
 * Terminal color utilities for CLI output.
 *
 * This module provides ANSI color and text styling functions that respect the
 * {@link Deno.noColor} environment setting. When `noColor` is true (e.g., in CI
 * environments or when NO_COLOR environment variable is set), all styling is
 * stripped and plain text is returned.
 *
 * @module
 *
 * @example
 * ```typescript
 * import { green, bold, dim } from "./colors.ts";
 *
 * console.log(green("Success!"));
 * console.log(bold("Important message"));
 * console.log(dim("Subtle hint"));
 * ```
 */

/**
 * Function signature for text colorization and styling.
 *
 * @param text - The text content to be styled
 * @returns The styled text with ANSI escape codes, or plain text if colors are disabled
 */
export type Colorizer = (text: string) => string;

/**
 * Makes text bold/bright.
 *
 * @param text - Text to make bold
 * @returns Bold-styled text or plain text if colors are disabled
 *
 * @example
 * ```typescript
 * console.log(bold("Important!")); // Displays in bold
 * ```
 */
export const bold = createModifier("\x1b[1m", "\x1b[22m");

/**
 * Makes text dimmed/faint.
 *
 * @param text - Text to dim
 * @returns Dimmed text or plain text if colors are disabled
 *
 * @example
 * ```typescript
 * console.log(dim("Subtle hint")); // Displays dimmed
 * ```
 */
export const dim = createModifier("\x1b[2m", "\x1b[22m");

/**
 * Colors text in cyan.
 *
 * @param text - Text to color
 * @returns Cyan-colored text or plain text if colors are disabled
 *
 * @example
 * ```typescript
 * console.log(cyan("Information")); // Displays in cyan
 * ```
 */
export const cyan = createModifier("\x1b[36m", "\x1b[39m");

/**
 * Colors text in green.
 *
 * @param text - Text to color
 * @returns Green-colored text or plain text if colors are disabled
 *
 * @example
 * ```typescript
 * console.log(green("Success!")); // Displays in green
 * ```
 */
export const green = createModifier("\x1b[32m", "\x1b[39m");

/**
 * Colors text in magenta.
 *
 * @param text - Text to color
 * @returns Magenta-colored text or plain text if colors are disabled
 *
 * @example
 * ```typescript
 * console.log(magenta("Warning")); // Displays in magenta
 * ```
 */
export const magenta = createModifier("\x1b[35m", "\x1b[39m");

/**
 * Colors text in red.
 *
 * @param text - Text to color
 * @returns Red-colored text or plain text if colors are disabled
 *
 * @example
 * ```typescript
 * console.log(red("Error!")); // Displays in red
 * ```
 */
export const red = createModifier("\x1b[31m", "\x1b[39m");

/**
 * Colors text in yellow.
 *
 * @param text - Text to color
 * @returns Yellow-colored text or plain text if colors are disabled
 *
 * @example
 * ```typescript
 * console.log(yellow("Caution")); // Displays in yellow
 * ```
 */
export const yellow = createModifier("\x1b[33m", "\x1b[39m");

/**
 * Colors text in blue.
 *
 * @param text - Text to color
 * @returns Blue-colored text or plain text if colors are disabled
 *
 * @example
 * ```typescript
 * console.log(blue("Note")); // Displays in blue
 * ```
 */
export const blue = createModifier("\x1b[34m", "\x1b[39m");

/**
 * Colors text in gray.
 *
 * @param text - Text to color
 * @returns Gray-colored text or plain text if colors are disabled
 *
 * @example
 * ```typescript
 * console.log(gray("Secondary info")); // Displays in gray
 * ```
 */
export const gray = createModifier("\x1b[90m", "\x1b[39m");

/**
 * Creates a text colorization/styling function with ANSI escape codes.
 *
 * This factory function respects the {@link Deno.noColor} setting. When colors
 * are disabled, the returned function passes through the input text unchanged.
 *
 * @param open - The opening ANSI escape code (e.g., "\x1b[32m" for green)
 * @param close - The closing ANSI escape code (e.g., "\x1b[39m" to reset color)
 * @returns A colorizer function that applies the specified styling
 *
 * @example
 * ```typescript
 * const underline = createModifier("\x1b[4m", "\x1b[24m");
 * console.log(underline("Underlined text"));
 * ```
 */
export function createModifier(open: string, close: string): Colorizer {
  return (text: string) => (Deno.noColor ? text : `${open}${text}${close}`);
}
