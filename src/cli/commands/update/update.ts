import { join } from "../../../shared/path.ts";
import { Command } from "cliffy/command";
import { createLogger } from "../../utils/log.ts";
import { ensureDir } from "../../utils/fsx.ts";
import { determineCliVersion } from "../../utils/version.ts";
import type { GlobalCLIOptions } from "../../router.ts";
import { renderCommandHelp } from "../help/command-help-renderer.ts";
import { UpdateConsole } from "./update-ui.ts";

/**
 * CLI options accepted by the {@code update} command.
 * @internal
 */
interface UpdateCommandOptions extends GlobalCLIOptions {
  channel: "stable" | "beta" | "canary";
  binary: boolean;
  dryRun: boolean;
}

/**
 * Options passed to the update action handler by Cliffy.
 * @internal
 */
interface UpdateActionOptions {
  json?: boolean;
  channel?: "stable" | "beta" | "canary";
  binary?: boolean;
  dryRun?: boolean;
}

/**
 * Context object passed to update command handlers.
 */
export interface UpdateCommandContext {
  /** Release channel to use for updates. */
  channel: "stable" | "beta" | "canary";
  /** Whether to install a compiled binary instead of using deno install. */
  binary: boolean;
  /** Whether to show steps without applying them. */
  dryRun: boolean;
  /** Global CLI options. */
  global: GlobalCLIOptions;
}

/**
 * Function signature for update command implementations.
 */
export type UpdateCommandHandler = (context: UpdateCommandContext) => Promise<void> | void;

/**
 * Result of executing a command.
 * @internal
 */
interface CommandExecutionResult {
  /** Whether the command succeeded. */
  success: boolean;
  /** Exit code from the command. */
  code: number;
  /** Standard output from the command. */
  stdout: string;
  /** Standard error from the command. */
  stderr: string;
}

/**
 * Function that executes a command and returns its result.
 * @internal
 */
type CommandRunner = (command: string, args: string[]) => Promise<CommandExecutionResult>;

/**
 * Dependencies for the update command handler.
 * @internal
 */
interface UpdateHandlerDependencies {
  /** Optional command runner for testing. */
  runner?: CommandRunner;
  /** Optional writer for output. */
  writer?: (line: string) => void;
  /** Optional CLI version override for testing. */
  cliVersion?: string;
  /** Optional exit function for testing. */
  exit?: (code: number) => never;
}

const TEXT_DECODER = new TextDecoder();

/**
 * Executes a subprocess and captures stdout/stderr for use in update operations.
 *
 * @param command - Command to execute.
 * @param args - Command arguments.
 * @returns Promise resolving to the command execution result.
 * @internal
 */
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
  const exitFn = dependencies.exit ?? ((code: number): never => Deno.exit(code));

  return async (context) => {
    const jsonMode = context.global.json;
    const logger = createLogger({ json: jsonMode, writer });
    const human: UpdateConsole | undefined = jsonMode ? undefined : new UpdateConsole({
      channel: context.channel,
      binary: context.binary,
      currentVersion: cliVersion,
      writer,
    });

    if (jsonMode) {
      logger.event("update:start", {
        channel: context.channel,
        binary: context.binary,
        dryRun: context.dryRun,
        current: cliVersion,
      });
    } else {
      human?.start();
    }

    const versionInfo = await runner("deno", ["--version"]);
    if (!versionInfo.success) {
      const error = `Unable to determine the Deno version (code ${versionInfo.code}).`;
      if (jsonMode) {
        logger.error("Failed to get Deno version", { code: versionInfo.code });
        throw new Error(error);
      } else {
        human?.updateError(error, "unknown");
        exitFn(1);
      }
    }

    const denoVersion = parseDenoVersion(versionInfo.stdout);
    if (jsonMode) {
      logger.event("update:deno", { deno: denoVersion });
    } else {
      human?.denoVersionChecked(denoVersion);
    }

    const specifier = buildSpecifier(context.channel);
    const args = buildDenoArgs(context, specifier);
    const command = `deno ${args.join(" ")}`;

    if (context.dryRun) {
      if (jsonMode) {
        logger.event("update:dry-run", { command: "deno", args });
      } else {
        human?.dryRun(command);
      }
      return;
    }

    // Only create dist directory if not in dry-run mode
    if (context.binary) {
      await ensureDir(join(Deno.cwd(), "dist"));
    }

    if (!jsonMode) {
      human?.updateInProgress(command);
    }

    const result = await runner("deno", args);
    if (!result.success) {
      const stderr = result.stderr.trim();
      const stdout = result.stdout.trim();
      const detail = stderr || stdout;

      // Extract the main error message from Deno output
      let errorMessage = `Update command failed (exit code ${result.code})`;
      let errorType:
        | "package-not-found"
        | "version-unsupported"
        | "permission"
        | "network"
        | "unknown" = "unknown";

      if (detail) {
        // Try to extract a cleaner error message
        const errorMatch = detail.match(/error:\s*(.+?)(?:\n|$)/i);
        if (errorMatch) {
          errorMessage = errorMatch[1].trim();
        } else {
          // Use first line of detail if no match
          errorMessage = detail.split("\n")[0].trim();
        }

        // Detect error type for better user guidance
        const lowerDetail = detail.toLowerCase();
        // Package/version errors: either package doesn't exist or version is invalid
        if (
          lowerDetail.includes("version tag not supported") ||
          lowerDetail.includes("invalid version") ||
          lowerDetail.includes("version not found") ||
          lowerDetail.includes("not found") ||
          lowerDetail.includes("does not exist") ||
          lowerDetail.includes("could not find") ||
          lowerDetail.includes("package not found")
        ) {
          errorType = "package-not-found";
        } else if (
          lowerDetail.includes("permission") || lowerDetail.includes("denied") ||
          lowerDetail.includes("eacces") || lowerDetail.includes("access denied")
        ) {
          errorType = "permission";
        } else if (
          lowerDetail.includes("network") || lowerDetail.includes("connection") ||
          lowerDetail.includes("timeout") || lowerDetail.includes("dns")
        ) {
          errorType = "network";
        }
      }

      if (jsonMode) {
        logger.error("Update failed", { code: result.code, stderr, stdout, errorType });
        throw new Error(errorMessage);
      } else {
        human?.updateError(errorMessage, errorType);
        exitFn(1);
      }
    }

    if (jsonMode) {
      logger.event("update:applied", {
        method: context.binary ? "compile" : "install",
        code: result.code,
      });
    } else {
      human?.updateComplete();
    }

    const migrationSteps = ["tsera doctor --fix", "tsera dev --apply"];
    if (jsonMode) {
      logger.event("update:migration", { steps: migrationSteps });
    } else {
      human?.showNextSteps(migrationSteps);
    }
  };
}

