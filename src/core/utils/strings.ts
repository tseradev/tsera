const PASCAL_CASE_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

export function isPascalCase(value: string): boolean {
  return PASCAL_CASE_PATTERN.test(value);
}

export function pascalToSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}
