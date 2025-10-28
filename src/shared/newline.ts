const PLATFORM_NEWLINE = Deno.build.os === "windows" ? "\r\n" : "\n";

/**
 * Returns the default newline sequence for the current operating system.
 */
export function getPlatformNewline(): "\r\n" | "\n" {
  return PLATFORM_NEWLINE;
}

/**
 * Normalises all newline characters within a string to the provided newline sequence.
 *
 * @param value - Text to normalise.
 * @param newline - Desired newline sequence (defaults to the platform newline).
 * @returns Updated string with consistent newline characters.
 */
export function normalizeNewlines(
  value: string,
  newline: string = PLATFORM_NEWLINE,
): string {
  return value.replace(/\r\n|\r|\n/g, newline);
}
