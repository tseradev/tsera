export function determineCliVersion(): string {
  return Deno.env.get("TSERA_VERSION") ?? "0.0.0-dev";
}
