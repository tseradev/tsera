/**
 * Hono application entry point.
 *
 * This module initializes a Hono web server with:
 * - Health check routes (with database connectivity verification)
 * - Slogan API routes
 * - Graceful shutdown handling
 * - Environment validation at startup
 * - Database seed execution in development mode
 * - Configuration loaded from tsera.config.ts
 *
 * @module
 */

import { Hono } from "hono";
import tseraConfig from "../../config/tsera.config.ts";
import { initDb } from "../db/connect.ts";
import { seedSlogans } from "../db/seeds/slogans.seed.ts";
import registerHealthRoutes from "./routes/health.ts";
import registerSloganRoutes from "./routes/slogans.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * TSera environment accessor interface.
 * Provides type-safe access to environment variables via TSera.env().
 */
type TseraEnvAccessor = {
  env: (key: string) => unknown;
};

/**
 * Extend globalThis to include TSera runtime.
 * This declaration allows TypeScript to recognize globalThis.TSera.
 */
declare global {
  var TSera: TseraEnvAccessor | undefined;
}

type ServerState = {
  isShuttingDown: boolean;
  abortController?: AbortController;
};

// ============================================================================
// Configuration Resolution
// ============================================================================

/**
 * Get backend configuration from tsera.config.ts with defaults.
 */
function getBackConfig() {
  const back = tseraConfig.back;
  return {
    port: back?.port ?? 3001,
    host: back?.host ?? "localhost",
    apiPrefix: back?.apiPrefix ?? "/api/v1",
  };
}

// ============================================================================
// Environment Resolution
// ============================================================================

/**
 * Initialize TSera environment from serialized values passed by parent process.
 *
 * When running via `tsera dev`, the CLI serializes validated environment values
 * and passes them via TSERA_ENV_VALUES environment variable. This allows child
 * processes to access TSera.env without re-running bootstrapEnv().
 */
