/**
 * Project context utilities shared across CLI commands.
 */

export interface CliContext {
  cwd: string;
}

export function createContext(cwd = Deno.cwd()): CliContext {
  return { cwd };
}
