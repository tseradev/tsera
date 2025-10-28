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

const DEFAULT_MAX_WIDTH = 80;
const INDENT_SPACES = 2;
const COLUMN_GAP = 2;

/**
 * Patch the provided command instance to render a custom modern help layout.
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

function renderModernHelp(config: ModernHelpConfig): string {
  const lines: string[] = [];

  lines.push(`${config.cliName.toUpperCase()} · ${config.tagline}`);
  lines.push(`Version ${config.version}`);
  lines.push("");

  lines.push("USAGE");
  lines.push(formatUsage(config.cliName, config.usage));
  lines.push("");

  lines.push("GLOBAL OPTIONS");
  lines.push(...formatTwoColumn(config.globalOptions));
  lines.push("");

  lines.push("COMMANDS");
  lines.push(...formatTwoColumn(config.commands));
  lines.push("");

  if (config.examples.length > 0) {
    lines.push("EXAMPLES");
    for (const example of config.examples) {
      lines.push(formatExample(example));
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function formatUsage(cliName: string, usage: string): string {
  return `${" ".repeat(INDENT_SPACES)}${cliName} ${usage}`.trimEnd();
}

function formatExample(example: string): string {
  return `${" ".repeat(INDENT_SPACES)}$ ${example}`.trimEnd();
}

function formatTwoColumn(entries: ModernHelpCommand[]): string[] {
  if (entries.length === 0) {
    return [];
  }

  const labelWidth = Math.min(
    entries.reduce((max, entry) => Math.max(max, entry.label.length), 0),
    32,
  );
  const indent = " ".repeat(INDENT_SPACES);
  const gap = " ".repeat(COLUMN_GAP);
  const available = Math.max(DEFAULT_MAX_WIDTH - (INDENT_SPACES + labelWidth + COLUMN_GAP), 20);

  const lines: string[] = [];

  for (const entry of entries) {
    const label = entry.label.padEnd(labelWidth, " ");
    const wrapped = wrapText(entry.description, available);
    if (wrapped.length === 0) {
      lines.push(`${indent}${label}`.trimEnd());
      continue;
    }

    const [first, ...rest] = wrapped;
    lines.push(`${indent}${label}${gap}${first}`.trimEnd());
    for (const line of rest) {
      lines.push(`${indent}${" ".repeat(labelWidth)}${gap}${line}`.trimEnd());
    }
  }

  return lines;
}

function wrapText(text: string, width: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
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
