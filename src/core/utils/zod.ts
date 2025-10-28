/**
 * Error thrown when schema validation fails.
 */
export class SchemaError extends Error {
  override name = "SchemaError";
}

/** Successful result of a safeParse operation. */
export type SafeParseSuccess<T> = { success: true; data: T };
/** Failed result of a safeParse operation. */
export type SafeParseFailure = { success: false; error: Error };
/** Union representing the outcome of {@link BaseSchema.safeParse}. */
export type SafeParseReturnType<T> = SafeParseSuccess<T> | SafeParseFailure;

/**
 * Minimal schema abstraction inspired by Zod, providing parsing and composition helpers.
 */
export abstract class BaseSchema<T> {
  description?: string;

  /** Parses an unknown value, returning the inferred type or throwing on failure. */
  abstract parse(value: unknown): T;

  /**
   * Attempts to parse the value, capturing thrown errors to return a discriminated union
   * result instead of raising exceptions.
   */
  safeParse(value: unknown): SafeParseReturnType<T> {
    try {
      return { success: true, data: this.parse(value) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new SchemaError(String(error)),
      };
    }
  }

  /** Returns a schema that allows {@code undefined} values. */
  optional(): BaseSchema<T | undefined> {
    return new OptionalSchema(this);
  }

  /** Returns a schema that allows {@code null} values. */
  nullable(): BaseSchema<T | null> {
    return new NullableSchema(this);
  }

  /** Assigns a default value when parsing {@code undefined}. */
  default(value: T): BaseSchema<T> {
    return new DefaultSchema(this, value);
  }

  /** Associates a description with the schema for documentation purposes. */
  describe(text: string): this {
    this.description = text;
    return this;
  }

  /** Adds a refinement predicate executed after the inner schema successfully parses. */
  refine(predicate: (data: T) => boolean, options: { message: string }): BaseSchema<T> {
    return new RefinementSchema(this, predicate, options.message);
  }
}

class OptionalSchema<T> extends BaseSchema<T | undefined> {
  constructor(private readonly inner: BaseSchema<T>) {
    super();
  }

  override parse(value: unknown): T | undefined {
    if (value === undefined) {
      return undefined;
    }

    return this.inner.parse(value);
  }
}

class NullableSchema<T> extends BaseSchema<T | null> {
  constructor(private readonly inner: BaseSchema<T>) {
    super();
  }

  override parse(value: unknown): T | null {
    if (value === null) {
      return null;
    }

    return this.inner.parse(value);
  }
}

class DefaultSchema<T> extends BaseSchema<T> {
  private readonly defaultValue: T;

  constructor(private readonly inner: BaseSchema<T>, value: T) {
    super();
    this.defaultValue = inner.parse(value);
  }

  override parse(value: unknown): T {
    if (value === undefined) {
      return this.defaultValue;
    }

    return this.inner.parse(value);
  }
}

class RefinementSchema<T> extends BaseSchema<T> {
  constructor(
    private readonly inner: BaseSchema<T>,
    private readonly predicate: (data: T) => boolean,
    private readonly message: string,
  ) {
    super();
  }

  override parse(value: unknown): T {
    const result = this.inner.parse(value);
    if (!this.predicate(result)) {
      throw new SchemaError(this.message);
    }
    return result;
  }
}

class StringSchema extends BaseSchema<string> {
  constructor(private readonly minLength?: number) {
    super();
  }

  override parse(value: unknown): string {
    if (typeof value !== "string") {
      throw new SchemaError("Expected string");
    }

    if (this.minLength !== undefined && value.length < this.minLength) {
      throw new SchemaError(`Expected string length >= ${this.minLength}`);
    }

    return value;
  }

  min(length: number): StringSchema {
    return new StringSchema(length);
  }
}

class NumberSchema extends BaseSchema<number> {
  override parse(value: unknown): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new SchemaError("Expected number");
    }

    return value;
  }
}

class BooleanSchema extends BaseSchema<boolean> {
  override parse(value: unknown): boolean {
    if (typeof value !== "boolean") {
      throw new SchemaError("Expected boolean");
    }

    return value;
  }
}

class DateSchema extends BaseSchema<Date> {
  override parse(value: unknown): Date {
    if (!(value instanceof Date)) {
      throw new SchemaError("Expected Date instance");
    }

    return value;
  }
}

class AnySchema extends BaseSchema<unknown> {
  override parse(value: unknown): unknown {
    return value;
  }
}

class UnknownSchema extends BaseSchema<unknown> {
  override parse(value: unknown): unknown {
    return value;
  }
}

