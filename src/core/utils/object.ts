/**
 * Recursively freezes an object and all nested properties, returning an immutable
 * representation of the supplied value. Primitive values are returned unchanged.
 *
 * @param value - Object or primitive to freeze.
 * @returns A deeply frozen version of the provided value.
 */
export function deepFreeze<T>(value: T): Readonly<T> {
  if (value === null) {
    return value as Readonly<T>;
  }

  const valueType = typeof value;
  if (valueType !== "object" && valueType !== "function") {
    return value as Readonly<T>;
  }

  if (Object.isFrozen(value)) {
    return value as Readonly<T>;
  }

  const propertyNames = Reflect.ownKeys(value as Record<PropertyKey, unknown>);
  for (const property of propertyNames) {
    // deno-lint-ignore no-explicit-any
    const descriptor = Object.getOwnPropertyDescriptor(value as any, property);
    if (!descriptor || !("value" in descriptor)) {
      continue;
    }

    const propertyValue = descriptor.value;
    if (propertyValue !== undefined) {
      deepFreeze(propertyValue);
    }
  }

  return Object.freeze(value) as Readonly<T>;
}
