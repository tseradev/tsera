import { join } from "../../../shared/path.ts";
import { createDefaultUpdateHandler } from "./update.ts";
import { assert, assertEquals } from "../../../testing/asserts.ts";

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
      args: ["compile", "-A", "--output", "dist/tsera", "jsr:tsera/cli/main.ts@canary"],
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
      "jsr:tsera/cli/main.ts@latest",
    ],
  });
});
