import { assertEquals } from "jsr:@std/assert";
import { hashBytes, hashText, hashValue, stableStringify } from "../hash.ts";

Deno.test("hashBytes - calcule le hash SHA-256 d'un Uint8Array", async () => {
  const bytes = new TextEncoder().encode("hello");
  const hash = await hashBytes(bytes);

  // Hash SHA-256 de "hello"
  assertEquals(
    hash,
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
});

Deno.test("hashBytes - gère les buffers avec offset", async () => {
  const full = new TextEncoder().encode("xxxhelloxxx");
  const slice = full.slice(3, 8); // "hello"
  const hash = await hashBytes(slice);

  assertEquals(
    hash,
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
});

Deno.test("hashBytes - hash vide pour tableau vide", async () => {
  const bytes = new Uint8Array([]);
  const hash = await hashBytes(bytes);

  // Hash SHA-256 de chaîne vide
  assertEquals(
    hash,
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

Deno.test("hashText - calcule le hash d'une string", async () => {
  const hash = await hashText("hello");

  assertEquals(
    hash,
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
});

Deno.test("hashText - hash vide pour string vide", async () => {
  const hash = await hashText("");

  assertEquals(
    hash,
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

Deno.test("hashText - gère les caractères unicode", async () => {
  const hash1 = await hashText("café");
  const hash2 = await hashText("café");
  const hash3 = await hashText("cafe");

  assertEquals(hash1, hash2);
  assertEquals(hash1 !== hash3, true);
});

Deno.test("hashValue - hash avec version et value", async () => {
  const hash = await hashValue({ foo: "bar" }, { version: "1.0.0" });

  // Le hash doit être déterministe
  const hash2 = await hashValue({ foo: "bar" }, { version: "1.0.0" });
  assertEquals(hash, hash2);
});

Deno.test("hashValue - différencie les versions", async () => {
  const hash1 = await hashValue({ foo: "bar" }, { version: "1.0.0" });
  const hash2 = await hashValue({ foo: "bar" }, { version: "2.0.0" });

  assertEquals(hash1 !== hash2, true);
});

Deno.test("hashValue - utilise le salt si fourni", async () => {
  const hash1 = await hashValue({ foo: "bar" }, { version: "1.0.0" });
  const hash2 = await hashValue({ foo: "bar" }, { version: "1.0.0", salt: "abc" });

  assertEquals(hash1 !== hash2, true);
});

Deno.test("hashValue - salt null est par défaut", async () => {
  const hash1 = await hashValue({ foo: "bar" }, { version: "1.0.0" });
  const hash2 = await hashValue({ foo: "bar" }, { version: "1.0.0", salt: undefined });

  assertEquals(hash1, hash2);
});

Deno.test("stableStringify - trie les clés d'objet", () => {
  const obj = { z: 1, a: 2, m: 3 };
  const result = stableStringify(obj);

  assertEquals(result, '{"a":2,"m":3,"z":1}');
});

Deno.test("stableStringify - trie les clés récursivement", () => {
  const obj = { z: { b: 1, a: 2 }, a: { z: 3, y: 4 } };
  const result = stableStringify(obj);

  assertEquals(result, '{"a":{"y":4,"z":3},"z":{"a":2,"b":1}}');
});

Deno.test("stableStringify - préserve l'ordre des tableaux", () => {
  const obj = { arr: [3, 1, 2] };
  const result = stableStringify(obj);

  assertEquals(result, '{"arr":[3,1,2]}');
});

Deno.test("stableStringify - gère les tableaux d'objets", () => {
  const obj = { arr: [{ z: 1, a: 2 }, { b: 3, a: 4 }] };
  const result = stableStringify(obj);

  assertEquals(result, '{"arr":[{"a":2,"z":1},{"a":4,"b":3}]}');
});

Deno.test("stableStringify - convertit Date en ISO string", () => {
  const obj = { date: new Date("2024-01-01T00:00:00.000Z") };
  const result = stableStringify(obj);

  assertEquals(result, '{"date":"2024-01-01T00:00:00.000Z"}');
});

Deno.test("stableStringify - convertit BigInt en string", () => {
  const obj = { big: 9007199254740991n };
  const result = stableStringify(obj);

  assertEquals(result, '{"big":"9007199254740991"}');
});

Deno.test("stableStringify - gère null et undefined", () => {
  const obj = { a: null, b: undefined };
  const result = stableStringify(obj);

  // JSON.stringify supprime undefined des objets
  assertEquals(result, '{"a":null}');
});

Deno.test("stableStringify - gère les types primitifs", () => {
  assertEquals(stableStringify("hello"), '"hello"');
  assertEquals(stableStringify(42), "42");
  assertEquals(stableStringify(true), "true");
  assertEquals(stableStringify(null), "null");
});

Deno.test("stableStringify - déterminisme complet", () => {
  const obj = {
    z: { nested: [3, { z: 1, a: 2 }] },
    a: 42,
    date: new Date("2024-01-01T00:00:00.000Z"),
  };

  const result1 = stableStringify(obj);
  const result2 = stableStringify(obj);

  assertEquals(result1, result2);
});
