import type { Dag } from "./dag.ts";
import type { DagNode, DagNodeKind } from "./dag.ts";
import type { EngineState, SnapshotRecord } from "./state.ts";

export type PlanStepKind = "create" | "update" | "delete" | "noop";

export interface PlanStep {
  kind: PlanStepKind;
  node: DagNode;
  previous?: SnapshotRecord;
}

export interface PlanSummary {
  create: number;
  update: number;
  delete: number;
  noop: number;
  total: number;
  changed: boolean;
}

export interface PlanResult {
  steps: PlanStep[];
  summary: PlanSummary;
}

export interface PlannerOptions {
  includeUnchanged?: boolean;
}

const OUTPUT_KINDS: ReadonlySet<DagNodeKind> = new Set([
  "schema",
  "openapi",
  "migration",
  "test",
  "doc",
]);

export function planDag(
  dag: Dag,
  state: EngineState,
  options: PlannerOptions = {},
): PlanResult {
  const includeUnchanged = options.includeUnchanged ?? false;
  const steps: PlanStep[] = [];
  const seen = new Set<string>();

  for (const node of dag.order) {
    if (!OUTPUT_KINDS.has(node.kind)) {
      continue;
    }

    const previous = state.snapshots[node.id];
    seen.add(node.id);

    if (!previous) {
      steps.push({ kind: "create", node });
      continue;
    }

    if (previous.hash !== node.hash) {
      steps.push({ kind: "update", node, previous });
      continue;
    }

    if (includeUnchanged) {
      steps.push({ kind: "noop", node, previous });
    }
  }

  for (const [id, snapshot] of Object.entries(state.snapshots)) {
    if (seen.has(id)) {
      continue;
    }
    if (!OUTPUT_KINDS.has(snapshot.kind)) {
      continue;
    }
    steps.push({
      kind: "delete",
      node: { ...snapshot } as DagNode,
      previous: snapshot,
    });
  }

  steps.sort(compareSteps);
  const summary = buildSummary(steps);

  return { steps, summary };
}

function compareSteps(a: PlanStep, b: PlanStep): number {
  const pathA = a.node.targetPath ?? a.node.sourcePath ?? a.node.id;
  const pathB = b.node.targetPath ?? b.node.sourcePath ?? b.node.id;
  return pathA.localeCompare(pathB);
}

function buildSummary(steps: PlanStep[]): PlanSummary {
  let create = 0;
  let update = 0;
  let del = 0;
  let noop = 0;

  for (const step of steps) {
    switch (step.kind) {
      case "create":
        create++;
        break;
      case "update":
        update++;
        break;
      case "delete":
        del++;
        break;
      case "noop":
        noop++;
        break;
      default:
        assertUnreachable(step.kind);
    }
  }

  const total = steps.length;
  const changed = create + update + del > 0;

  return { create, update, delete: del, noop, total, changed };
}

function assertUnreachable(_value: never): never {
  throw new Error("Unhandled plan step kind");
}
