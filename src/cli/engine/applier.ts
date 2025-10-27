import { join } from "../../shared/path.ts";
import { removeFileIfExists, safeWrite } from "../core/fsx.ts";
import type { PlanResult, PlanStep } from "./planner.ts";
import type { EngineState } from "./state.ts";
import { applySnapshots } from "./state.ts";

export interface ApplyOptions {
  projectDir: string;
  onStep?: (step: PlanStep, result: ApplyStepResult) => void | Promise<void>;
}

export interface ApplyStepResult {
  kind: PlanStep["kind"];
  path?: string;
  changed: boolean;
}

export async function applyPlan(
  plan: PlanResult,
  state: EngineState,
  options: ApplyOptions,
): Promise<EngineState> {
  const updates: { node: PlanStep["node"]; action: "create" | "update" | "delete" }[] = [];

  for (const step of plan.steps) {
    switch (step.kind) {
      case "create":
      case "update":
        await handleWriteStep(step, options, updates);
        break;
      case "delete":
        await handleDeleteStep(step, options, updates);
        break;
      case "noop":
        if (options.onStep) {
          await options.onStep(step, {
            kind: step.kind,
            changed: false,
            path: step.node.targetPath,
          });
        }
        break;
      default:
        step satisfies never;
    }
  }

  return applySnapshots(state, updates);
}

async function handleWriteStep(
  step: Extract<PlanStep, { kind: "create" | "update" }>,
  options: ApplyOptions,
  updates: { node: PlanStep["node"]; action: "create" | "update" | "delete" }[],
): Promise<void> {
  const targetPath = step.node.targetPath;
  if (!targetPath) {
    throw new Error(`Impossible d'appliquer le step ${step.node.id} sans chemin de sortie.`);
  }
  const content = step.node.content;
  if (content === undefined) {
    throw new Error(`Le nœud ${step.node.id} ne possède pas de contenu à écrire.`);
  }

  const absolute = join(options.projectDir, targetPath);
  const result = await safeWrite(absolute, content);
  updates.push({ node: step.node, action: step.kind });

  if (options.onStep) {
    await options.onStep(step, { kind: step.kind, path: targetPath, changed: result.changed });
  }
}

async function handleDeleteStep(
  step: Extract<PlanStep, { kind: "delete" }>,
  options: ApplyOptions,
  updates: { node: PlanStep["node"]; action: "create" | "update" | "delete" }[],
): Promise<void> {
  const path = step.node.targetPath ?? step.previous?.targetPath;
  if (!path) {
    throw new Error(`Impossible de supprimer le nœud ${step.node.id} sans chemin associé.`);
  }

  const absolute = join(options.projectDir, path);
  await removeFileIfExists(absolute);
  updates.push({ node: step.node, action: "delete" });

  if (options.onStep) {
    await options.onStep(step, { kind: step.kind, path, changed: true });
  }
}
