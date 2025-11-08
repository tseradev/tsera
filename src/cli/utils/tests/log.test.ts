import { createLogger } from "../log.ts";
import { assert, assertEquals } from "@std/assert";

function stripAnsi(value: string): string {
  const escape = String.fromCharCode(27);
  const pattern = new RegExp(`${escape}\[[0-9;]*[A-Za-z]`, "g");
  return value.replace(pattern, "");
}

Deno.test("createLogger renders modern text output", () => {
  const lines: string[] = [];
  const logger = createLogger({ writer: (line) => lines.push(line) });

  logger.info("Project initialized", { directory: "/tmp/demo" });
  logger.event("init:plan", {
    summary: { create: 1, update: 0, delete: 0, noop: 0 },
  });

  assert(lines.length === 2, "Expected two log lines to be emitted.");
  const first = stripAnsi(lines[0]);
  assert(first.includes("ℹ INFO"), "The info badge should be present.");
  assert(first.includes("Project initialized"), "The message should be included.");
  assert(first.includes("directory=/tmp/demo"), "Context should be rendered inline.");

  const second = stripAnsi(lines[1]);
  assert(second.startsWith("🚀 Init"), "Events should include an expressive icon.");
  assert(second.includes("Plan"), "Event segments should be humanised.");
  assert(second.includes("summary="), "Event context should be appended.");
});

Deno.test("createLogger preserves structured JSON mode", () => {
  const lines: string[] = [];
  const logger = createLogger({ json: true, writer: (line) => lines.push(line) });

  logger.info("hello", { ok: true });
  logger.event("init:start", { directory: "." });

  assertEquals(lines.length, 2);

  const info = JSON.parse(lines[0]);
  assertEquals(info, { level: "info", message: "hello", context: { ok: true } });

  const event = JSON.parse(lines[1]);
  assertEquals(event.level, "info");
  assertEquals(event.event, "init:start");
  assertEquals(event.context?.directory, ".");
});
