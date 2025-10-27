import { createRouter } from "./router.ts";
import type { CliMetadata } from "./main.ts";
import type { DevCommandContext } from "./commands/dev.ts";
import type { InitCommandContext } from "./commands/init.ts";
import type { UpdateCommandContext } from "./commands/update.ts";

const TEST_METADATA: CliMetadata = { version: "test" };

function assertEquals<T>(actual: T, expected: T): void {
  if (typeof actual === "object" && actual !== null && expected !== null) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
      throw new Error(`Assertion failed:\nActual:   ${actualJson}\nExpected: ${expectedJson}`);
    }
    return;
  }

  if (actual !== expected) {
    throw new Error(`Assertion failed: actual=\"${actual}\" expected=\"${expected}\"`);
  }
}

Deno.test("router transmet les options globales aux sous-commandes", async () => {
  let received: InitCommandContext | undefined;

  const router = createRouter(TEST_METADATA, {
    init: (context) => {
      received = context;
    },
  });

  await router.parse(["--json", "--strict", "init", "demo", "--template", "custom"]);

  if (!received) {
    throw new Error("Le handler init n'a pas été invoqué.");
  }

  assertEquals(received.directory, "demo");
  assertEquals(received.template, "custom");
  assertEquals(received.global, { json: true, strict: true });
});

Deno.test("router mappe les options de dev", async () => {
  let received: DevCommandContext | undefined;

  const router = createRouter(TEST_METADATA, {
    dev: (context) => {
      received = context;
    },
  });

  await router.parse(["dev", "./project", "--no-watch", "--plan-only", "--apply"]);

  if (!received) {
    throw new Error("Le handler dev n'a pas été invoqué.");
  }

  assertEquals(received.projectDir, "./project");
  assertEquals(received.watch, false);
  assertEquals(received.planOnly, true);
  assertEquals(received.apply, true);
  assertEquals(received.global, { json: false, strict: false });
});

Deno.test("update valide le canal et expose les options", async () => {
  let received: UpdateCommandContext | undefined;

  const router = createRouter(TEST_METADATA, {
    update: (context) => {
      received = context;
    },
  });

  await router.parse(["update", "--channel", "beta", "--binary"]);

  if (!received) {
    throw new Error("Le handler update n'a pas été invoqué.");
  }

  assertEquals(received.channel, "beta");
  assertEquals(received.binary, true);
  assertEquals(received.dryRun, false);
});
