import type { Dag } from "./dag.ts";
import type { DagNode, DagNodeKind } from "./dag.ts";
import type { EngineState, SnapshotRecord } from "./state.ts";

/**
 * Types of plan steps that can be executed.
 */
export type PlanStepKind = "create" | "update" | "delete" | "noop";

/**
 * Represents a single step in the execution plan.
 */
export type PlanStep = {
  /** Type of operation to perform. */
  kind: PlanStepKind;
  /** Node to operate on. */
  node: DagNode;
  /** Previous snapshot record (for update/delete operations). */
  previous?: SnapshotRecord;
};

/**
 * Summary statistics of the execution plan.
 */
export type PlanSummary = {
  /** Number of artifacts to create. */
  create: number;
  /** Number of artifacts to update. */
  update: number;
  /** Number of artifacts to delete. */
  delete: number;
  /** Number of unchanged artifacts. */
  noop: number;
  /** Total number of steps. */
  total: number;
  /** Whether any changes are required. */
  changed: boolean;
};

/**
 * Complete execution plan with steps and summary.
 */
export type PlanResult = {
  /** Array of steps to execute. */
  steps: PlanStep[];
  /** Summary statistics. */
  summary: PlanSummary;
};

/**
 * Options for plan generation.
 */
export type PlannerOptions = {
  /** Whether to include unchanged artifacts in the plan. */
  includeUnchanged?: boolean;
};

const OUTPUT_KINDS: ReadonlySet<DagNodeKind> = new Set([
  "schema",
  "openapi",
  "migration",
  "test",
  "doc",
  "drizzle-schema",
]);

/**
 * Generates an execution plan by comparing the current DAG with the previous engine state.
 *
 * @param dag - Current dependency graph.
 * @param state - Previous engine state with snapshots.
 * @param options - Planning options.
 * @returns Execution plan with steps and summary.
 */
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

/**
 * Compares two plan steps for sorting purposes.
 *
 * @param a - First plan step.
 * @param b - Second plan step.
 * @returns Comparison result for sorting.
 */
function compareSteps(a: PlanStep, b: PlanStep): number {
  const pathA = a.node.targetPath ?? a.node.sourcePath ?? a.node.id;
  const pathB = b.node.targetPath ?? b.node.sourcePath ?? b.node.id;
  return pathA.localeCompare(pathB);
}

/**
 * Builds a summary from an array of plan steps.
 *
 * @param steps - Array of plan steps.
 * @returns Summary statistics.
 */
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

/**
 * Type guard that throws an error if reached (for exhaustive checks).
 *
 * @param _value - Value that should never be reached.
 * @throws {Error} Always throws when called.
 */
function assertUnreachable(_value: never): never {
  throw new Error("Unhandled plan step kind");
}
