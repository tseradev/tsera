/**
 * Determines the CLI version from environment variable or returns a default.
 *
 * @returns CLI version string.
 */
export function determineCliVersion(): string {
  return Deno.env.get("TSERA_VERSION") ?? "0.0.0-dev";
}
