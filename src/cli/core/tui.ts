import type { Logger } from "./log.ts";

export interface StepMessage {
  id: string;
  kind: string;
  action: "create" | "update" | "delete" | "noop";
  target?: string;
}

export interface PlanSummaryMessage {
  create: number;
  update: number;
  delete: number;
  noop: number;
}

export interface Tui {
  step(message: StepMessage): void;
  summary(message: PlanSummaryMessage): void;
}

export function createTui(logger: Logger): Tui {
  return {
    step: (message) => {
      const { id, action, kind, target } = message;
      logger.info(`step:${action}`, { id, kind, target });
    },
    summary: (message) => {
      logger.info("plan:summary", message as Record<string, unknown>);
    },
  };
}
