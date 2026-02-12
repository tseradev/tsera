import { assert, assertEquals, assertThrows } from "std/assert";
import { deepFreeze } from "../object.ts";

Deno.test("deepFreeze - freezes a simple object", () => {
  const obj = { name: "John", age: 30 };
  const frozen = deepFreeze(obj);

  assert(Object.isFrozen(frozen));

  assertThrows(() => {
    const mutable = frozen as Record<string, unknown>;
    mutable.name = "Jane";
  });
});

Deno.test("deepFreeze - freezes nested objects", () => {
  const obj = {
    user: {
      name: "John",
      address: {
        city: "Paris",
        zip: "75001",
      },
    },
  };
  const frozen = deepFreeze(obj);

  assert(Object.isFrozen(frozen));
  assert(Object.isFrozen(frozen.user));
  assert(Object.isFrozen(frozen.user.address));

  assertThrows(() => {
    const mutableUser = frozen.user as Record<string, unknown>;
    mutableUser.name = "Jane";
  });

  assertThrows(() => {
    const mutableAddress = frozen.user.address as Record<string, unknown>;
    mutableAddress.city = "Lyon";
  });
});

Deno.test("deepFreeze - freezes arrays", () => {
  const obj = { tags: ["tag1", "tag2"] };
  const frozen = deepFreeze(obj);

  assert(Object.isFrozen(frozen));
  assert(Object.isFrozen(frozen.tags));

  assertThrows(() => {
    const mutableTags = frozen.tags as unknown[];
    mutableTags.push("tag3");
  });
});

Deno.test("deepFreeze - handles primitives", () => {
  assertEquals(deepFreeze("string"), "string");
  assertEquals(deepFreeze(42), 42);
  assertEquals(deepFreeze(true), true);
});

Deno.test("deepFreeze - handles null", () => {
  assertEquals(deepFreeze(null), null);
});

Deno.test("deepFreeze - handles undefined", () => {
  assertEquals(deepFreeze(undefined), undefined);
});

Deno.test("deepFreeze - is idempotent", () => {
  const obj = { name: "John" };
  const frozen1 = deepFreeze(obj);
  const frozen2 = deepFreeze(frozen1);

  // Should return the same frozen object
  assert(Object.isFrozen(frozen2));
});

Deno.test("deepFreeze - handles objects with nested arrays", () => {
  const obj = {
    users: [
      { name: "John", tags: ["admin", "user"] },
      { name: "Jane", tags: ["user"] },
    ],
  };
  const frozen = deepFreeze(obj);

  assert(Object.isFrozen(frozen));
  assert(Object.isFrozen(frozen.users));
  assert(Object.isFrozen(frozen.users[0]));
  assert(Object.isFrozen(frozen.users[0].tags));

  assertThrows(() => {
    const mutableUser = frozen.users[0] as Record<string, unknown>;
    mutableUser.name = "Bob";
  });
});

Deno.test("deepFreeze - handles functions", () => {
  const obj = { fn: () => "hello" };
  const frozen = deepFreeze(obj);

  assert(Object.isFrozen(frozen));
  // Function should still be callable
  assertEquals(frozen.fn(), "hello");
});

Deno.test("deepFreeze - handles objects with symbols", () => {
  const sym = Symbol("test");
  const obj = { [sym]: "value", normal: "prop" };
  const frozen = deepFreeze(obj);

  assert(Object.isFrozen(frozen));
  assertEquals(frozen[sym], "value");
  assertEquals(frozen.normal, "prop");
});

Deno.test("deepFreeze - handles empty object", () => {
  const obj = {};
  const frozen = deepFreeze(obj);

  assert(Object.isFrozen(frozen));
});

Deno.test("deepFreeze - handles empty array", () => {
  const arr: unknown[] = [];
  const frozen = deepFreeze(arr);

  assert(Object.isFrozen(frozen));
  assertThrows(() => {
    const mutableArray = frozen as unknown[];
    mutableArray.push("item");
  });
});

Deno.test("deepFreeze - handles objects with getters", () => {
  const obj = {
    _value: 42,
    get value() {
      return this._value;
    },
  };
  const frozen = deepFreeze(obj);

  assert(Object.isFrozen(frozen));
  // Getter should still work
  assertEquals(frozen.value, 42);
});
