/**
 * Reusable terminal spinner component for CLI operations.
 *
 * This module provides a {@link TerminalSpinner} class that displays animated
 * progress indicators in the terminal. The spinner automatically detects the
 * terminal environment and falls back to simple text output in non-interactive
 * environments (CI, piped output, etc.).
 *
 * @module
 *
 * @example
 * ```typescript
 * import { TerminalSpinner } from "./spinner.ts";
 *
 * const spinner = new TerminalSpinner();
 * spinner.start("Processing files...");
 * // ... do work ...
 * spinner.update("Still processing...");
 * // ... more work ...
 * spinner.succeed("All files processed!");
 * ```
 */

import { gray, green, magenta, yellow } from "./colors.ts";

/**
 * ANSI escape sequence to clear the current line.
 * @internal
 */
const CLEAR_LINE = "\x1b[2K";

/**
 * ANSI escape sequence to hide the cursor.
 * @internal
 */
const HIDE_CURSOR = "\x1b[?25l";

/**
 * ANSI escape sequence to show the cursor.
 * @internal
 */
const SHOW_CURSOR = "\x1b[?25h";

/**
 * Spinner animation frames using Braille patterns.
 * Displays a smooth rotating animation in interactive terminals.
 * @internal
 */
const SPINNER_FRAMES = [
  gray("⠋"),
  gray("⠙"),
  gray("⠹"),
  gray("⠸"),
  gray("⠼"),
  gray("⠴"),
  gray("⠦"),
  gray("⠧"),
  gray("⠇"),
  gray("⠏"),
];

/**
 * Reusable terminal spinner with start/update/succeed/warn/fail states.
 *
 * The spinner automatically detects the terminal environment:
 * - **Interactive terminals**: Shows animated spinner with updates
 * - **Non-interactive/CI**: Shows simple static progress messages
 * - **NO_COLOR environments**: Disables colors via {@link Deno.noColor}
 *
 * @example
 * ```typescript
 * const spinner = new TerminalSpinner();
 *
 * spinner.start("Initializing project...");
 * await initializeProject();
 *
 * spinner.update("Installing dependencies...");
 * await installDeps();
 *
 * spinner.succeed("Project ready!");
 * ```
 *
 * @example Custom writer for testing
 * ```typescript
 * const output: string[] = [];
 * const spinner = new TerminalSpinner((line) => output.push(line));
 * spinner.start("Testing");
 * spinner.succeed("Done");
 * // output contains all messages
 * ```
 */
export class TerminalSpinner {
  /**
   * Whether the spinner is enabled (interactive terminal detected).
   * @private
   */
  #enabled: boolean;

  /**
   * Interval timer ID for animation frames.
   * @private
   */
  #timer?: number;

  /**
   * Current animation frame index.
   * @private
   */
  #frame = 0;

  /**
   * Current text displayed by the spinner.
   * @private
   */
  #text = "";

  /**
   * Function to output text (defaults to console.log wrapper).
   * @private
   */
  #writer: (line: string) => void;

  /**
   * Last static message written (for non-interactive mode).
   * @private
   */
  #staticMessage?: string;

  /**
   * Text encoder instance for writing to stdout.
   * @private
   */
  static #encoder = new TextEncoder();

  /**
   * Creates a new terminal spinner instance.
   *
   * @param writer - Optional custom writer function for output.
   *                 Defaults to console.log. Useful for testing or
   *                 redirecting output.
   *
   * @example
   * ```typescript
   * // Default output to console
   * const spinner = new TerminalSpinner();
   *
   * // Custom writer for testing
   * const logs: string[] = [];
   * const testSpinner = new TerminalSpinner((line) => logs.push(line));
   * ```
   */
  constructor(writer?: (line: string) => void) {
    this.#writer = writer ?? ((line: string) => console.log(line));

    // Detect if we're in an interactive terminal
    const isInteractive = typeof Deno.stdout.isTerminal === "function" &&
      Deno.stdout.isTerminal();
    const inCi = (typeof Deno.env.get === "function") && Deno.env.get("CI") === "true";

    // Enable spinner only in interactive, non-CI environments with colors
    this.#enabled = isInteractive && !inCi && !Deno.noColor;
  }

  /**
   * Starts the spinner with the given text.
   *
   * In interactive mode, displays an animated spinner. In non-interactive mode,
   * outputs a simple prefixed message.
   *
   * @param text - The text to display alongside the spinner
   *
   * @example
   * ```typescript
   * const spinner = new TerminalSpinner();
   * spinner.start("Loading configuration...");
   * ```
   */
  start(text: string): void {
    this.#text = text;
    if (this.#enabled) {
      // Hide cursor during animation
      this.#write(HIDE_CURSOR);
      this.#render(true);
      this.#timer = setInterval(() => this.#render(), 80);
    } else {
      this.#staticMessage = text;
      this.#writer(`${gray("▶")} ${text}`);
    }
  }

  /**
   * Updates the spinner text while keeping it running.
   *
   * In interactive mode, clears and re-renders with new text. In non-interactive
   * mode, outputs a new line if the text has changed.
   *
   * @param text - The new text to display
   *
   * @example
   * ```typescript
   * spinner.start("Analyzing files...");
   * // ... time passes ...
   * spinner.update("Processing entities...");
   * ```
   */
  update(text: string): void {
    this.#text = text;
    if (this.#enabled) {
      this.#render(true);
    } else if (this.#staticMessage !== text) {
      this.#staticMessage = text;
      this.#writer(`${gray("↺")} ${text}`);
    }
  }

  /**
   * Completes the spinner with a success message.
   *
   * Displays a green checkmark (✔) and stops the animation.
   *
   * @param text - The success message to display
   *
   * @example
   * ```typescript
   * spinner.start("Building project...");
   * // ... build completes ...
   * spinner.succeed("Build completed successfully!");
   * ```
   */
  succeed(text: string): void {
    this.#finish(`${green("✔")} ${text}`);
  }

  /**
   * Completes the spinner with a warning message.
   *
   * Displays a yellow warning symbol (⚠) and stops the animation.
   *
   * @param text - The warning message to display
   *
   * @example
   * ```typescript
   * spinner.start("Checking dependencies...");
   * // ... issues found ...
   * spinner.warn("Some dependencies are outdated");
   * ```
   */
  warn(text: string): void {
    this.#finish(`${yellow("⚠")} ${text}`);
  }

  /**
   * Completes the spinner with a failure message.
   *
   * Displays a magenta X symbol (✖) and stops the animation.
   *
   * @param text - The failure message to display
   *
   * @example
   * ```typescript
   * spinner.start("Connecting to database...");
   * // ... connection fails ...
   * spinner.fail("Connection failed");
   * ```
   */
  fail(text: string): void {
    this.#finish(`${magenta("✖")} ${text}`);
  }

  /**
   * Stops the spinner without displaying a completion message.
   *
   * Useful when you want to end the spinner silently.
   *
   * @example
   * ```typescript
   * spinner.start("Processing...");
   * // ... something happens ...
   * spinner.stop();
   * // Continue with other output
   * ```
   */
  stop(): void {
    if (this.#enabled) {
      this.#clear();
      this.#stopTimer();
      // Show cursor again
      this.#write(SHOW_CURSOR);
    }
    this.#staticMessage = undefined;
  }

  /**
   * Finishes the spinner with a final message.
   * @param line - The final line to display
   * @private
   */
  #finish(line: string): void {
    if (this.#enabled) {
      this.#clear();
      this.#write(`${line}\n`);
      this.#stopTimer();
      // Show cursor again
      this.#write(SHOW_CURSOR);
    } else {
      this.#writer(line);
    }
    this.#staticMessage = undefined;
  }

  /**
   * Renders the current animation frame.
   * @param force - If true, force a re-render by clearing first
   * @private
   */
  #render(force = false): void {
    if (!this.#enabled) {
      return;
    }
    const frame = SPINNER_FRAMES[this.#frame];
    this.#frame = (this.#frame + 1) % SPINNER_FRAMES.length;
    if (force) {
      this.#clear();
    } else {
      // Always return to start of line before writing (even if not clearing)
      this.#write("\r");
    }
    this.#write(`${frame} ${this.#text}`);
  }

  /**
   * Clears the current line in the terminal.
   * @private
   */
  #clear(): void {
    this.#write(`\r${CLEAR_LINE}`);
  }

  /**
   * Writes text directly to stdout (for interactive mode).
   * @param text - The text to write
   * @private
   */
  #write(text: string): void {
    const encoder = TerminalSpinner.#encoder;
    Deno.stdout.writeSync(encoder.encode(text));
  }

  /**
   * Stops the animation timer.
   * @private
   */
  #stopTimer(): void {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }
}
