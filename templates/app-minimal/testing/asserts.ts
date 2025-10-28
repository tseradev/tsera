export function assert(
  condition: unknown,
  message = "Assertion failed",
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEquals<T>(
  actual: T,
  expected: T,
  message = "Values are not equal",
): void {
  if (!deepEqual(actual, expected)) {
    throw new Error(
      `${message}: expected ${stringify(expected)}, received ${
        stringify(actual)
      }`,
    );
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const entriesA = Object.entries(a as Record<string, unknown>);
    const entriesB = Object.entries(b as Record<string, unknown>);
    if (entriesA.length !== entriesB.length) {
      return false;
    }
    return entriesA.every(([key, value]) =>
      deepEqual(value, (b as Record<string, unknown>)[key])
    );
  }
  return false;
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
