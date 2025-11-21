import { Command } from "cliffy/command";
import { resolveConfig } from "../../utils/resolve-config.ts";
import { readEngineState } from "../../engine/state.ts";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export const mcpCommand = new Command()
  .description("Start the Model Context Protocol server for AI agents.")
  .action(async () => {
    const projectDir = Deno.cwd();
    const config = await resolveConfig(projectDir);

    if (!config) {
      console.error("No TSera project found (missing tsera.json or deno.json).");
      Deno.exit(1);
    }

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
  });

async function handleRequest(request: JsonRpcRequest, projectDir: string) {
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
      case "resources/read":
        // @ts-ignore: params is unknown
        result = await readResource(projectDir, params?.uri as string);
        break;
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

function listResources() {
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
