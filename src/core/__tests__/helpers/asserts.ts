export class AssertionError extends Error {
  override name = "AssertionError";
}

export function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new AssertionError(message);
  }
}

export function assertEquals<T>(actual: T, expected: T, message = "Values are not equal"): void {
  if (!deepEqual(actual, expected)) {
    const formattedActual = formatValue(actual);
    const formattedExpected = formatValue(expected);
    throw new AssertionError(
      `${message}:\n  actual: ${formattedActual}\nexpected: ${formattedExpected}`,
    );
  }
}

export function assertStringIncludes(
  haystack: string,
  needle: string,
  message = "String does not include substring",
): void {
  if (!haystack.includes(needle)) {
    throw new AssertionError(`${message}: ${needle}`);
  }
}

export function assertThrows(
  fn: () => unknown,
  ctor: new (...args: never[]) => Error = Error,
  msgIncludes?: string,
): void {
  let thrownError: Error | undefined;
  try {
    fn();
  } catch (error) {
    thrownError = error instanceof Error ? error : new Error(String(error));
  }

  if (!thrownError) {
    throw new AssertionError("Expected function to throw");
  }

  if (!(thrownError instanceof ctor)) {
    const prototype = Object.getPrototypeOf(thrownError);
    const actualName = typeof prototype?.constructor?.name === "string"
      ? prototype.constructor.name
      : "Unknown";
    throw new AssertionError(
      `Expected error to be instance of ${ctor.name}, got ${actualName}`,
    );
  }

  if (msgIncludes && !thrownError.message.includes(msgIncludes)) {
    throw new AssertionError(
      `Expected error message to include "${msgIncludes}", got "${thrownError.message}"`,
    );
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => deepEqual(value, b[index]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
      return false;
    }

    return keysA.every((key) => deepEqual(a[key], b[key as keyof typeof b]));
  }

  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function formatValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
