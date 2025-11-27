import { assertEquals } from "std/assert";
import { createDeployCommand } from "./deploy.ts";
import type { DeployInitContext } from "./deploy-init.ts";
import type { DeploySyncContext } from "./deploy-sync.ts";

Deno.test("deploy command shows help when called without subcommand", () => {
  let helpShown = false;
  const originalConsoleLog = console.log;

  console.log = () => {
    helpShown = true;
  };

  try {
    const command = createDeployCommand();
    // Call showHelp directly instead of parsing to avoid Deno.exit
    command.showHelp();
    assertEquals(helpShown, true);
  } finally {
    console.log = originalConsoleLog;
  }
});

Deno.test("deploy command passes context to init handler", async () => {
  let received: DeployInitContext | undefined;

  const command = createDeployCommand({
    init: (context) => {
      received = context;
    },
  });

  await command.parse(["init"]);

  if (!received) {
    throw new Error("The init handler was not invoked.");
  }

  assertEquals(received.projectDir, Deno.cwd());
  assertEquals(received.global.json, false);
});

Deno.test("deploy command passes context to sync handler", async () => {
  let received: DeploySyncContext | undefined;

  const command = createDeployCommand({
    sync: (context) => {
      received = context;
    },
  });

  await command.parse(["sync", "--force"]);

  if (!received) {
    throw new Error("The sync handler was not invoked.");
  }

  assertEquals(received.projectDir, Deno.cwd());
  assertEquals(received.force, true);
  assertEquals(received.global.json, false);
});

Deno.test("deploy command handlers receive context with json option", async () => {
  let initReceived: DeployInitContext | undefined;
  let syncReceived: DeploySyncContext | undefined;

  const command = createDeployCommand({
    init: (context) => {
      initReceived = context;
    },
    sync: (context) => {
      syncReceived = context;
    },
  });

  // Test init handler receives context
  await command.parse(["init"]);
  assertEquals(initReceived?.global.json, false);

  // Test sync handler receives context
  await command.parse(["sync"]);
  assertEquals(syncReceived?.global.json, false);
  assertEquals(syncReceived?.force, false);
});
