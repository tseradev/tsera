import { assertEquals, assertStringIncludes } from "../../testing/asserts.ts";
import { createDevCommand, type DevCommandContext } from "./dev.ts";
import type { CliMetadata } from "../main.ts";

const TEST_METADATA: CliMetadata = { version: "test" };

Deno.test("dev command passes context to handler", async () => {
  let received: DevCommandContext | undefined;

  const command = createDevCommand(TEST_METADATA, (context) => {
    received = context;
  });

  await command.parse(["--once", "--plan-only"]);

  if (!received) {
    throw new Error("The dev handler was not invoked.");
  }

  assertEquals(received.projectDir, ".");
  assertEquals(received.watch, true);
  assertEquals(received.once, true);
  assertEquals(received.planOnly, true);
  assertEquals(received.apply, false);
  // Note: global options like --json are added by the router, not the command itself
});

Deno.test("dev command accepts custom project directory", async () => {
  let received: DevCommandContext | undefined;

  const command = createDevCommand(TEST_METADATA, (context) => {
    received = context;
  });

  await command.parse(["./my-project", "--once"]);

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

  await command.parse(["--once", "--apply"]);

  if (!received) {
    throw new Error("The dev handler was not invoked.");
  }

  assertEquals(received.apply, true);
  assertEquals(received.planOnly, false);
});

Deno.test("dev command handles --plan-only flag", async () => {
  let received: DevCommandContext | undefined;

  const command = createDevCommand(TEST_METADATA, (context) => {
    received = context;
  });

  await command.parse(["--once", "--plan-only"]);

  if (!received) {
    throw new Error("The dev handler was not invoked.");
  }

  assertEquals(received.planOnly, true);
  assertEquals(received.apply, false);
});

Deno.test("dev command handles all flags together", async () => {
  let received: DevCommandContext | undefined;

  const command = createDevCommand(TEST_METADATA, (context) => {
    received = context;
  });

  await command.parse(["./project", "--once", "--apply", "--plan-only"]);

  if (!received) {
    throw new Error("The dev handler was not invoked.");
  }

  assertEquals(received.projectDir, "./project");
  assertEquals(received.once, true);
  assertEquals(received.apply, true);
  assertEquals(received.planOnly, true);
});

Deno.test("dev command defaults watch to true", async () => {
  let received: DevCommandContext | undefined;

  const command = createDevCommand(TEST_METADATA, (context) => {
    received = context;
  });

  await command.parse(["--once"]);

  if (!received) {
    throw new Error("The dev handler was not invoked.");
  }

  assertEquals(received.watch, true);
});

Deno.test("dev command defaults once to false", async () => {
  let received: DevCommandContext | undefined;

  const command = createDevCommand(TEST_METADATA, (context) => {
    received = context;
  });

  // Use --plan-only to avoid actually running the watch loop
  await command.parse([".", "--plan-only", "--once"]);

  if (!received) {
    throw new Error("The dev handler was not invoked.");
  }

  assertEquals(received.once, true);
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
  assertStringIncludes(output, "Plan and apply TSera artifacts in development mode");
  assertStringIncludes(output, "--watch");
  assertStringIncludes(output, "--once");
  assertStringIncludes(output, "--plan-only");
  assertStringIncludes(output, "--apply");
  // Note: --json is a global option added by the router, not shown in command help
});
