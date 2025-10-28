export function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEquals<T>(actual: T, expected: T, message = "Values are not equal"): void {
  if (!deepEqual(actual, expected)) {
    throw new Error(`${message}: expected ${stringify(expected)}, received ${stringify(actual)}`);
  }
}

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
