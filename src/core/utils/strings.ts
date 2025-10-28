const PASCAL_CASE_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

/**
 * Checks whether a string follows the PascalCase naming convention.
 *
 * @param value - String to validate.
 * @returns {@code true} when the input is PascalCase; otherwise {@code false}.
 */
export function isPascalCase(value: string): boolean {
  return PASCAL_CASE_PATTERN.test(value);
}

/**
 * Converts a PascalCase identifier into snake_case.
 *
 * @param value - PascalCase string to convert.
 * @returns snake_case representation of the input string.
 */
export function pascalToSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}
