import { Command } from "cliffy/command";
import { join, resolve } from "../../../shared/path.ts";
import { resolveConfig } from "../../utils/resolve-config.ts";
import { readEngineState } from "../../engine/state.ts";
import { renderCommandHelp } from "../help/command-help-renderer.ts";
import { bold, cyan, dim, gray, green, magenta, yellow } from "../../ui/colors.ts";
import { ensureDir, pathExists } from "../../utils/fsx.ts";

/**
 * JSON-RPC request structure for MCP protocol.
 * @internal
 */
interface JsonRpcRequest {
  /** JSON-RPC version. */
  jsonrpc: "2.0";
  /** Request identifier. */
  id: number | string;
  /** Method name to invoke. */
  method: string;
  /** Optional method parameters. */
  params?: Record<string, unknown>;
}

/**
 * Path to the PID file for the MCP server process.
 *
 * @param projectDir - Project directory.
 * @returns Path to the PID file.
 */
function getPidFilePath(projectDir: string): string {
  return join(projectDir, ".tsera", "mcp.pid");
}

/**
 * Reads the PID of the running MCP server.
 *
 * @param projectDir - Project directory.
 * @returns PID if the server is running, undefined otherwise.
 */
async function readPid(projectDir: string): Promise<number | undefined> {
  const pidPath = getPidFilePath(projectDir);
  if (!(await pathExists(pidPath))) {
    return undefined;
  }

  try {
    const content = await Deno.readTextFile(pidPath);
    const pid = parseInt(content.trim(), 10);
    return isNaN(pid) ? undefined : pid;
  } catch {
    return undefined;
  }
}

/**
 * Writes the PID of the MCP server process.
 *
 * @param projectDir - Project directory.
 * @param pid - Process ID.
 */
async function writePid(projectDir: string, pid: number): Promise<void> {
  const tseraDir = join(projectDir, ".tsera");
  await ensureDir(tseraDir);
  const pidPath = getPidFilePath(projectDir);
  await Deno.writeTextFile(pidPath, String(pid));
}

/**
 * Removes the PID file.
 *
 * @param projectDir - Project directory.
 */
