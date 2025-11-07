import { resolve } from "../../shared/path.ts";

/**
 * Options for file system watching.
 */
export interface WatchOptions {
  /** Debounce delay in milliseconds. */
  debounceMs?: number;
  /** Patterns to ignore when watching. */
  ignore?: (string | RegExp)[];
}

/**
 * Controller for managing a file system watcher.
 */
export interface WatchController {
  /** Closes the watcher and stops monitoring. */
  close(): void;
}

/**
 * Callback function invoked when file system events occur.
 */
export type WatchCallback = (events: Deno.FsEvent[]) => void | Promise<void>;

const DEFAULT_DEBOUNCE = 150;
const DEFAULT_IGNORES: (string | RegExp)[] = [/\.tsera\//, /\.tsera$/];

/**
 * Watches a project directory for file system changes with debouncing and filtering.
 *
 * @param directory - Directory to watch.
 * @param callback - Callback invoked when changes are detected.
 * @param options - Watch options.
 * @returns Controller for managing the watcher.
 */
export function watchProject(
  directory: string,
  callback: WatchCallback,
  options: WatchOptions = {},
): WatchController {
  const root = resolve(directory);
  const watcher = Deno.watchFs(root, { recursive: true });
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE;
  const ignores = options.ignore ?? DEFAULT_IGNORES;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let buffer: Deno.FsEvent[] = [];
  let closed = false;

  async function flush(): Promise<void> {
    if (buffer.length === 0) {
      return;
    }
    const events = buffer;
    buffer = [];
    await callback(events);
  }

  function scheduleFlush(): void {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, debounceMs);
  }

  (async () => {
    for await (const event of watcher) {
      if (closed) {
        break;
      }
      const filteredPaths = event.paths.filter((path) => !shouldIgnore(path, ignores));
      if (filteredPaths.length === 0) {
        continue;
      }
      buffer.push({ ...event, paths: filteredPaths });
      scheduleFlush();
    }
    await flush();
  })()
    .catch((error) => {
      if (!closed) {
        console.error("Erreur watcher:", error);
      }
    });

  return {
    close() {
      closed = true;
      watcher.close();
      if (timer !== null) {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * Determines whether a path should be ignored based on the ignore patterns.
 *
 * @param path - File system path to check.
 * @param ignores - Array of ignore patterns (strings or regex).
 * @returns {@code true} if the path should be ignored; otherwise {@code false}.
 */
function shouldIgnore(path: string, ignores: (string | RegExp)[]): boolean {
  // Normalise les chemins Windows pour utiliser des forward slashes
  const normalizedPath = path.replace(/\\/g, "/");
  
  for (const pattern of ignores) {
    if (typeof pattern === "string") {
      if (normalizedPath.includes(pattern)) {
        return true;
      }
      continue;
    }
    if (pattern.test(normalizedPath)) {
      return true;
    }
  }
  return false;
}
