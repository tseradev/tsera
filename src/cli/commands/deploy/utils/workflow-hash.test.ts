import { assertEquals } from "std/assert";
import { computeFileHash, computeWorkflowHash } from "./workflow-hash.ts";
import { join } from "../../../../shared/path.ts";

Deno.test("workflow-hash: computes consistent hash for same content", async () => {
  const content = "name: Test Workflow\non:\n  push:\n    branches: [main]";
  const hash1 = await computeWorkflowHash(content);
  const hash2 = await computeWorkflowHash(content);
  assertEquals(hash1, hash2);
  assertEquals(hash1.startsWith("sha256-"), true);
});

Deno.test("workflow-hash: normalizes line endings", async () => {
  const content1 = "name: Test\r\non:\r\n  push:";
  const content2 = "name: Test\non:\n  push:";
  const hash1 = await computeWorkflowHash(content1);
  const hash2 = await computeWorkflowHash(content2);
  assertEquals(hash1, hash2);
});

Deno.test("workflow-hash: trims trailing whitespace", async () => {
  const content1 = "name: Test  \non:  \n  push:  ";
  const content2 = "name: Test\non:\n  push:";
  const hash1 = await computeWorkflowHash(content1);
  const hash2 = await computeWorkflowHash(content2);
  assertEquals(hash1, hash2);
});

Deno.test("workflow-hash: computes hash from file", async () => {
  const testDir = await Deno.makeTempDir({ prefix: "tsera-hash-test-" });
  try {
    const filePath = join(testDir, "workflow.yml");
    const content = "name: Test Workflow\non:\n  push:";
    await Deno.writeTextFile(filePath, content);

    const fileHash = await computeFileHash(filePath);
    const contentHash = await computeWorkflowHash(content);

    assertEquals(fileHash, contentHash);
  } finally {
    await Deno.remove(testDir, { recursive: true }).catch(() => {});
  }
});