async function removePid(projectDir: string): Promise<void> {
  const pidPath = getPidFilePath(projectDir);
  try {
    await Deno.remove(pidPath);
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Checks if a process with the given PID is still running.
 *
 * @param pid - Process ID.
 * @returns True if the process is running, false otherwise.
 */
async function isProcessRunning(pid: number): Promise<boolean> {
  try {
    // On Windows, use tasklist; on Unix, use kill -0
    if (Deno.build.os === "windows") {
      const command = new Deno.Command("tasklist", {
        args: ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"],
        stdout: "piped",
        stderr: "piped",
      });
      const { stdout } = await command.output();
      const output = new TextDecoder().decode(stdout);
      return output.trim().length > 0;
    } else {
      const command = new Deno.Command("kill", {
        args: ["-0", String(pid)],
        stdout: "piped",
        stderr: "piped",
      });
      const { code } = await command.output();
      return code === 0;
    }
  } catch {
    return false;
  }
}

/**
 * Stops the MCP server running in the background.
 *
 * @param projectDir - Project directory.
 */
async function stopMcpServer(projectDir: string): Promise<void> {
  const pid = await readPid(projectDir);
  if (!pid) {
    console.error(`${yellow("⚠")} ${yellow("No MCP server found running in background.")}`);
    Deno.exit(1);
  }

  const isRunning = await isProcessRunning(pid);
  if (!isRunning) {
    console.error(`${yellow("⚠")} ${yellow("MCP server process not found (PID may be stale).")}`);
    await removePid(projectDir);
    Deno.exit(1);
  }

  try {
    // Kill the process
    if (Deno.build.os === "windows") {
      const command = new Deno.Command("taskkill", {
        args: ["/PID", String(pid), "/F"],
        stdout: "piped",
        stderr: "piped",
      });
      await command.output();
    } else {
      const command = new Deno.Command("kill", {
        args: [String(pid)],
        stdout: "piped",
        stderr: "piped",
      });
      await command.output();
    }

    await removePid(projectDir);
    console.error("");
    console.error(`${green("✓")} ${bold("MCP server stopped")} ${dim("│")} ${gray(`PID ${pid}`)}`);
    console.error("");
  } catch (error) {
    console.error(
      `Failed to stop MCP server: ${error instanceof Error ? error.message : String(error)}`,
    );
    Deno.exit(1);
  }
}

/**
 * Starts the MCP server in the foreground.
 *
 * @param projectDir - Project directory.
 */
async function startMcpServerForeground(projectDir: string): Promise<void> {
  const config = await resolveConfig(projectDir);

  if (!config) {
    console.error("No TSera project found (missing tsera.json or deno.json).");
    Deno.exit(1);
  }

  // Check if server is already running in background
  const existingPid = await readPid(projectDir);
  if (existingPid) {
    const isRunning = await isProcessRunning(existingPid);
    if (isRunning) {
      console.error("");
      console.error(
        `${yellow("⚠")} ${yellow("MCP server is already running in background")} ${dim("│")} ${gray(`PID ${existingPid}`)
        }`,
      );
      console.error("");
      Deno.exit(1);
    } else {
      // Stale PID file, remove it
      await removePid(projectDir);
    }
  }

  // Display startup message on stderr (stdout is reserved for JSON-RPC responses)
  console.error("");
  console.error(
    `${magenta("◆")} ${bold("MCP")} ${dim("│")} ${gray("Server started. Waiting for JSON-RPC requests on stdin…")
    }`,
  );
  console.error(`  ${dim("Project:")} ${cyan(projectDir)}`);
  console.error("");

  const decoder = new TextDecoder();

  // Simple JSON-RPC over stdio loop
  for await (const chunk of Deno.stdin.readable) {
    const text = decoder.decode(chunk);
    const lines = text.split("\n").filter((l) => l.trim());

    for (const line of lines) {
      try {
        const request = JSON.parse(line) as JsonRpcRequest;
        await handleRequest(request, projectDir);
      } catch (error) {
        console.error("Failed to parse JSON-RPC request:", error);
      }
    }
  }
}

/**
 * Starts the MCP server in the background.
 *
 * @param projectDir - Project directory.
 */
async function startMcpServerBackground(projectDir: string): Promise<void> {
  const config = await resolveConfig(projectDir);

  if (!config) {
    console.error("No TSera project found (missing tsera.json or deno.json).");
    Deno.exit(1);
  }

  // Check if server is already running
  const existingPid = await readPid(projectDir);
  if (existingPid) {
    const isRunning = await isProcessRunning(existingPid);
    if (isRunning) {
      console.error("");
      console.error(
        `${yellow("⚠")} ${yellow("MCP server is already running in background")} ${dim("│")} ${gray(`PID ${existingPid}`)
        }`,
      );
      console.error("");
      Deno.exit(1);
    } else {
      // Stale PID file, remove it
      await removePid(projectDir);
    }
  }

  // Get the path to the CLI script
  const cliScript = Deno.execPath();
  const projectRoot = resolve(projectDir);

  // Start the server in background
  try {
    // On Windows, use Start-Process or cmd /c start to detach
    // On Unix, use nohup or & to detach
    if (Deno.build.os === "windows") {
      // Windows: use PowerShell Start-Process to run in background
      const psCommand = new Deno.Command("powershell", {
        args: [
          "-Command",
          `Start-Process -FilePath "${cliScript}" -ArgumentList "mcp" -WorkingDirectory "${projectRoot}" -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id | Out-File -FilePath "${getPidFilePath(projectRoot)
          }" -Encoding ASCII`,
        ],
        stdout: "piped",
        stderr: "piped",
      });

      const psResult = await psCommand.output();
      if (!psResult.success) {
        throw new Error("Failed to start MCP server in background");
      }

      // Wait a bit for the PID file to be written
      await new Promise((resolve) => setTimeout(resolve, 500));

      const pid = await readPid(projectRoot);
      if (!pid) {
        throw new Error("Failed to get PID of background process");
      }

      // Display success message
      console.error("");
      console.error(
        `${green("✓")} ${bold("MCP server started in background")} ${dim("│")} ${gray(`PID ${pid}`)
        }`,
      );
      console.error(`  ${dim("Project:")} ${cyan(projectRoot)}`);
      console.error(`  ${dim("Stop with:")} ${cyan("tsera mcp stop")}`);
      console.error("");
    } else {
      // Unix: use nohup or direct spawn with detached process
      const command = new Deno.Command(cliScript, {
        args: ["mcp"],
        cwd: projectRoot,
        stdin: "null",
        stdout: "null",
        stderr: "null",
        // Detach the process from the parent
      });

      const child = command.spawn();
      const pid = child.pid;

      // Write PID file
      await writePid(projectRoot, pid);

      // Display success message
      console.error("");
      console.error(
        `${green("✓")} ${bold("MCP server started in background")} ${dim("│")} ${gray(`PID ${pid}`)
        }`,
      );
      console.error(`  ${dim("Project:")} ${cyan(projectRoot)}`);
      console.error(`  ${dim("Stop with:")} ${cyan("tsera mcp stop")}`);
      console.error("");

      // Don't wait for the process
    }
  } catch (error) {
    console.error(
      `Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`,
    );
    await removePid(projectRoot);
    Deno.exit(1);
  }
}

/**
 * Creates the Cliffy `tsera mcp` command.
 * Starts a Model Context Protocol (MCP) server for AI agents.
 *
 * The MCP server communicates via JSON-RPC over stdio, providing
 * access to TSera project resources (graph, manifest, config).
 *
 * @returns Configured Cliffy command.
 */
export const mcpCommand = new Command()
  .description("Start the Model Context Protocol server for AI agents.")
  .option("-b, --background", "Start the server in the background.", { default: false })
  .action(async (options) => {
    const projectDir = Deno.cwd();
    const { background = false } = options;

    if (background) {
      await startMcpServerBackground(projectDir);
    } else {
      await startMcpServerForeground(projectDir);
    }
  })
  .command("stop")
  .description("Stop the MCP server running in the background.")
  .action(async () => {
    const projectDir = Deno.cwd();
    await stopMcpServer(projectDir);
  });

// Apply modern help rendering for main command
const originalShowHelp = mcpCommand.showHelp.bind(mcpCommand);
mcpCommand.showHelp = () => {
  try {
    console.log(
      renderCommandHelp({
        commandName: "mcp",
        description: "Start the Model Context Protocol server for AI agents.",
        usage: "<command>",
        commands: [
          {
            label: "stop",
            description: "Stop the MCP server running in the background",
          },
        ],
        options: [
          {
            label: "-b, --background",
            description: "Start the server in the background",
          },
          {
            label: "--json",
            description: "Output machine-readable NDJSON events",
          },
        ],
        examples: [
          "tsera mcp",
          "tsera mcp --background",
          "tsera mcp stop",
        ],
      }),
    );
  } catch {
    originalShowHelp();
  }
};

// Apply modern help rendering for stop subcommand
const stopCommand = mcpCommand.getCommand("stop");
if (stopCommand) {
  const originalStopShowHelp = stopCommand.showHelp.bind(stopCommand);
  stopCommand.showHelp = () => {
    try {
      console.log(
        renderCommandHelp({
          commandName: "mcp stop",
          description: "Stop the MCP server running in the background.",
          options: [
            {
              label: "--json",
              description: "Output machine-readable NDJSON events",
            },
          ],
          examples: [
            "tsera mcp stop",
          ],
        }),
      );
    } catch {
      originalStopShowHelp();
    }
  };
}

/**
 * Handles a JSON-RPC request from the MCP client.
 *
 * @param request - The JSON-RPC request object.
 * @param projectDir - The project directory path.
 */
async function handleRequest(request: JsonRpcRequest, projectDir: string): Promise<void> {
  const { id, method, params } = request;

  try {
    let result;
    switch (method) {
      case "initialize":
        result = {
          protocolVersion: "0.1.0",
          serverInfo: {
            name: "tsera-mcp",
            version: "0.0.1",
          },
          capabilities: {
            resources: {},
            tools: {},
          },
        };
        break;
      case "resources/list":
        result = await listResources();
        break;
      case "resources/read": {
        const uri = typeof params?.uri === "string" ? params.uri : undefined;
        if (!uri) {
          throw new Error("Missing required parameter: uri");
        }
        result = await readResource(projectDir, uri);
        break;
      }
      default:
        throw new Error(`Method not found: ${method}`);
    }

    const response = {
      jsonrpc: "2.0",
      id,
      result,
    };
    console.log(JSON.stringify(response));
  } catch (error) {
    const response = {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error),
      },
    };
    console.log(JSON.stringify(response));
  }
}

/**
 * Lists available MCP resources.
 *
 * @returns Array of resource definitions.
 */
function listResources(): Array<{
  uri: string;
  name: string;
  mimeType: string;
}> {
  // We don't need state here for just listing static resource definitions
  return [
    {
      uri: "tsera://graph",
      name: "Dependency Graph",
      mimeType: "application/json",
    },
    {
      uri: "tsera://manifest",
      name: "Project Manifest",
      mimeType: "application/json",
    },
    {
      uri: "tsera://config",
      name: "Project Configuration",
      mimeType: "application/json",
    },
  ];
}

/**
 * Reads a specific MCP resource by URI.
 *
 * @param projectDir - The project directory path.
 * @param uri - The resource URI (e.g., "tsera://graph", "tsera://manifest").
 * @returns Resource content with text and metadata.
 * @throws Error if the resource is not found.
 */
async function readResource(projectDir: string, uri: string) {
  if (uri === "tsera://graph") {
    // TODO: Load actual graph
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({ nodes: [], edges: [] }),
        },
      ],
    };
  }

  if (uri === "tsera://manifest") {
    const state = await readEngineState(projectDir);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(state),
        },
      ],
    };
  }

  throw new Error(`Resource not found: ${uri}`);
}
