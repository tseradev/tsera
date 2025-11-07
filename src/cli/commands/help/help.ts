import { Command } from "../../deps/command.ts";
import type { GlobalCLIOptions } from "../../router.ts";
import { renderModernHelp } from "./renderer.ts";
import type { ModernHelpConfig } from "./types.ts";

/** CLI options accepted by the {@code help} command. */
interface HelpCommandOptions extends GlobalCLIOptions {
  // Future: could add --format or --markdown options
}

/**
 * Context object passed to help command handlers.
 */
export interface HelpCommandContext {
  /** Optional command name to show help for. */
  command?: string;
  /** Global CLI options. */
  global: GlobalCLIOptions;
}

/**
 * Function signature for help command implementations.
 */
export type HelpCommandHandler = (context: HelpCommandContext) => Promise<void> | void;

/**
 * Creates the default help command handler.
 */
function createDefaultHelpHandler(): HelpCommandHandler {
  return (_context) => {
    // In the future, we could provide command-specific help here
    // For now, this will be handled by the router's main help system
    console.log("Use --help flag on any command for detailed help.");
  };
}

/**
 * Constructs the Cliffy command definition for {@code tsera help}.
 */
export function createHelpCommand(
  handler: HelpCommandHandler = createDefaultHelpHandler(),
) {
  return new Command()
    .description("Display help information for TSera CLI commands.")
    .arguments("[command]")
    .action(async (_options, command?: string) => {
      await handler({
        command,
        global: { json: false },
      });
    });
}

/**
 * Patch the provided command instance to render a custom modern help layout.
 *
 * @param command - Command instance exposing a {@link showHelp} method.
 * @param config - Descriptor of the CLI name, tagline, options, and examples.
 */
export function applyModernHelp(
  command: { showHelp: () => void },
  config: ModernHelpConfig,
): void {
  const original = command.showHelp.bind(command);

  command.showHelp = () => {
    try {
      console.log(renderModernHelp(config));
    } catch (error) {
      // Fallback to original help if rendering fails
      original();
      if (error instanceof Error) {
        console.debug("Failed to render custom help", error.message);
      }
    }
  };

  // Ensure TypeScript does not consider the original unused.
  void original;
}

// Re-export public types for convenience
export type { ModernHelpCommand, ModernHelpConfig } from "./types.ts";
export type { Palette } from "../../ui/palette.ts";
