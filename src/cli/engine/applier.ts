/**
 * Placeholder applier that will later materialise planner steps.
 */

import type { PlanResult } from "./planner.ts";

export async function applyPlan(plan: PlanResult): Promise<void> {
  await Promise.resolve();
  for (const step of plan.steps) {
    console.log(`Exécution placeholder du step ${step.action} pour ${step.id}`);
  }
}
