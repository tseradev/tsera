# TypeScript Standards for TSera

## TypeScript Philosophy

TSera enforces **strict TypeScript** with a preference for **types over interfaces** for better type
inference and composition. All code must be type-safe, explicit, and follow TypeScript best
practices.

## Compiler Configuration

### Strict Mode Requirements

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": false,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

### Additional Strict Options

- **`noImplicitAny`**: Disallow implicit `any` types
- **`noImplicitReturns`**: Require return type annotations
- **`noImplicitThis`**: Disable implicit `this` typing
- **`exactOptionalPropertyTypes`**: Strict optional property checking

## Type Safety Policies

### No Implicit Any

```typescript
// ❌ AVOID: Implicit any types
function processData(data: any) {
  return data.map((item) => item.value);
}

// ✅ PREFER: Explicit types
interface DataItem {
  value: string;
}

function processData(data: DataItem[]) {
  return data.map((item) => item.value);
}
```

### Explicit Type Annotations

```typescript
// ❌ AVOID: Missing return types
function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  return total; // Error: Implicit any return
}

// ✅ PREFER: Explicit return types
interface Item {
  price: number;
}

function calculateTotal(items: Item[]): number {
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  return total; // Explicit number return
}
```

### Type Assertions

```typescript
// ❌ AVOID: Unsafe type assertions
const user = unknownUser as User; // Unsafe

// ✅ PREFER: Type guards
const user = unknownUser;
if (isUser(user)) {
  // Safe to use user as User type
}

function isUser(value: unknown): value is User {
  return typeof value === "object" && value !== null && "name" in value;
}
```

## TSera-Specific Type Patterns

### Entity Type Definitions

```typescript
// ✅ PREFER: Types over interfaces for better inference
export type FieldDef = {
  validator: ZodType;
  visibility?: "public" | "internal" | "secret";
  immutable?: boolean;
  stored?: boolean;
  description?: string;
  example?: unknown;
  db?: {
    primary?: boolean;
    unique?: boolean;
    index?: boolean;
    defaultNow?: boolean;
  };
};

// ❌ AVOID: Interfaces unless necessary
interface FieldDefInterface {
  validator: ZodType;
  visibility?: "public" | "internal" | "secret";
  immutable?: boolean;
  stored?: boolean;
  description?: string;
  example?: unknown;
}
```

### Entity Configuration Types

```typescript
// ✅ PREFER: Type aliases for complex configurations
export type EntityConfig = {
  name: string;
  table?: boolean;
  schema?: boolean;
  doc?: boolean;
  test?: "smoke" | "full" | false;
  active?: boolean;
  fields: Record<string, FieldDef>;
  relations?: (r: unknown) => RelationsConfig;
  openapi?: {
    enabled?: boolean;
    tags?: string[];
    summary?: string;
    description?: string;
  };
  docs?: {
    description?: string;
    examples?: Record<string, unknown>;
  };
  actions?: (a: unknown) => ActionsConfig;
};

// ❌ AVOID: Complex nested interfaces
interface ComplexEntityConfig {
  user: {
    profile: {
      personal: {
        contact: {
          email: string;
          phone: string;
        };
      };
    };
  };
}
```

### CLI Type Definitions

```typescript
// ✅ PREFER: Union types for command options
export type CommandOption<T = string> {
  flags: string[];
  description: string;
  default?: T;
  required?: boolean;
  validate?: (value: unknown) => T | void;
};

// ❌ AVOID: Overly generic any types
export interface LegacyCommandOption {
  name: string;
  options: Record<string, any>; // Too generic
}
```

## Runtime Type Validation

### Zod Integration

```typescript
// ✅ PREFER: Zod for runtime validation with type inference
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  createdAt: z.date(),
});

export type UserType = z.infer<typeof UserSchema>;

// Runtime validation with type safety
function validateUser(data: unknown): data is UserType {
  return UserSchema.parse(data);
}
```

### Type Guards

```typescript
// ✅ PREFER: Type guards for runtime checks
function isEntityConfig(value: unknown): value is EntityConfig {
  return typeof value === "object" &&
    value !== null &&
    typeof value.name === "string" &&
    Array.isArray(value.fields);
}

// ❌ AVOID: Type assertions without proper guards
function isEntityConfigUnsafe(value: unknown): EntityConfig {
  return value as EntityConfig; // Unsafe without validation
}
```

## Generic Type Usage

### Utility Types

```typescript
// ✅ PREFER: Generic utility functions
function first<T>(array: T[]): T | undefined {
  return array.length > 0 ? array[0] : undefined;
}

// ❌ AVOID: Type assertions
function firstUnsafe<T>(array: T[]): T {
  return array[0] as T; // Unsafe assertion
}
```

### Database Type Mapping

