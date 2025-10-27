/**
 * File-system helpers that will later provide safeWrite semantics.
 */

import { ensureDir } from "jsr:@std/fs@1.0.0/ensure_dir";

export async function safeWriteFile(path: string, content: string): Promise<void> {
  const directory = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";
  await ensureDir(directory);
  const encoder = new TextEncoder();
  await Deno.writeFile(path, encoder.encode(content));
}
