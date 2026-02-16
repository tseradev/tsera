/**
 * Hono application entry point.
 *
 * This module initializes a Hono web server with:
 * - Health check routes (with database connectivity verification)
 * - Slogan API routes
 * - Graceful shutdown handling
 * - Environment validation at startup
 * - Database seed execution in development mode
 *
 * @module
 */

import { Hono } from "hono";
import { initDb } from "../db/connect.ts";
import { seedSlogans } from "../db/seeds/slogans.seed.ts";
import registerHealthRoutes from "./routes/health.ts";
import registerSloganRoutes from "./routes/slogans.ts";

// ============================================================================
// Types
// ============================================================================

type TseraEnvAccessor = {
  env: (key: string) => unknown;
};

type ServerState = {
  isShuttingDown: boolean;
  abortController?: AbortController;
};

// ============================================================================
// Environment Resolution
// ============================================================================

/**
 * Resolve the TSera runtime env accessor if the secrets module is enabled.
 */
function resolveTseraEnv(): TseraEnvAccessor | undefined {
  const globalValue: unknown = globalThis;
  if (!isRecord(globalValue)) {
    return undefined;
  }
  const tsera = globalValue["tsera"];
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

  // Validate DATABASE_PROVIDER
  const provider = readEnvString(tseraEnv?.env("DATABASE_PROVIDER")) ??
    Deno.env.get("DATABASE_PROVIDER");

  if (provider !== "sqlite") {
    throw new Error(
      `DATABASE_PROVIDER must be "sqlite". Got: ${provider ?? "undefined"}`,
    );
  }

  // Validate DATABASE_URL
  const databaseUrl = readEnvString(tseraEnv?.env("DATABASE_URL")) ??
    Deno.env.get("DATABASE_URL");

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Set it in your environment or config/secret/.env.* file.",
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
  const serverState: ServerState = {
    isShuttingDown: false,
  };

  // Setup graceful shutdown
  setupGracefulShutdown(serverState);

  // Validate environment at startup
  validateEnvironment();

  // Determine if we should run seeds (development mode)
  const tseraEnv = resolveTseraEnv();
  const envValue = readEnvString(tseraEnv?.env("DENO_ENV")) ??
    Deno.env.get("DENO_ENV");
  const isDevelopment = envValue !== "production";

  // Initialize database and optionally run seeds
  await initializeDatabase(isDevelopment);

  // Get port from environment or use default
  const tseraPort = tseraEnv ? tseraEnv.env("PORT") : undefined;
  const envPort = Deno.env.get("PORT");
  const port = readPort(tseraPort) ?? readPort(envPort) ?? 3001;

  // Create abort controller for graceful shutdown
  serverState.abortController = new AbortController();

  console.log(`\n🚀 Server starting on http://localhost:${port}`);
  console.log(`   Environment: ${isDevelopment ? "development" : "production"}`);
  console.log(`   API endpoints:`);
  console.log(`   - GET /api/v1/health - Health check`);
  console.log(`   - GET /api/v1/slogans - List all slogans`);

  Deno.serve({
    port,
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
