import { join } from "../../../shared/path.ts";
import { createDefaultUpdateHandler, createUpdateCommand } from "./update.ts";
import { assert, assertEquals, assertStringIncludes } from "std/assert";

const NOOP_WRITER = () => {};

interface CallRecord {
  command: string;
  args: string[];
}

function createRunner(records: CallRecord[]): (command: string, args: string[]) => Promise<{
  success: boolean;
  code: number;
  stdout: string;
  stderr: string;
}> {
  return (command, args) => {
    records.push({ command, args: [...args] });
    if (args.length === 1 && args[0] === "--version") {
      return Promise.resolve({ success: true, code: 0, stdout: "deno 2.0.0\n", stderr: "" });
    }
    return Promise.resolve({ success: true, code: 0, stdout: "", stderr: "" });
  };
}

Deno.test("update in dry-run only triggers the version check", async () => {
  const calls: CallRecord[] = [];
  const handler = createDefaultUpdateHandler({
    runner: createRunner(calls),
    writer: NOOP_WRITER,
    cliVersion: "0.1.0",
  });

  await handler({
    channel: "beta",
    binary: false,
    dryRun: true,
    global: { json: false },
  });

  assertEquals(calls.length, 1);
  assertEquals(calls[0], { command: "deno", args: ["--version"] });
});

Deno.test("update with --binary executes deno compile", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  const previousCwd = Deno.cwd();
  try {
    Deno.chdir(tempDir);
    const calls: CallRecord[] = [];
    const handler = createDefaultUpdateHandler({
      runner: createRunner(calls),
      writer: NOOP_WRITER,
      cliVersion: "0.2.0",
    });

    await handler({
      channel: "canary",
      binary: true,
      dryRun: false,
      global: { json: false },
    });

    assertEquals(calls.length, 2);
    assertEquals(calls[0], { command: "deno", args: ["--version"] });
    assertEquals(calls[1], {
      command: "deno",
      args: ["compile", "-A", "--output", "dist/tsera", "jsr:tsera@canary/cli/main.ts"],
    });

    const distStat = await Deno.stat(join(tempDir, "dist"));
    assert(distStat.isDirectory);
  } finally {
    Deno.chdir(previousCwd);
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("update install uses the global flag", async () => {
  const calls: CallRecord[] = [];
  const handler = createDefaultUpdateHandler({
    runner: createRunner(calls),
    writer: NOOP_WRITER,
    cliVersion: "1.0.0",
  });

  await handler({
    channel: "stable",
    binary: false,
    dryRun: false,
    global: { json: false },
  });

  assertEquals(calls.length, 2);
  assertEquals(calls[0], { command: "deno", args: ["--version"] });
  assertEquals(calls[1], {
    command: "deno",
    args: [
      "install",
      "--global",
      "-A",
      "-f",
      "--name",
      "tsera",
      "jsr:tsera@latest/cli/main.ts",
    ],
  });
});

Deno.test("update command shows help", () => {
  const command = createUpdateCommand();
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
  assertStringIncludes(output, "Upgrade the TSera CLI");
  assertStringIncludes(output, "tsera update");
  assertStringIncludes(output, "OPTIONS");
  assertStringIncludes(output, "EXAMPLES");
  assertStringIncludes(output, "--channel");
  assertStringIncludes(output, "--binary");
  assertStringIncludes(output, "--dry-run");
});

Deno.test("update command rejects invalid channel", async () => {
  const command = createUpdateCommand();
  let error: Error | undefined;

  try {
    await command.parse(["--channel", "invalid"]);
  } catch (e) {
    error = e instanceof Error ? e : new Error(String(e));
  }

  assert(error !== undefined, "Should throw an error for invalid channel");
  assertStringIncludes(error.message, "Unknown channel");
  assertStringIncludes(error.message, "invalid");
});

Deno.test("update command accepts all valid channels", async () => {
  let received: { channel?: string } = {};

  const handler = (context: { channel: string }) => {
    received = { channel: context.channel };
  };

  const commandWithHandler = createUpdateCommand(handler);

  for (const channel of ["stable", "beta", "canary"] as const) {
    received = {};
    await commandWithHandler.parse(["--channel", channel]);
    assertEquals(received.channel, channel);
  }
});

Deno.test("update command combines all options correctly", async () => {
  let received: {
    channel?: string;
    binary?: boolean;
    dryRun?: boolean;
  } = {};

  const handler = (context: {
    channel: string;
    binary: boolean;
    dryRun: boolean;
  }) => {
    received = {
      channel: context.channel,
      binary: context.binary,
      dryRun: context.dryRun,
    };
  };

  const command = createUpdateCommand(handler);
  await command.parse(["--channel", "canary", "--binary", "--dry-run"]);

  assertEquals(received.channel, "canary");
  assertEquals(received.binary, true);
  assertEquals(received.dryRun, true);
});
