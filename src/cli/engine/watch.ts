import { resolve } from "../../shared/path.ts";

export interface WatchOptions {
  debounceMs?: number;
  ignore?: (string | RegExp)[];
}

export interface WatchController {
  close(): void;
}

export type WatchCallback = (events: Deno.FsEvent[]) => void | Promise<void>;

const DEFAULT_DEBOUNCE = 150;
const DEFAULT_IGNORES: (string | RegExp)[] = [/\.tsera\//, /\.tsera$/];

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