class LiteralSchema<T> extends BaseSchema<T> {
  constructor(private readonly literal: T) {
    super();
  }

  override parse(value: unknown): T {
    if (value !== this.literal) {
      throw new SchemaError(`Expected literal value ${String(this.literal)}`);
    }

    return this.literal;
  }
}

class EnumSchema<T extends string> extends BaseSchema<T> {
  constructor(private readonly options: readonly T[]) {
    super();
  }

  override parse(value: unknown): T {
    if (typeof value !== "string" || !this.options.includes(value as T)) {
      throw new SchemaError(`Expected one of: ${this.options.join(", ")}`);
    }

    return value as T;
  }
}

class UnionSchema<T> extends BaseSchema<T> {
  constructor(private readonly schemas: BaseSchema<unknown>[]) {
    super();
  }

  override parse(value: unknown): T {
    const errors: Error[] = [];
    for (const schema of this.schemas) {
      const result = schema.safeParse(value);
      if (result.success) {
        return result.data as T;
      }
      errors.push(result.error);
    }

    throw new SchemaError(errors.map((error) => error.message).join("; "));
  }
}

class ArraySchema<T> extends BaseSchema<T[]> {
  constructor(private readonly inner: BaseSchema<T>) {
    super();
  }

  override parse(value: unknown): T[] {
    if (!Array.isArray(value)) {
      throw new SchemaError("Expected array");
    }

    return value.map((item) => this.inner.parse(item));
  }
}

class RecordSchema<T> extends BaseSchema<Record<string, T>> {
  constructor(private readonly inner: BaseSchema<T>) {
    super();
  }

  override parse(value: unknown): Record<string, T> {
    if (!isPlainObject(value)) {
      throw new SchemaError("Expected record");
    }

    const result: Record<string, T> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = this.inner.parse(entry);
    }

    return result;
  }
}

/** Mapping of keys to schemas used to build an {@link ObjectSchema}. */
export type Shape = Record<string, BaseSchema<unknown>>;

/** Utility type extracting the inferred output from a schema. */
export type Infer<T extends BaseSchema<unknown>> = T extends BaseSchema<infer O> ? O : never;

/** Schema representing an object with a predefined shape. */
export class ObjectSchema<S extends Shape> extends BaseSchema<{ [K in keyof S]: Infer<S[K]> }> {
  private readonly strictMode: boolean;

  constructor(private readonly shape: S, strictMode = false) {
    super();
    this.strictMode = strictMode;
  }

  /** Parses the supplied value, ensuring it matches the configured shape. */
  override parse(value: unknown): { [K in keyof S]: Infer<S[K]> } {
    if (!isPlainObject(value)) {
      throw new SchemaError("Expected object");
    }

    if (this.strictMode) {
      for (const key of Object.keys(value)) {
        if (!(key in this.shape)) {
          throw new SchemaError(`Unexpected key: ${key}`);
        }
      }
    }

    const result: Partial<{ [K in keyof S]: Infer<S[K]> }> = {};

    for (const [key, schema] of Object.entries(this.shape) as [keyof S, BaseSchema<unknown>][]) {
      const rawValue = (value as Record<string, unknown>)[key as string];
      result[key] = (schema as BaseSchema<Infer<S[typeof key]>>).parse(rawValue);
    }

    return result as { [K in keyof S]: Infer<S[K]> };
  }

  /** Returns a new {@link ObjectSchema} that rejects unknown keys. */
  strict(): ObjectSchema<S> {
    return new ObjectSchema(this.shape, true);
  }
}

/** Checks whether the supplied value is a non-null object without array semantics. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Alias mirroring Zod's {@code ZodTypeAny}. */
export type ZodTypeAny = BaseSchema<unknown>;
/** Alias mirroring Zod's {@code ZodObject}. */
export type ZodObject<S extends Shape> = ObjectSchema<S>;

/**
 * Minimal subset of the Zod API used within TSera, exposing constructors for primitive
 * schemas, literals, enums, unions, arrays, objects, and records.
 */
export const z = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  date: () => new DateSchema(),
  any: () => new AnySchema(),
  unknown: () => new UnknownSchema(),
  literal: <T>(value: T) => new LiteralSchema(value),
  enum: <T extends string>(values: readonly T[]) => new EnumSchema(values),
  union: <T extends BaseSchema<unknown>[]>(schemas: [...T]) =>
    new UnionSchema<Infer<T[number]>>(schemas),
  array: <T>(schema: BaseSchema<T>) => new ArraySchema(schema),
  object: <S extends Shape>(shape: S) => new ObjectSchema(shape),
  record: <T>(schema: BaseSchema<T>) => new RecordSchema(schema),
};
