import {
  blue,
  bold,
  type Colorizer,
  cyan,
  dim,
  gray,
  green,
  magenta,
  red,
  yellow,
} from "../ui/colors.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEvent {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  event?: string;
}

export interface LoggerOptions {
  json?: boolean;
  writer?: (line: string) => void;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  event(event: string, context?: Record<string, unknown>): void;
}

interface LevelStyle {
  icon: string;
  label: string;
  color: Colorizer;
  accent: Colorizer;
}

const LEVEL_STYLES: Record<LogLevel, LevelStyle> = {
  debug: { icon: "·", label: "debug", color: gray, accent: dim },
  info: { icon: "ℹ", label: "info", color: cyan, accent: bold },
  warn: { icon: "⚠", label: "warn", color: yellow, accent: bold },
  error: { icon: "✖", label: "error", color: red, accent: bold },
};

interface EventStyle {
  icon: string;
  color: Colorizer;
}

const EVENT_STYLES: Record<string, EventStyle> = {
  init: { icon: "🚀", color: magenta },
  plan: { icon: "🧠", color: cyan },
  apply: { icon: "🛠", color: green },
  doctor: { icon: "🩺", color: yellow },
  update: { icon: "⬆", color: blue },
  watch: { icon: "👀", color: cyan },
  coherence: { icon: "✨", color: green },
  error: { icon: "⛔", color: red },
};

const DEFAULT_EVENT_STYLE: EventStyle = { icon: "•", color: cyan };

export function createLogger(options: LoggerOptions = {}): Logger {
  const writer = options.writer ?? ((line: string) => console.log(line));
  const jsonMode = options.json ?? false;

  function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (jsonMode) {
      const payload: LogEvent = { level, message };
      if (context && Object.keys(context).length > 0) {
        payload.context = context;
      }
      writer(JSON.stringify(payload));
      return;
    }

    const style = LEVEL_STYLES[level];
    const badge = style.color(`${style.icon} ${style.label.toUpperCase().padEnd(5)}`);
    const formattedMessage = style.accent(message);
    const contextBlock = context && Object.keys(context).length > 0
      ? ` ${dim("›")} ${formatContext(context)}`
      : "";

    writer(`${badge} ${formattedMessage}${contextBlock}`);
  }

  function writeEvent(eventName: string, context?: Record<string, unknown>): void {
    if (jsonMode) {
      const payload: LogEvent = {
        level: "info",
        message: eventName,
        event: eventName,
      };
      if (context && Object.keys(context).length > 0) {
        payload.context = context;
      }
      writer(JSON.stringify(payload));
      return;
    }

    const label = formatEventLabel(eventName);
    const contextBlock = context && Object.keys(context).length > 0
      ? ` ${dim("›")} ${formatContext(context)}`
      : "";
    writer(`${label}${contextBlock}`);
  }

  return {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
    event: (eventName, context) => writeEvent(eventName, context),
  };
}

function formatEventLabel(eventName: string): string {
  const segments = eventName.split(":").filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    segments.push(eventName);
  }

  const namespace = segments[0];
  const rest = segments.slice(1);
  const style = EVENT_STYLES[namespace] ?? DEFAULT_EVENT_STYLE;

  const icon = style.color(style.icon);
  const primary = style.color(bold(humanizeSegment(namespace)));
  const trail = rest.length > 0
    ? ` ${dim("›")} ${rest.map((segment) => dim(humanizeSegment(segment))).join(` ${dim("›")} `)}`
    : "";

  return `${icon} ${primary}${trail}`;
}

function formatContext(context: Record<string, unknown>): string {
  const pairs = Object.entries(context)
    .map(([key, value]) => `${dim(key)}=${formatValue(value)}`);
  return pairs.length > 0 ? pairs.join(" ") : "";
}

function formatValue(value: unknown): string {
  if (value === null) {
    return dim("null");
  }
  if (value === undefined) {
    return dim("undefined");
  }
  if (typeof value === "string") {
    const text = value.includes(" ") ? JSON.stringify(value) : value;
    return cyan(text);
  }
  if (typeof value === "number") {
    return bold(String(value));
  }
  if (typeof value === "boolean") {
    return value ? green("true") : red("false");
  }
  return dim(JSON.stringify(value));
}

function humanizeSegment(segment: string): string {
  return segment
    .split(/[-_]/g)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") ||
    segment;
}