```typescript
// ✅ PREFER: Type-safe database field mapping
export interface DatabaseField {
  name: string;
  type: "TEXT" | "INTEGER" | "BOOLEAN" | "TIMESTAMP" | "JSONB";
  nullable: boolean;
  primary: boolean;
  unique: boolean;
  index: boolean;
}

function mapEntityFieldToDatabase(field: FieldDef): DatabaseField {
  const typeMap = {
    string: "TEXT",
    number: "INTEGER",
    boolean: "BOOLEAN",
    date: "TIMESTAMP",
    json: "JSONB",
  };

  return {
    name: field.name,
    type: typeMap[typeof field.validator._def.type] || "TEXT",
    nullable: field.validator._def.type === "ZodOptional" ||
      field.validator._def.type === "ZodNullable",
    primary: field.db?.primary || false,
    unique: field.db?.unique || false,
    index: field.db?.index || false,
  };
}
```

## Error Handling Patterns

### Type-Safe Error Types

```typescript
// ✅ PREFER: Specific error types with generic constraints
class ValidationError<T = Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: T
  ) {
    super(message);
  }
}

// ❌ AVOID: Generic error types
class GenericError extends Error {
  constructor(message: string) {
    super(message);
  }
}
```

### Result Types

```typescript
// ✅ PREFER: Result types for better error handling
export type Result<T, E = Error> = {
  success: true;
  data: T;
} | {
  success: false;
  error: E;
};

function validateEntity<T>(config: EntityConfig): Result<T, ValidationError> {
  try {
    const entity = defineEntity(config);
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error };
  }
}
```

## Performance Considerations

### Type Checking Performance

- **Avoid Complex Types**: Keep type definitions simple and fast
- **Use Type Inference**: Let TypeScript infer types where possible
- **Minimize Generics**: Use generics only when necessary
- **Prefer Const Assertions**: Use `as const` for better type inference

### Compilation Performance

- **Incremental Compilation**: Use `--incremental` flag for large projects
- **Skip Type Checking**: Use `--skipLibCheck` for third-party libraries
- **Parallel Compilation**: Use `--parallel` for multiple files

## Code Organization

### Type Definition Files

```typescript
// ✅ PREFER: Centralized type definitions
// types/index.ts
export type { Order, Product, User } from "./user.types.ts";
export type { EntityConfig, FieldDef } from "./entity.types.ts";

// ❌ AVOID: Scattered type definitions
// user.types.ts
// product.types.ts
// entity.types.ts
```

### Interface Segregation

```typescript
// ✅ PREFER: Small, focused interfaces
interface UserReader {
  getId(): string;
  getEmail(): string;
}

interface UserWriter {
  setName(name: string): void;
  setEmail(email: string): void;
}

// ❌ AVOID: Large, monolithic interfaces
interface User {
  getId(): string;
  getEmail(): string;
  setName(name: string): void;
  setEmail(email: string): void;
  getName(): string; // Violates interface segregation
}
```

## Migration and Compatibility

### Type Evolution Strategy

- **Backward Compatibility**: Maintain compatibility when changing types
- **Deprecation Warnings**: Mark deprecated types clearly
- **Version-Specific Types**: Use conditional types for different versions
- **Migration Paths**: Provide clear migration guides for type changes

### Compatibility Layers

```typescript
// ✅ PREFER: Compatibility layers
type LegacyUser = {
  id: string;
  name: string; // Legacy field
};

type ModernUser = LegacyUser & {
  email: string; // New field
};

// ❌ AVOID: Breaking changes without migration
type BreakingUser = {
  id: number; // Changed from string to number
};
```

## Best Practices

### Type Design Principles

1. **Prefer Types**: Use types over interfaces for better inference
2. **Be Explicit**: Always specify types explicitly
3. **Use Generics**: Use generics for reusable type logic
4. **Avoid Any**: Never use `any` unless absolutely necessary
5. **Type Safety**: Ensure all code is type-safe at compile time

### Common Patterns

- **Discriminated Unions**: Use discriminated unions for better type safety
- **Type Guards**: Use type guards for runtime type checking
- **Utility Types**: Create reusable utility types
- **Branded Types**: Use branded types for domain-specific values

### Code Quality

- **Strict Compilation**: All code must pass strict TypeScript compilation
- **No Type Assertions**: Avoid `as` assertions without proper guards
- **Complete Coverage**: All public APIs must have type annotations
- **Consistent Style**: Use consistent type patterns across codebase

### TSera-Specific Rules

- **Entity Types**: All entities must use strict `EntityConfig` type
- **CLI Types**: All CLI functions must have explicit parameter and return types
- **Generated Code**: All generated code must be type-safe
- **Zod Integration**: Use Zod for runtime validation with proper type inference
