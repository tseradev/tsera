export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

type ParseContext = { path: string[] };

type SafeParseSuccess<T> = { success: true; data: T };
type SafeParseFailure = { success: false; error: SchemaError };
export type SafeParseReturnType<T> = SafeParseSuccess<T> | SafeParseFailure;

function cloneValue<T>(value: T): T {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export abstract class ZodType<T> {
  protected _description?: string;

  protected abstract _parse(value: unknown, ctx: ParseContext): T;

  parse(value: unknown): T {
    const result = this.safeParse(value);
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }

  safeParse(value: unknown): SafeParseReturnType<T> {
    try {
      return { success: true, data: this._parse(value, { path: [] }) };
    } catch (error) {
      if (error instanceof SchemaError) {
        return { success: false, error };
      }
      return { success: false, error: new SchemaError(String(error)) };
    }
  }

  optional(): ZodType<T | undefined> {
    return new OptionalSchema(this);
  }

  nullable(): ZodType<T | null> {
    return new NullableSchema(this);
  }

  default(value: T): ZodType<T> {
    return new DefaultSchema(this, value);
  }

  describe(description: string): this {
    this._description = description;
    return this;
  }

  refine(
    predicate: (value: T) => boolean,
    options?: { message?: string },
  ): ZodType<T> {
    return new RefinementSchema(this, predicate, options?.message);
  }

  get description(): string | undefined {
    return this._description;
  }
}

class OptionalSchema<T> extends ZodType<T | undefined> {
  constructor(private readonly inner: ZodType<T>) {
    super();
    this._description = inner.description;
  }

  protected _parse(value: unknown, _ctx: ParseContext): T | undefined {
    if (value === undefined) {
      return undefined;
    }
    return this.inner.parse(value);
  }
}

class NullableSchema<T> extends ZodType<T | null> {
  constructor(private readonly inner: ZodType<T>) {
    super();
    this._description = inner.description;
  }

  protected _parse(value: unknown, _ctx: ParseContext): T | null {
    if (value === null) {
      return null;
    }
    return this.inner.parse(value);
  }
}

class DefaultSchema<T> extends ZodType<T> {
  constructor(
    private readonly inner: ZodType<T>,
    private readonly defaultValue: T,
  ) {
    super();
    this._description = inner.description;
  }

  protected _parse(value: unknown, _ctx: ParseContext): T {
    if (value === undefined) {
      return cloneValue(this.defaultValue);
    }
    return this.inner.parse(value);
  }
}

class RefinementSchema<T> extends ZodType<T> {
  constructor(
    private readonly inner: ZodType<T>,
    private readonly predicate: (value: T) => boolean,
    private readonly message?: string,
  ) {
    super();
    this._description = inner.description;
  }

  protected _parse(value: unknown, _ctx: ParseContext): T {
    const parsed = this.inner.parse(value);
    if (!this.predicate(parsed)) {
      throw new SchemaError(this.message ?? "Refinement failed");
    }
    return parsed;
  }
}

class StringSchema extends ZodType<string> {
  protected _parse(value: unknown): string {
    if (typeof value !== "string") {
      throw new SchemaError("Expected string");
    }
    return value;
  }

  min(length: number): ZodType<string> {
    return this.refine(
      (value) => value.length >= length,
      { message: `String must contain at least ${length} character(s)` },
    );
  }
}

class NumberSchema extends ZodType<number> {
  protected _parse(value: unknown): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new SchemaError("Expected number");
    }
    return value;
  }
}

class BooleanSchema extends ZodType<boolean> {
  protected _parse(value: unknown): boolean {
    if (typeof value !== "boolean") {
      throw new SchemaError("Expected boolean");
    }
    return value;
  }
}

class DateSchema extends ZodType<Date> {
  protected _parse(value: unknown): Date {
    if (value instanceof Date) {
      return value;
    }
    throw new SchemaError("Expected Date");
  }
}

class AnySchema extends ZodType<unknown> {
  protected _parse(value: unknown): unknown {
    return value;
  }
}

