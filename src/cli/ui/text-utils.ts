/**
 * Text manipulation utilities for terminal output.
 *
 * @module
 */

/**
 * Calculate the visual width of text, excluding ANSI escape codes.
 *
 * @param text - Text that may contain ANSI escape sequences.
 * @returns The visual width of the text without escape codes.
 */
export function visualWidth(text: string): number {
  // deno-lint-ignore no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, "").length;
}

/**
 * Calculate the visual width of an emoji character.
 *
 * Most emojis are 2 characters wide visually, but some may vary.
 * This function is available for future use if more precise emoji width calculation is needed.
 *
 * @param emoji - Emoji character(s) to measure.
 * @returns The visual width of the emoji (typically 2 for standard emojis).
 */
export function emojiWidth(emoji: string): number {
  // Most modern emojis are 2 characters wide visually
  // Check for emoji ranges
  if (/[\u{1F300}-\u{1F9FF}]/u.test(emoji)) {
    return 2;
  }
  // Fallback: use character length
  return emoji.length;
}

/**
 * Wrap plain text to a fixed width, breaking on word boundaries.
 *
 * @param text - Input text to wrap.
 * @param width - Maximum characters per line.
 * @returns Wrapped lines without trailing spaces.
 */
export function wrapText(text: string, width: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized || width <= 0) {
    return [];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      current = word;
      continue;
    }

    if ((current.length + 1 + word.length) <= width) {
      current = `${current} ${word}`;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

/**
 * StringBuilder class for efficient string concatenation.
 *
 * Reduces memory allocations compared to repeated string concatenation.
 */
export class StringBuilder {
  private parts: string[] = [];

  /**
   * Append a string to the builder.
   *
   * @param str - String to append.
   * @returns The builder instance for chaining.
   */
  append(str: string): this {
    this.parts.push(str);
    return this;
  }

  /**
   * Convert the builder to a single string.
   *
   * @returns The concatenated string.
   */
  toString(): string {
    return this.parts.join("");
  }
}
