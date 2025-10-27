/**
 * Persistent state helpers. Currently in-memory placeholders with deterministic
 * serialisation for future safeWrite integration.
 */

export interface EngineState {
  graphHash: string;
}

export function createInitialState(): EngineState {
  return { graphHash: "" };
}
