const ANSI_BOLD = "\u001b[1m";
const ANSI_BOLD_CLOSE = "\u001b[22m";
const ANSI_DIM = "\u001b[2m";
const ANSI_DIM_CLOSE = "\u001b[22m";
const ANSI_BRIGHT_CYAN = "\u001b[96m";
const ANSI_BRIGHT_WHITE = "\u001b[97m";
const ANSI_COLOR_CLOSE = "\u001b[39m";

type AnsiColorize = (value: string) => string;

const bold: AnsiColorize = (value) => applyAnsi(ANSI_BOLD, ANSI_BOLD_CLOSE, value);
const dim: AnsiColorize = (value) => applyAnsi(ANSI_DIM, ANSI_DIM_CLOSE, value);
const brightCyan: AnsiColorize = (value) => applyAnsi(ANSI_BRIGHT_CYAN, ANSI_COLOR_CLOSE, value);
const brightWhite: AnsiColorize = (value) => applyAnsi(ANSI_BRIGHT_WHITE, ANSI_COLOR_CLOSE, value);

export interface ModernHelpCommand {
  label: string;
  description: string;
}

export interface ModernHelpConfig {
  cliName: string;
  version: string;
  tagline: string;
  usage: string;
  commands: ModernHelpCommand[];
  globalOptions: ModernHelpCommand[];
  examples: string[];
}

const DEFAULT_MAX_WIDTH = 84;
const MIN_WIDTH = 64;
const MAX_WIDTH = 100;
const INDENT_SPACES = 2;
const COLUMN_GAP = 2;

type Colorize = (value: string) => string;

interface Palette {
  accent: Colorize;
  heading: Colorize;
  label: Colorize;
  subtle: Colorize;
  strong: Colorize;
}

type ConsoleSizeFn =
  | ((rid: number) => { columns: number })
  | (() => { columns: number });

/**
 * Patch the provided command instance to render a custom modern help layout.
 *
 * @param command - Command instance exposing a {@link showHelp} method.
 * @param config - Descriptor of the CLI name, tagline, options, and examples.
 */
export function applyModernHelp(command: { showHelp: () => void }, config: ModernHelpConfig): void {
  const original = command.showHelp.bind(command);

  command.showHelp = () => {
    try {
      console.log(renderModernHelp(config));
    } catch (error) {
      console.log(renderFallback(config));
      if (error instanceof Error) {
        console.debug("Failed to render custom help", error.message);
      }
    }
  };

  // Ensure TypeScript does not consider the original unused.
  void original;
}

/**
 * Render a concise fallback help output when modern rendering fails.
 *
 * @param config - Descriptor of commands and metadata to display.
 * @returns Plain text fallback help copy.
 */
function renderFallback(config: ModernHelpConfig): string {
  const lines = [
    `Usage: ${config.cliName} ${config.usage}`.trim(),
    "",
    config.tagline,
    "",
    `Version: ${config.version}`,
    "",
    "Commands:",
    ...config.commands.map((command) => `  ${command.label}  ${command.description}`.trim()),
  ];

  return lines.join("\n");
}

/**
 * Render the full modern help layout with accent colors and structured sections.
 *
 * @param config - Descriptor of commands and metadata to display.
 * @returns Fully formatted help screen.
 */
