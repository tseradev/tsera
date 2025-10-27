/**
 * Planner skeleton comparing previous and next DAG hashes. This placeholder
 * keeps the contract without implementing diff logic yet.
 */

export type PlanStepAction = "create" | "update" | "delete" | "noop";

export interface PlanStep {
  id: string;
  action: PlanStepAction;
  summary: string;
}

export interface PlanResult {
  steps: PlanStep[];
  hash: string;
}

export function createEmptyPlan(hash: string): PlanResult {
  return { steps: [], hash };
}
