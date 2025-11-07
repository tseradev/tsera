import { join } from "../../../shared/path.ts";
import { assert, assertEquals } from "../../../testing/asserts.ts";
import { readJsonFile, removeFileIfExists, safeWrite, writeJsonFile } from "../fsx.ts";

Deno.test("safeWrite creates a new file when it does not exist", async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, "file.txt");

  const result = await safeWrite(path, "hello");
  assert(result.changed);
  assert(result.written);
  const content = await Deno.readTextFile(path);
  assertEquals(content, "hello");
});

Deno.test("safeWrite skips writing when content matches", async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, "file.txt");
  await safeWrite(path, "hello");

  const result = await safeWrite(path, "hello");
  assertEquals(result.changed, false);
  assertEquals(result.written, false);
});

Deno.test("safeWrite overwrites when content differs", async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, "file.txt");
  await safeWrite(path, "hello");

  const result = await safeWrite(path, "updated");
  assert(result.changed);
  const content = await Deno.readTextFile(path);
  assertEquals(content, "updated");
});

Deno.test("removeFileIfExists deletes a file and returns true", async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, "file.txt");
  await safeWrite(path, "hello");

  const removed = await removeFileIfExists(path);
  assertEquals(removed, true);
  assertEquals(await removeFileIfExists(path), false);
});

Deno.test("writeJsonFile sorts keys and can be read back", async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, "data.json");
  const payload = { b: 2, a: 1 };
  await writeJsonFile(path, payload);

  const result = await readJsonFile<Record<string, number>>(path);
  assertEquals(result, { a: 1, b: 2 });
});
