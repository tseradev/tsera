import { join } from "../../shared/path.ts";
import { Command } from "../deps/command.ts";
import { createLogger } from "../core/log.ts";
import { determineCliVersion } from "../core/version.ts";
import type { GlobalCLIOptions } from "../router.ts";

/** CLI options accepted by the {@code update} command. */
interface UpdateCommandOptions extends GlobalCLIOptions {
  channel: "stable" | "beta" | "canary";
  binary: boolean;
  dryRun: boolean;
}

/** Context object passed to update command handlers. */
export interface UpdateCommandContext {
  channel: "stable" | "beta" | "canary";
  binary: boolean;
  dryRun: boolean;
  global: GlobalCLIOptions;
}

/** Function signature for update command implementations. */
export type UpdateCommandHandler = (context: UpdateCommandContext) => Promise<void> | void;

interface CommandExecutionResult {
  success: boolean;
  code: number;
  stdout: string;
  stderr: string;
}

type CommandRunner = (command: string, args: string[]) => Promise<CommandExecutionResult>;

interface UpdateHandlerDependencies {
  runner?: CommandRunner;
  writer?: (line: string) => void;
  cliVersion?: string;
}

const TEXT_DECODER = new TextDecoder();

/** Executes a subprocess and captures stdout/stderr for use in update operations. */
function defaultRunner(command: string, args: string[]): Promise<CommandExecutionResult> {
  const denoCommand = new Deno.Command(command, {
    args,
    stdout: "piped",
    stderr: "piped",
  });
  return denoCommand.output().then((result) => ({
    success: result.success,
    code: result.code,
    stdout: TEXT_DECODER.decode(result.stdout),
    stderr: TEXT_DECODER.decode(result.stderr),
  }));
}

/**
 * Creates the default update command handler which delegates to {@code deno install/compile}.
 */
export function createDefaultUpdateHandler(
  dependencies: UpdateHandlerDependencies = {},
): UpdateCommandHandler {
  const runner = dependencies.runner ?? defaultRunner;
  const writer = dependencies.writer;
  const cliVersion = dependencies.cliVersion ?? determineCliVersion();

  return async (context) => {
    const logger = createLogger({ json: context.global.json, writer });
    logger.event("update:start", {
      channel: context.channel,
      binary: context.binary,
      dryRun: context.dryRun,
      current: cliVersion,
    });

    const versionInfo = await runner("deno", ["--version"]);
    if (!versionInfo.success) {
      throw new Error(`Unable to determine the Deno version (code ${versionInfo.code}).`);
    }

    const denoVersion = parseDenoVersion(versionInfo.stdout);
    logger.event("update:deno", { deno: denoVersion });

    const specifier = buildSpecifier(context.channel);
    const args = buildDenoArgs(context, specifier);

    if (context.binary) {
      await ensureDir(join(Deno.cwd(), "dist"));
    }

    if (context.dryRun) {
      logger.event("update:dry-run", { command: "deno", args });
      if (!context.global.json) {
        logger.info("Suggested command", { command: `deno ${args.join(" ")}` });
      }
    } else {
      const result = await runner("deno", args);
      if (!result.success) {
        const detail = result.stderr.trim() || result.stdout.trim();
        throw new Error(
          `The deno ${args.join(" ")} command failed (code ${result.code}).${
            detail ? ` ${detail}` : ""
          }`,
        );
      }

      logger.event("update:applied", {
        method: context.binary ? "compile" : "install",
        code: result.code,
      });
    }

    const migrationSteps = ["tsera doctor --fix", "tsera dev --apply"];
    logger.event("update:migration", { steps: migrationSteps });
    if (!context.global.json) {
      logger.info("Post-update steps", { next: migrationSteps.join(" && ") });
    }
  };
}

/**
 * Constructs the Cliffy command definition for {@code tsera update}.
 */
export function createUpdateCommand(
  handler: UpdateCommandHandler = createDefaultUpdateHandler(),
): Command<UpdateCommandOptions> {
  return new Command<UpdateCommandOptions>()
    .description("Update the TSera CLI via deno install or a compiled binary.")
    .option("--channel <channel:string>", "Release channel (stable|beta|canary).", {
      default: "stable",
      value: (value): "stable" | "beta" | "canary" => {
        if (value !== "stable" && value !== "beta" && value !== "canary") {
          throw new Error(`Unknown channel: ${value}`);
        }
        return value;
      },
    })
    .option("--binary", "Install the compiled binary instead of deno install.", { default: false })
    .option("--dry-run", "Show the steps without applying them.", { default: false })
    .action(async (options) => {
      const { json, strict, channel, binary, dryRun } = options;
      await handler({
        channel,
        binary,
        dryRun,
        global: { json, strict },
      });
    });
}

function buildSpecifier(channel: UpdateCommandContext["channel"]): string {
  const tag = channel === "stable" ? "latest" : channel;
  return `jsr:tsera/cli/main.ts@${tag}`;
}

function buildDenoArgs(context: UpdateCommandContext, specifier: string): string[] {
  if (context.binary) {
    return ["compile", "-A", "--output", "dist/tsera", specifier];
  }
  return ["install", "-A", "-f", "--name", "tsera", specifier];
}

function parseDenoVersion(stdout: string): string {
  const match = stdout.match(/deno\s+([0-9]+(?:\.[0-9]+)*)/i);
  if (!match) {
    throw new Error("Unable to parse the Deno version.");
  }
  return match[1];
}

async function ensureDir(path: string): Promise<void> {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) {
      return;
    }
    throw error;
  }
}
