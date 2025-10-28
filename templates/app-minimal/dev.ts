const tasks = [
  { name: "api", args: ["task", "dev:api"] as const },
  { name: "web", args: ["task", "dev:web"] as const },
] as const;

type Managed = {
  name: string;
  child: Deno.Child;
};

const outputStreams: Promise<void>[] = [];

const processes: Managed[] = tasks.map(({ name, args }) => {
  const command = new Deno.Command(Deno.execPath(), {
    args: [...args],
    stdin: "inherit",
    stdout: "piped",
    stderr: "piped",
  });

  const child = command.spawn();
  if (child.stdout) {
    outputStreams.push(pipeOutput(name, child.stdout, false));
  }
  if (child.stderr) {
    outputStreams.push(pipeOutput(name, child.stderr, true));
  }

  return { name, child };
});

let shuttingDown = false;
let triggeredBySignal = false;
let exitCode = 0;

console.log("Starting TSera dev environment (Hono API + Fresh web)...");

const signalHandler = (signal: Deno.Signal) => {
  console.log(`\nReceived ${signal}, shutting down dev tasks...`);
  stopAll(signal, true);
};

Deno.addSignalListener("SIGINT", signalHandler);
Deno.addSignalListener("SIGTERM", signalHandler);

const statuses = processes.map(async ({ name, child }) => {
  const status = await child.status;

  if (!shuttingDown) {
    exitCode = status.success ? 0 : status.code ?? 1;
    if (!status.success) {
      console.error(`\n[${name}] exited with code ${status.code ?? 1}`);
    } else {
      console.log(`\n[${name}] exited`);
    }
    stopAll("SIGTERM", false);
  }

  return { name, status };
});

await Promise.all(statuses);
await Promise.all(outputStreams).catch((error) => {
  console.error("Failed to forward output", error);
});

Deno.removeSignalListener("SIGINT", signalHandler);
Deno.removeSignalListener("SIGTERM", signalHandler);

if (!triggeredBySignal && exitCode !== 0) {
  Deno.exit(exitCode);
}

function stopAll(signal: Deno.Signal, fromSignal: boolean) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  if (fromSignal) {
    triggeredBySignal = true;
  }

  for (const { child, name } of processes) {
    try {
      child.kill(signal);
    } catch (error) {
      if (
        error instanceof Deno.errors.NotFound ||
        error instanceof Deno.errors.NotSupported
      ) {
        continue;
      }
      console.error(`[${name}] failed to terminate`, error);
    }
  }
}

async function pipeOutput(
  name: string,
  stream: ReadableStream<Uint8Array>,
  isError: boolean,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = flushBuffer(name, buffer, isError);
  }

  buffer += decoder.decode();
  flushBuffer(name, buffer, isError, true);
}

function flushBuffer(
  name: string,
  buffer: string,
  isError: boolean,
  flushAll = false,
) {
  let remainder = buffer;
  let newlineIndex = remainder.indexOf("\n");

  while (newlineIndex >= 0) {
    const line = remainder.slice(0, newlineIndex);
    emitLine(name, line, isError);
    remainder = remainder.slice(newlineIndex + 1);
    newlineIndex = remainder.indexOf("\n");
  }

  if (flushAll && remainder.length > 0) {
    emitLine(name, remainder, isError);
    return "";
  }

  return remainder;
}

function emitLine(name: string, line: string, isError: boolean) {
  const cleaned = line.replace(/\r$/, "");
  const prefix = `[${name}]`;

  if (cleaned.length === 0) {
    if (isError) {
      console.error(prefix);
    } else {
      console.log(prefix);
    }
    return;
  }

  if (isError) {
    console.error(`${prefix} ${cleaned}`);
  } else {
    console.log(`${prefix} ${cleaned}`);
  }
}