class UnknownSchema extends ZodType<unknown> {
  protected _parse(value: unknown): unknown {
    return value;
  }
}

class LiteralSchema<T extends string | number | boolean> extends ZodType<T> {
  constructor(private readonly literal: T) {
    super();
  }

  protected _parse(value: unknown): T {
    if (value !== this.literal) {
      throw new SchemaError(`Expected literal ${JSON.stringify(this.literal)}`);
    }
    return this.literal;
  }
}

class EnumSchema<T extends readonly [string, ...string[]]> extends ZodType<T[number]> {
  private readonly values: Set<string>;

  constructor(values: T) {
    super();
    this.values = new Set(values);
  }

  protected _parse(value: unknown): T[number] {
    if (typeof value !== "string" || !this.values.has(value)) {
      throw new SchemaError("Expected one of enum values");
    }
    return value;
  }
}

class UnionSchema extends ZodType<unknown> {
  constructor(private readonly options: readonly ZodTypeAny[]) {
    super();
  }

  protected _parse(value: unknown, _ctx: ParseContext): unknown {
    const errors: SchemaError[] = [];
    for (const option of this.options) {
      const result = option.safeParse(value);
      if (result.success) {
        return result.data;
      }
      errors.push(result.error);
    }
    const message = errors.map((error) => error.message).join(" | ");
    throw new SchemaError(message || "Invalid union input");
  }
}

class ArraySchema extends ZodType<unknown[]> {
  constructor(private readonly element: ZodTypeAny) {
    super();
  }

  protected _parse(value: unknown, _ctx: ParseContext): unknown[] {
    if (!Array.isArray(value)) {
      throw new SchemaError("Expected array");
    }
    return value.map((item) => this.element.parse(item));
  }
}

class RecordSchema extends ZodType<Record<string, unknown>> {
  constructor(private readonly valueSchema: ZodTypeAny) {
    super();
  }

  protected _parse(value: unknown, _ctx: ParseContext): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new SchemaError("Expected object");
    }
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = this.valueSchema.parse(val);
    }
    return result;
  }
}

type ObjectShape = Record<string, ZodTypeAny>;

type ParsedObject<TShape extends ObjectShape> = {
  [K in keyof TShape]: ReturnType<TShape[K]["parse"]>;
};

export class ZodObjectSchema<TShape extends ObjectShape> extends ZodType<ParsedObject<TShape>> {
  constructor(
    public readonly shape: TShape,
    private readonly enforceStrict = false,
  ) {
    super();
  }

  protected _parse(value: unknown, _ctx: ParseContext): ParsedObject<TShape> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new SchemaError("Expected object");
    }
    const input = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, schema] of Object.entries(this.shape)) {
      const hasKey = Object.prototype.hasOwnProperty.call(input, key);
      const fieldValue = hasKey ? input[key] : undefined;
      result[key] = schema.parse(fieldValue);
    }

    if (this.enforceStrict) {
      for (const key of Object.keys(input)) {
        if (!(key in this.shape)) {
          throw new SchemaError(`Unexpected key: ${key}`);
        }
      }
    }

    return result as ParsedObject<TShape>;
  }

  strict(): ZodObjectSchema<TShape> {
    const next = new ZodObjectSchema(this.shape, true);
    next._description = this._description;
    return next;
  }
}

export type ZodTypeAny = ZodType<unknown>;
export type ZodObject<T extends ObjectShape = ObjectShape> = ZodObjectSchema<T>;

export const z = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  date: () => new DateSchema(),
  any: () => new AnySchema(),
  unknown: () => new UnknownSchema(),
  literal: <T extends string | number | boolean>(value: T) => new LiteralSchema(value),
  enum: <T extends readonly [string, ...string[]]>(values: T) => new EnumSchema(values),
  union: (schemas: readonly ZodTypeAny[]) => new UnionSchema(schemas),
  array: (schema: ZodTypeAny) => new ArraySchema(schema),
  record: (schema: ZodTypeAny) => new RecordSchema(schema),
  object: <T extends ObjectShape>(shape: T) => new ZodObjectSchema(shape),
};
