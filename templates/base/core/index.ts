/**
 * Core module - Central exports for entities, types, validation, and utilities.
 * @module
 */

// Re-export all utilities from @tsera/core (defineEntity, getDatabaseCredentials, etc.)
export * from "@tsera/core";

// Export all local entities
export * from "./entities/User.ts";
