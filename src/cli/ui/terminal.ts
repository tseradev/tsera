/**
 * Terminal utilities for detecting and managing terminal properties.
 *
 * @module
 */

type ConsoleSizeFn =
  | ((rid: number) => { columns: number })
  | (() => { columns: number });

const DEFAULT_WIDTH = 84;
const MIN_WIDTH = 64;
const MAX_WIDTH = 100;

/**
 * Attempt to detect the console width, falling back to the default when unknown.
 *
 * @returns Console column width or undefined when detection fails.
 */
export function detectTerminalWidth(): number | undefined {
  if (typeof Deno === "undefined") {
    return undefined;
  }

  try {
    const stdout = Deno.stdout as { rid?: number; isTerminal?: () => boolean };
    const consoleSize = Deno.consoleSize as ConsoleSizeFn | undefined;

    if (typeof consoleSize === "function") {
      if (isZeroArgConsoleSize(consoleSize)) {
        return consoleSize().columns;
      }

      if (isRidConsoleSize(consoleSize) && typeof stdout?.rid === "number") {
        return consoleSize(stdout.rid).columns;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

/**
 * Clamp the desired width into a reasonable window.
 *
 * @param width - Preferred width determined from the terminal.
 * @param options - Optional min/max/default overrides.
 * @returns Width constrained within the supported range.
 */
export function clampWidth(
  width: number,
  options?: { min?: number; max?: number; default?: number },
): number {
  const min = options?.min ?? MIN_WIDTH;
  const max = options?.max ?? MAX_WIDTH;
  const defaultWidth = options?.default ?? DEFAULT_WIDTH;

  if (Number.isNaN(width) || width <= 0) {
    return defaultWidth;
  }

  return Math.min(Math.max(width, min), max);
}

/**
 * Check whether the provided console size function expects no arguments.
 */
function isZeroArgConsoleSize(fn: ConsoleSizeFn): fn is () => { columns: number } {
  return fn.length === 0;
}

/**
 * Check whether the console size function expects a resource identifier argument.
 */
function isRidConsoleSize(fn: ConsoleSizeFn): fn is (rid: number) => { columns: number } {
  return fn.length > 0;
}