function renderModernHelp(config: ModernHelpConfig): string {
  const palette = createPalette();
  const width = clampWidth(detectPreferredWidth() ?? DEFAULT_MAX_WIDTH);
  const lines: string[] = [];

  const divider = palette.accent("═".repeat(width));
  lines.push(divider);
  lines.push(palette.strong(`${config.cliName.toUpperCase()} • ${config.tagline}`));
  lines.push(palette.subtle(`Version ${config.version}`));
  lines.push(divider);
  lines.push("");

  lines.push(palette.heading("USAGE"));
  lines.push(formatUsage(config.cliName, config.usage, palette));
  lines.push("");

  lines.push(palette.heading("GLOBAL OPTIONS"));
  lines.push(...formatTwoColumn(config.globalOptions, width, palette));
  lines.push("");

  lines.push(palette.heading("COMMANDS"));
  lines.push(...formatTwoColumn(config.commands, width, palette));
  lines.push("");

  if (config.examples.length > 0) {
    lines.push(palette.heading("EXAMPLES"));
    lines.push(...formatExamples(config.examples, width, palette));
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * Format the usage section with a prefixed shell prompt accent.
 *
 * @param cliName - CLI binary name.
 * @param usage - Usage descriptor following the name.
 * @param palette - Active color palette.
 * @returns Single formatted usage line.
 */
function formatUsage(cliName: string, usage: string, palette: Palette): string {
  const indent = " ".repeat(INDENT_SPACES);
  const command = `${cliName} ${usage}`.trim();
  return `${indent}${palette.accent("$")} ${palette.strong(command)}`;
}

/**
 * Format example commands, wrapping to the available width for readability.
 *
 * @param examples - Example commands to display.
 * @param width - Maximum characters per line.
 * @param palette - Active color palette.
 * @returns Array of formatted example lines.
 */
function formatExamples(examples: string[], width: number, palette: Palette): string[] {
  const indent = " ".repeat(INDENT_SPACES);
  const prompt = palette.accent("$");
  const available = Math.max(width - (INDENT_SPACES + 2), 24);
  const lines: string[] = [];

  for (const example of examples) {
    const wrapped = wrapText(example, available);
    if (wrapped.length === 0) {
      lines.push(`${indent}${prompt}`.trimEnd());
      continue;
    }

    const [first, ...rest] = wrapped;
    lines.push(`${indent}${prompt} ${palette.strong(first)}`.trimEnd());
    for (const line of rest) {
      lines.push(`${indent}  ${palette.subtle(line)}`.trimEnd());
    }
  }

  return lines;
}

/**
 * Format entries such as commands or options in a two-column definition layout.
 *
 * @param entries - Command or option descriptors.
 * @param width - Maximum characters per line.
 * @param palette - Active color palette.
 * @returns Array of formatted lines.
 */
function formatTwoColumn(entries: ModernHelpCommand[], width: number, palette: Palette): string[] {
  if (entries.length === 0) {
    return [];
  }

  const labelWidth = Math.min(
    entries.reduce((max, entry) => Math.max(max, entry.label.length), 0),
    38,
  );
  const indent = " ".repeat(INDENT_SPACES);
  const gap = " ".repeat(COLUMN_GAP);
  const bullet = palette.accent("›");
  const available = Math.max(width - (INDENT_SPACES + 2 + labelWidth + COLUMN_GAP), 24);
  const emptyLabel = " ".repeat(labelWidth);

  const lines: string[] = [];

  for (const entry of entries) {
    const paddedLabel = entry.label.padEnd(labelWidth, " ");
    const wrapped = wrapText(entry.description, available);

    if (wrapped.length === 0) {
      lines.push(`${indent}${bullet} ${palette.label(paddedLabel)}`.trimEnd());
      continue;
    }

    const [first, ...rest] = wrapped;
    lines.push(
      `${indent}${bullet} ${palette.label(paddedLabel)}${gap}${palette.subtle(first)}`.trimEnd(),
    );
    for (const line of rest) {
      lines.push(
        `${indent}${bullet} ${palette.label(emptyLabel)}${gap}${palette.subtle(line)}`.trimEnd(),
      );
    }
  }

  return lines;
}

/**
 * Wrap plain text to a fixed width, breaking on word boundaries.
 *
 * @param text - Input text to wrap.
 * @param width - Maximum characters per line.
 * @returns Wrapped lines without trailing spaces.
 */
function wrapText(text: string, width: number): string[] {
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
 * Create the color palette used for the help screen, respecting NO_COLOR settings.
 *
 * @returns Palette of colorizing helpers that degrade gracefully to plain text.
 */
function createPalette(): Palette {
  if (!supportsColor()) {
    return {
      accent: identity,
      heading: identity,
      label: identity,
      subtle: identity,
      strong: identity,
    };
  }

  return {
    accent: (value) => brightCyan(value),
    heading: (value) => bold(brightCyan(value)),
    label: (value) => bold(brightWhite(value)),
    subtle: (value) => dim(value),
    strong: (value) => bold(brightWhite(value)),
  };
}

/**
 * Determine whether the current stdout supports colored output.
 *
 * @returns True when color escape sequences should be emitted.
 */
function supportsColor(): boolean {
  try {
    if (typeof Deno === "undefined") {
      return false;
    }

    if ((Deno as { noColor?: boolean }).noColor) {
      return false;
    }

    const stdout = Deno.stdout as { isTerminal?: () => boolean };
    if (typeof stdout?.isTerminal === "function") {
      return stdout.isTerminal();
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * Clamp the desired help width into a reasonable window.
 *
 * @param width - Preferred width determined from the terminal.
 * @returns Width constrained within the supported range.
 */
function clampWidth(width: number): number {
  if (Number.isNaN(width) || width <= 0) {
    return DEFAULT_MAX_WIDTH;
  }

  return Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH);
}

/**
 * Attempt to detect the console width, falling back to the default when unknown.
 *
 * @returns Console column width or undefined when detection fails.
 */
function detectPreferredWidth(): number | undefined {
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

/** Identity colorizer used when color output is disabled. */
const identity: Colorize = (value) => value;

/**
 * Check whether the provided console size function expects no arguments.
 *
 * @param fn - Console size implementation exposed by Deno.
 * @returns True when the function accepts zero arguments.
 */
function isZeroArgConsoleSize(fn: ConsoleSizeFn): fn is () => { columns: number } {
  return fn.length === 0;
}

/**
 * Check whether the console size function expects a resource identifier argument.
 *
 * @param fn - Console size implementation exposed by Deno.
 * @returns True when the function accepts a resource identifier.
 */
function isRidConsoleSize(fn: ConsoleSizeFn): fn is (rid: number) => { columns: number } {
  return fn.length > 0;
}

/**
 * Apply ANSI formatting sequences around a string without mutating nested styles.
 *
 * @param open - Opening escape sequence.
 * @param close - Closing escape sequence.
 * @param value - Text to decorate with the escape sequences.
 * @returns Decorated string using the provided escape sequences.
 */
function applyAnsi(open: string, close: string, value: string): string {
  return `${open}${value}${close}`;
}
