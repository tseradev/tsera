import { assertEquals, assertStringIncludes } from "std/assert";
import { createDevCommand, type DevCommandContext } from "./dev.ts";
import type { CliMetadata } from "../../main.ts";

const TEST_METADATA: CliMetadata = { version: "test" };

Deno.test("dev command passes context to handler", async () => {
  let received: DevCommandContext | undefined;

  const command = createDevCommand(TEST_METADATA, (context) => {
    received = context;
  });

  await command.parse([]);

  if (!received) {
    throw new Error("The dev handler was not invoked.");
  }

  assertEquals(received.projectDir, ".");
  assertEquals(received.apply, false);
  // Note: global options like --json are added by the router, not the command itself
});

Deno.test("dev command accepts custom project directory", async () => {
  let received: DevCommandContext | undefined;

  const command = createDevCommand(TEST_METADATA, (context) => {
    received = context;
  });

  await command.parse(["./my-project"]);

  if (!received) {
    throw new Error("The dev handler was not invoked.");
  }

  assertEquals(received.projectDir, "./my-project");
});

Deno.test("dev command handles --apply flag", async () => {
  let received: DevCommandContext | undefined;

  const command = createDevCommand(TEST_METADATA, (context) => {
    received = context;
  });

  await command.parse(["--apply"]);

  if (!received) {
    throw new Error("The dev handler was not invoked.");
  }

  assertEquals(received.apply, true);
});

Deno.test("dev command handles all flags together", async () => {
  let received: DevCommandContext | undefined;

  const command = createDevCommand(TEST_METADATA, (context) => {
    received = context;
  });

  await command.parse(["./project", "--apply"]);

  if (!received) {
    throw new Error("The dev handler was not invoked.");
  }

  assertEquals(received.projectDir, "./project");
  assertEquals(received.apply, true);
});

Deno.test("dev command shows help", () => {
  const command = createDevCommand(TEST_METADATA, () => {});
  const captured: string[] = [];
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    captured.push(args.map((value) => String(value)).join(" "));
  };

  try {
    command.showHelp();
  } finally {
    console.log = originalLog;
  }

  const output = captured.join("\n");
  assertStringIncludes(
    output,
    "Watch entities, plan changes, and apply generated artifacts in-place.",
  );
  assertStringIncludes(output, "--apply");
  // Note: --json is a global option added by the router, not shown in command help
});