function initializeTseraEnv(): void {
  // Skip if already initialized
  if (globalThis.TSera !== undefined) {
    return;
  }

  const serialized = Deno.env.get("TSERA_ENV_VALUES");
  if (!serialized) {
    console.error(
      "ERROR: TSERA_ENV_VALUES not found. The backend must be started via 'tsera dev'.",
    );
    Deno.exit(1);
  }

  try {
    const values = JSON.parse(serialized) as Record<string, unknown>;
    globalThis.TSera = {
      env: (key: string): unknown => values[key],
    };
  } catch (error) {
    console.error(
      `ERROR: Failed to parse TSERA_ENV_VALUES: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    Deno.exit(1);
  }
}

/**
 * Resolve the TSera runtime env accessor if the secrets module is enabled.
 */
function resolveTseraEnv(): TseraEnvAccessor | undefined {
  const globalValue: unknown = globalThis;
  if (!isRecord(globalValue)) {
    return undefined;
  }
  const tsera = globalValue["TSera"];
  if (!isTseraEnvAccessor(tsera)) {
    return undefined;
  }
  return tsera;
}

/**
 * Read a string value from environment.
 */
function readEnvString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Read a number value from environment.
 */
function readPort(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

// ============================================================================
// Environment Validation
// ============================================================================

/**
 * Validate required environment variables at startup.
 * Throws an error if validation fails.
 */
function validateEnvironment(): void {
  const tseraEnv = resolveTseraEnv();

  if (!tseraEnv) {
    throw new Error(
      "TSera environment not initialized. The backend must be started via 'tsera dev'.",
    );
  }

  // Validate DATABASE_PROVIDER
  const provider = readEnvString(tseraEnv.env("DATABASE_PROVIDER"));

  if (provider !== "sqlite") {
    throw new Error(
      `DATABASE_PROVIDER must be "sqlite". Got: ${provider ?? "undefined"}`,
    );
  }

  // Validate DATABASE_URL
  const databaseUrl = readEnvString(tseraEnv.env("DATABASE_URL"));

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Set it in config/secrets/.env.* file.",
    );
  }

  if (!databaseUrl.startsWith("file:")) {
    throw new Error(
      `DATABASE_URL must start with "file:" for SQLite. Got: ${databaseUrl}`,
    );
  }

  console.log("✓ Environment validation passed");
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

/**
 * Setup graceful shutdown handlers.
 * Note: Windows only supports SIGINT, SIGBREAK, and SIGUP (ctrl-close).
 * SIGTERM is only available on Unix-like systems.
 */
function setupGracefulShutdown(state: ServerState): void {
  const shutdown = async (signal: string) => {
    if (state.isShuttingDown) {
      console.log(`Already shutting down, ignoring ${signal}`);
      return;
    }

    state.isShuttingDown = true;
    console.log(`\n${signal} received, initiating graceful shutdown...`);

    // Abort any pending requests
    if (state.abortController) {
      state.abortController.abort();
    }

    // Give pending operations time to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("Graceful shutdown complete");
    Deno.exit(0);
  };

  // SIGINT (Ctrl+C) is supported on all platforms
  Deno.addSignalListener("SIGINT", () => shutdown("SIGINT"));

  // SIGTERM is only supported on Unix-like systems (not Windows)
  if (Deno.build.os !== "windows") {
    Deno.addSignalListener("SIGTERM", () => shutdown("SIGTERM"));
  }
}

// ============================================================================
// Application Initialization
// ============================================================================

/**
 * Initialize the database and run seeds if needed.
 */
async function initializeDatabase(runSeed: boolean): Promise<void> {
  console.log("Initializing database connection...");
  await initDb();
  console.log("✓ Database initialized");

  if (runSeed) {
    console.log("Running database seeds...");
    await seedSlogans();
    console.log("✓ Seeds completed");
  }
}

/**
 * Create and configure the Hono application.
 */
function createApp(): Hono {
  const app = new Hono();

  // Register routes
  registerHealthRoutes(app);
  registerSloganRoutes(app);

  return app;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Hono application instance with registered routes.
 */
export const app = createApp();

// Start server when run directly
if (import.meta.main) {
  // Initialize TSera environment from parent process (if available)
  // This MUST be called before any other code that uses TSera.env
  initializeTseraEnv();

  const serverState: ServerState = {
    isShuttingDown: false,
  };

  // Setup graceful shutdown
  setupGracefulShutdown(serverState);

  // Validate environment at startup
  validateEnvironment();

  // Determine if we should run seeds (development mode)
  const tseraEnv = resolveTseraEnv();
  if (!tseraEnv) {
    throw new Error(
      "TSera environment not initialized. The backend must be started via 'tsera dev'.",
    );
  }
  const envValue = readEnvString(tseraEnv.env("DENO_ENV"));
  const isDevelopment = envValue !== "production";

  // Initialize database and optionally run seeds
  await initializeDatabase(isDevelopment);

  // Get configuration from tsera.config.ts
  const backConfig = getBackConfig();

  // Get port from TSera environment
  const port = readPort(tseraEnv.env("PORT")) ?? backConfig.port;

  // Create abort controller for graceful shutdown
  serverState.abortController = new AbortController();

  console.log(`\n🚀 Server starting on http://${backConfig.host}:${port}`);
  console.log(
    `   Environment: ${isDevelopment ? "development" : "production"}`,
  );
  console.log(`   API endpoints:`);
  console.log(`   - GET ${backConfig.apiPrefix}/health - Health check`);
  console.log(`   - GET ${backConfig.apiPrefix}/slogans - List all slogans`);

  Deno.serve({
    port,
    hostname: backConfig.host,
    signal: serverState.abortController.signal,
    onListen: () => {
      console.log(`\n✓ Server ready and listening`);
    },
  }, app.fetch);
}

// ============================================================================
// Helper Functions
// ============================================================================

function isTseraEnvAccessor(value: unknown): value is TseraEnvAccessor {
  return isRecord(value) && typeof value["env"] === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
