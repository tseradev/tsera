/**
 * Throws an error when the provided condition evaluates to a falsy value.
 *
 * @param condition - Value to test for truthiness.
 * @param message - Custom error message (defaults to a generic assertion failure message).
 */
export function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Deeply compares two values, throwing when they differ.
 *
 * @param actual - Observed value.
 * @param expected - Expected value.
 * @param message - Optional message appended to the thrown error.
 */
export function assertEquals<T>(actual: T, expected: T, message = "Values are not equal"): void {
  if (!deepEqual(actual, expected)) {
    throw new Error(`${message}: expected ${stringify(expected)}, received ${stringify(actual)}`);
  }
}

/**
 * Asserts that a string includes a substring.
 *
 * @param actual - The actual string value.
 * @param expected - The substring that should be present.
 * @param message - Optional message appended to the thrown error.
 */
export function assertStringIncludes(
  actual: string,
  expected: string,
  message = "String does not include expected substring",
): void {
  if (!actual.includes(expected)) {
    throw new Error(`${message}: expected "${actual}" to include "${expected}"`);
  }
}

/**
 * Asserts that the supplied async function rejects and optionally inspects the error message.
 *
 * @param fn - Function expected to reject.
 * @param message - Optional message or regular expression matched against the rejection reason.
 * @returns The error thrown by the function for additional inspection.
 */
export async function assertRejects(
  fn: () => Promise<unknown>,
  message?: string | RegExp,
): Promise<unknown> {
  try {
    await fn();
  } catch (error) {
    if (message) {
      const actualMessage = error instanceof Error ? error.message : String(error);
      if (typeof message === "string") {
        if (!actualMessage.includes(message)) {
          throw new Error(
            `Expected error message to include ${message}, received ${actualMessage}`,
          );
        }
      } else if (!message.test(actualMessage)) {
        throw new Error(`Expected error message to match ${message}, received ${actualMessage}`);
      }
    }
    return error;
  }

  throw new Error("Expected function to reject but it resolved successfully.");
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
    return entriesA.every(([key, value]) => deepEqual(value, (b as Record<string, unknown>)[key]));
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
