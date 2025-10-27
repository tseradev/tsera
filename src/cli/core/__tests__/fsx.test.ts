import { join } from "../../../shared/path.ts";
import { assert, assertEquals } from "tsera/testing/asserts.ts";
import { readJsonFile, removeFileIfExists, safeWrite, writeJsonFile } from "../fsx.ts";

Deno.test("safeWrite crée un nouveau fichier quand il n'existe pas", async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, "file.txt");

  const result = await safeWrite(path, "hello");
  assert(result.changed);
  assert(result.written);
  const content = await Deno.readTextFile(path);
  assertEquals(content, "hello");
});

Deno.test("safeWrite n'écrit pas lorsque le contenu est identique", async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, "file.txt");
  await safeWrite(path, "hello");

  const result = await safeWrite(path, "hello");
  assertEquals(result.changed, false);
  assertEquals(result.written, false);
});

Deno.test("safeWrite écrase lorsque le contenu diffère", async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, "file.txt");
  await safeWrite(path, "hello");

  const result = await safeWrite(path, "bonjour");
  assert(result.changed);
  const content = await Deno.readTextFile(path);
  assertEquals(content, "bonjour");
});

Deno.test("removeFileIfExists supprime un fichier et renvoie true", async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, "file.txt");
  await safeWrite(path, "hello");

  const removed = await removeFileIfExists(path);
  assertEquals(removed, true);
  assertEquals(await removeFileIfExists(path), false);
});

Deno.test("writeJsonFile trie les clés et peut être relu", async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, "data.json");
  const payload = { b: 2, a: 1 };
  await writeJsonFile(path, payload);

  const result = await readJsonFile<Record<string, number>>(path);
  assertEquals(result, { a: 1, b: 2 });
});
