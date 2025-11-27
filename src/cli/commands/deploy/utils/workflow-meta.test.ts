import { assertEquals } from "std/assert";
import { join } from "../../../../shared/path.ts";
import { ensureDir } from "../../../utils/fsx.ts";
import {
  readWorkflowsMeta,
  writeWorkflowsMeta,
  updateWorkflowHash,
  removeWorkflowFromMeta,
} from "./workflow-meta.ts";

Deno.test("workflow-meta: reads empty meta when file doesn't exist", async () => {
  const testDir = await Deno.makeTempDir({ prefix: "tsera-meta-test-" });
  try {
    const meta = await readWorkflowsMeta(testDir);
    assertEquals(meta, {});
  } finally {
    await Deno.remove(testDir, { recursive: true }).catch(() => {});
  }
});

Deno.test("workflow-meta: writes and reads meta", async () => {
  const testDir = await Deno.makeTempDir({ prefix: "tsera-meta-test-" });
  try {
    const testMeta = {
      ".github/workflows/cd-docker-prod.yml": "sha256-abc123",
      ".github/workflows/cd-cloudflare-staging.yml": "sha256-def456",
    };

    await writeWorkflowsMeta(testDir, testMeta);
    const readMeta = await readWorkflowsMeta(testDir);

    assertEquals(readMeta, testMeta);
  } finally {
    await Deno.remove(testDir, { recursive: true }).catch(() => {});
  }
});

Deno.test("workflow-meta: updates workflow hash", async () => {
  const testDir = await Deno.makeTempDir({ prefix: "tsera-meta-test-" });
  try {
    const tseraDir = join(testDir, ".tsera");
    await ensureDir(tseraDir);

    await updateWorkflowHash(
      testDir,
      ".github/workflows/cd-docker-prod.yml",
      "sha256-newhash",
    );

    const meta = await readWorkflowsMeta(testDir);
    assertEquals(meta[".github/workflows/cd-docker-prod.yml"], "sha256-newhash");
  } finally {
    await Deno.remove(testDir, { recursive: true }).catch(() => {});
  }
});

Deno.test("workflow-meta: removes workflow from meta", async () => {
  const testDir = await Deno.makeTempDir({ prefix: "tsera-meta-test-" });
  try {
    const tseraDir = join(testDir, ".tsera");
    await ensureDir(tseraDir);

    // First add a workflow
    await updateWorkflowHash(
      testDir,
      ".github/workflows/cd-docker-prod.yml",
      "sha256-abc123",
    );

    // Then remove it
    await removeWorkflowFromMeta(testDir, ".github/workflows/cd-docker-prod.yml");

    const meta = await readWorkflowsMeta(testDir);
    assertEquals(meta[".github/workflows/cd-docker-prod.yml"], undefined);
  } finally {
    await Deno.remove(testDir, { recursive: true }).catch(() => {});
  }
});

