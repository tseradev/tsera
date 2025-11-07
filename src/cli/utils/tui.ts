import type { Logger } from "./log.ts";

/**
 * Message describing a single execution step.
 */
export interface StepMessage {
  /** Step identifier. */
  id: string;
  /** Type of artifact. */
  kind: string;
  /** Action to perform. */
  action: "create" | "update" | "delete" | "noop";
  /** Target file path (if applicable). */
  target?: string;
}

/**
 * Message describing plan summary statistics.
 */
export interface PlanSummaryMessage {
  /** Number of artifacts to create. */
  create: number;
  /** Number of artifacts to update. */
  update: number;
  /** Number of artifacts to delete. */
  delete: number;
  /** Number of unchanged artifacts. */
  noop: number;
}

/**
 * Terminal UI interface for displaying execution progress.
 */
export interface Tui {
  /** Displays a step message. */
  step(message: StepMessage): void;
  /** Displays a plan summary message. */
  summary(message: PlanSummaryMessage): void;
}

/**
 * Creates a TUI instance that logs messages via a logger.
 *
 * @param logger - Logger instance to use for output.
 * @returns TUI instance.
 */
export function createTui(logger: Logger): Tui {
  return {
    step: (message) => {
      const { id, action, kind, target } = message;
      logger.info(`step:${action}`, { id, kind, target });
    },
    summary: (message) => {
      logger.info("plan:summary", { ...message });
    },
  };
}
