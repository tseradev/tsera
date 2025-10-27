/**
 * File system watching utilities.
 */

export interface WatchEvent {
  paths: string[];
}

export async function* watchProject(root: string): AsyncIterable<WatchEvent> {
  const watcher = Deno.watchFs(root, { recursive: true });
  try {
    for await (const event of watcher) {
      if (event.paths.every((path) => path.includes(".tsera"))) {
        continue;
      }
      yield { paths: event.paths };
    }
  } finally {
    watcher.close();
  }
}
