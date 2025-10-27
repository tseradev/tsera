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

    if (context && Object.keys(context).length > 0) {
      writer(`${level.toUpperCase()}: ${message} ${formatContext(context)}`);
    } else {
      writer(`${level.toUpperCase()}: ${message}`);
    }
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

    if (context && Object.keys(context).length > 0) {
      writer(`${eventName} ${formatContext(context)}`);
    } else {
      writer(eventName);
    }
  }

  return {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
    event: (eventName, context) => writeEvent(eventName, context),
  };
}

function formatContext(context: Record<string, unknown>): string {
  const pairs = Object.entries(context)
    .map(([key, value]) => `${key}=${stringifyValue(value)}`)
    .join(" ");
  return pairs.length > 0 ? `(${pairs})` : "";
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "string") {
    return value.includes(" ") ? JSON.stringify(value) : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}
