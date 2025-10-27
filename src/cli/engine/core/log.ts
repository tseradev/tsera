/**
 * Logging helpers with consistent formatting.
 */

export function info(message: string): void {
  console.log(`[info] ${message}`);
}

export function warn(message: string): void {
  console.warn(`[warn] ${message}`);
}

export function error(message: string): void {
  console.error(`[error] ${message}`);
}