/**
 * Constructs the Cliffy command definition for {@code tsera update}.
 *
 * The command supports three options:
 * - `--channel <channel>`: Release channel (stable|beta|canary, default: stable)
 * - `--binary`: Install compiled binary instead of using deno install
 * - `--dry-run`: Show commands without executing them
 *
 * @param handler - Optional update command handler (defaults to {@link createDefaultUpdateHandler})
 * @returns Configured Cliffy command ready for parsing
 *
 * @example
 * ```typescript
 * const command = createUpdateCommand();
 * await command.parse(["--channel", "beta", "--dry-run"]);
 * ```
 */
export function createUpdateCommand(
  handler: UpdateCommandHandler = createDefaultUpdateHandler(),
) {
  const command = new Command()
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
    .action(async (options: UpdateActionOptions) => {
      const { json = false, channel = "stable", binary = false, dryRun = false } = options;
      await handler({
        channel,
        binary,
        dryRun,
        global: { json },
      });
    });

  // Apply modern help rendering
  const originalShowHelp = command.showHelp.bind(command);
  command.showHelp = () => {
    try {
      console.log(
        renderCommandHelp({
          commandName: "update",
          description: "Upgrade the TSera CLI via deno install or compiled binaries.",
          options: [
            {
              label: "--channel <channel>",
              description: "Release channel: stable, beta, or canary (default: stable)",
            },
            {
              label: "--binary",
              description: "Install the compiled binary instead of using deno install",
            },
            {
              label: "--dry-run",
              description: "Show the commands that would be executed without running them",
            },
            {
              label: "--json",
              description: "Output machine-readable NDJSON events",
            },
          ],
          examples: [
            "tsera update",
            "tsera update --binary",
            "tsera update --channel beta --dry-run",
          ],
        }),
      );
    } catch {
      originalShowHelp();
    }
  };

  return command;
}

/**
 * Builds a JSR specifier string for the specified release channel.
 *
 * @param channel - Release channel to use.
 * @returns JSR specifier string.
 */
function buildSpecifier(channel: UpdateCommandContext["channel"]): string {
  const tag = channel === "stable" ? "latest" : channel;
  // JSR format: jsr:package@version/path
  return `jsr:tsera@${tag}/cli/main.ts`;
}

/**
 * Builds Deno command arguments for the update operation.
 *
 * @param context - Update command context.
 * @param specifier - JSR specifier string.
 * @returns Array of Deno command arguments.
 */
function buildDenoArgs(context: UpdateCommandContext, specifier: string): string[] {
  if (context.binary) {
    return ["compile", "-A", "--output", "dist/tsera", specifier];
  }
  return ["install", "--global", "-A", "-f", "--name", "tsera", specifier];
}

/**
 * Parses the Deno version from command output.
 *
 * @param stdout - Standard output from `deno --version`.
 * @returns Version string (e.g., "2.0.0").
 * @throws {Error} If the version cannot be parsed.
 */
function parseDenoVersion(stdout: string): string {
  const match = stdout.match(/deno\s+([0-9]+(?:\.[0-9]+)*)/i);
  if (!match) {
    throw new Error("Unable to parse the Deno version.");
  }
  return match[1];
}
