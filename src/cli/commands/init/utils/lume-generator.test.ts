/**
 * Tests for Lume project generator.
 *
 * These tests verify that the Lume project generator correctly
 * creates the expected directory structure and files.
 */

import { join } from "../../../../shared/path.ts";
import { assertEquals, assert } from "std/assert";
import { generateLumeProject } from "./lume-generator.ts";

Deno.test("lume-generator generates expected structure", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const targetDir = join(tempDir, "front");
    const createdFiles = await generateLumeProject({
      targetDir,
      force: true,
    });

    // Verify that files were created
    assert(createdFiles.length > 0, "Should create at least some files");

    // Verify key Lume files exist
    const configPath = join(targetDir, "_config.ts");
    const srcDir = join(targetDir, "src");
    const includesDir = join(targetDir, "_includes");
    const assetsDir = join(targetDir, "assets");
    const denoConfigPath = join(targetDir, "deno.jsonc");
    const readmePath = join(targetDir, "README.md");

    // Check that directories exist
    await Deno.stat(srcDir);
    await Deno.stat(includesDir);
    await Deno.stat(assetsDir);

    // Check that key files exist
    await Deno.stat(configPath);
    await Deno.stat(denoConfigPath);
    await Deno.stat(readmePath);

    // Verify README content mentions Lume
    const readmeContent = await Deno.readTextFile(readmePath);
    assert(readmeContent.includes("Lume"), "README should mention Lume");
    assert(readmeContent.includes("TSera"), "README should mention TSera");

    // Verify deno.jsonc is valid JSON
    const denoConfig = JSON.parse(await Deno.readTextFile(denoConfigPath));
    assert(denoConfig !== null, "deno.jsonc should be valid JSON");

    // Verify _config.ts exists and has expected content
    const configContent = await Deno.readTextFile(configPath);
    assert(configContent.length > 0, "_config.ts should have content");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("lume-generator skips files on non-force", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const targetDir = join(tempDir, "front");

    // First generation
    const firstFiles = await generateLumeProject({
      targetDir,
      force: true,
    });

    // Second generation without force
    const secondFiles = await generateLumeProject({
      targetDir,
      force: false,
    });

    // Second generation should not create any new files
    assertEquals(
      secondFiles.length,
      0,
      "Non-force generation should not overwrite existing files",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("lume-generator overwrites files with force", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const targetDir = join(tempDir, "front");

    // First generation
    await generateLumeProject({
      targetDir,
      force: true,
    });

    // Modify a file
    const readmePath = join(targetDir, "README.md");
    await Deno.writeTextFile(readmePath, "MODIFIED CONTENT");

    // Second generation with force
    const secondFiles = await generateLumeProject({
      targetDir,
      force: true,
    });

    // File should be overwritten
    const readmeContent = await Deno.readTextFile(readmePath);
    assert(
      !readmeContent.includes("MODIFIED CONTENT"),
      "Force generation should overwrite existing files",
    );
    assert(
      readmeContent.includes("Lume"),
      "README should contain Lume content after overwrite",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("lume-generator returns list of created files", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const targetDir = join(tempDir, "front");
    const createdFiles = await generateLumeProject({
      targetDir,
      force: true,
    });

    // Verify that all returned files exist
    for (const file of createdFiles) {
      const filePath = join(targetDir, file);
      await Deno.stat(filePath);
    }

    // Verify that key files are in the list
    assert(
      createdFiles.includes("README.md"),
      "README.md should be in created files list",
    );
    assert(
      createdFiles.includes("deno.jsonc"),
      "deno.jsonc should be in created files list",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
