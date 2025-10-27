/**
 * Shared type helpers for TSera core modules. The utilities are intentionally
 * lean to keep bootstrapping friction-free while the domain model matures.
 */

export type Immutable<T> = {
  readonly [K in keyof T]: Immutable<T[K]>;
};

export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };
