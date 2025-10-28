const PLATFORM_NEWLINE = Deno.build.os === "windows" ? "\r\n" : "\n";

export function getPlatformNewline(): "\r\n" | "\n" {
  return PLATFORM_NEWLINE;
}

export function normalizeNewlines(
  value: string,
  newline: string = PLATFORM_NEWLINE,
): string {
  return value.replace(/\r\n|\r|\n/g, newline);
}
