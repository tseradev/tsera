import { join } from "../../../../shared/path.ts";
import { assertEquals, assertExists } from "std/assert";
import {
  extractDependencies,
  uncommentImportsInFile,
  uncommentImportsInDirectory,
  uncommentImportsInProject,
} from "./uncomment-imports.ts";

Deno.test("extractDependencies reads from import_map.json", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const importMapPath = join(tempDir, "import_map.json");
    await Deno.writeTextFile(
      importMapPath,
      JSON.stringify({
        imports: {
          "hono": "jsr:@hono/hono@^4.0.0",
          "preact": "npm:preact@^10.27.2",
        },
      }, null, 2),
    );

    const deps = await extractDependencies(tempDir);
    assertExists(deps);
    assertEquals(deps.declaredKeys.has("hono"), true);
    assertEquals(deps.declaredKeys.has("preact"), true);
    assertEquals(deps.specifierToKey.get("hono"), "hono");
    assertEquals(deps.specifierToKey.get("preact"), "preact");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("extractDependencies reads from deno.jsonc", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const denoConfigPath = join(tempDir, "deno.jsonc");
    await Deno.writeTextFile(
      denoConfigPath,
      JSON.stringify({
        imports: {
          "fresh": "jsr:@fresh/core@^2.1.4",
        },
      }, null, 2),
    );

    const deps = await extractDependencies(tempDir);
    assertExists(deps);
    assertEquals(deps.declaredKeys.has("fresh"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("extractDependencies merges import_map.json and deno.jsonc", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const importMapPath = join(tempDir, "import_map.json");
    await Deno.writeTextFile(
      importMapPath,
      JSON.stringify({
        imports: {
          "hono": "jsr:@hono/hono@^4.0.0",
        },
      }, null, 2),
    );

    const denoConfigPath = join(tempDir, "deno.jsonc");
    await Deno.writeTextFile(
      denoConfigPath,
      JSON.stringify({
        imports: {
          "fresh": "jsr:@fresh/core@^2.1.4",
        },
      }, null, 2),
    );

    const deps = await extractDependencies(tempDir);
    assertExists(deps);
    assertEquals(deps.declaredKeys.has("hono"), true);
    assertEquals(deps.declaredKeys.has("fresh"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("uncommentImportsInFile uncomments single-line imports", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    // Create import_map.json
    const importMapPath = join(tempDir, "import_map.json");
    await Deno.writeTextFile(
      importMapPath,
      JSON.stringify({
        imports: {
          "hono": "jsr:@hono/hono@^4.0.0",
        },
      }, null, 2),
    );

    // Create test file with commented import
    const testFile = join(tempDir, "test.ts");
    const originalContent = `// Install dependencies first: deno add jsr:@hono/hono@^4.0.0
// After installation, uncomment the import below:
// import { Hono } from "hono";

export const app = new Hono();
`;

    await Deno.writeTextFile(testFile, originalContent);

    const deps = await extractDependencies(tempDir);
    assertExists(deps);
    const changed = await uncommentImportsInFile(testFile, deps);

    assertEquals(changed, true);

    const newContent = await Deno.readTextFile(testFile);
    assertEquals(newContent.includes("import { Hono } from \"hono\";"), true);
    assertEquals(newContent.includes("// import { Hono }"), false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("uncommentImportsInFile does not uncomment if dependency not declared", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    // Create import_map.json without hono
    const importMapPath = join(tempDir, "import_map.json");
    await Deno.writeTextFile(
      importMapPath,
      JSON.stringify({
        imports: {
          "preact": "npm:preact@^10.27.2",
        },
      }, null, 2),
    );

    // Create test file with commented import
    const testFile = join(tempDir, "test.ts");
    const originalContent = `// import { Hono } from "hono";
`;

    await Deno.writeTextFile(testFile, originalContent);

    const deps = await extractDependencies(tempDir);
    assertExists(deps);
    const changed = await uncommentImportsInFile(testFile, deps);

    assertEquals(changed, false);

    const newContent = await Deno.readTextFile(testFile);
    assertEquals(newContent, originalContent);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("uncommentImportsInDirectory processes multiple files", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    // Create import_map.json
    const importMapPath = join(tempDir, "import_map.json");
    await Deno.writeTextFile(
      importMapPath,
      JSON.stringify({
        imports: {
          "hono": "jsr:@hono/hono@^4.0.0",
          "preact": "npm:preact@^10.27.2",
        },
      }, null, 2),
    );

    // Create test files
    const file1 = join(tempDir, "file1.ts");
    await Deno.writeTextFile(file1, "// import { Hono } from \"hono\";\n");

    const subDir = join(tempDir, "subdir");
    await Deno.mkdir(subDir);
    const file2 = join(subDir, "file2.ts");
    await Deno.writeTextFile(file2, "// import { h } from \"preact\";\n");

    const deps = await extractDependencies(tempDir);
    assertExists(deps);
    const modifiedCount = await uncommentImportsInDirectory(tempDir, deps);

    assertEquals(modifiedCount, 2);

    const content1 = await Deno.readTextFile(file1);
    assertEquals(content1.includes("import { Hono }"), true);

    const content2 = await Deno.readTextFile(file2);
    assertEquals(content2.includes("import { h }"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("uncommentImportsInProject is the main entry point", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    // Create import_map.json
    const importMapPath = join(tempDir, "import_map.json");
    await Deno.writeTextFile(
      importMapPath,
      JSON.stringify({
        imports: {
          "hono": "jsr:@hono/hono@^4.0.0",
        },
      }, null, 2),
    );

    // Create test file
    const testFile = join(tempDir, "test.ts");
    await Deno.writeTextFile(testFile, "// import { Hono } from \"hono\";\n");

    const modifiedCount = await uncommentImportsInProject(tempDir);

    assertEquals(modifiedCount, 1);

    const content = await Deno.readTextFile(testFile);
    assertEquals(content.includes("import { Hono }"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("uncommentImportsInProject returns 0 if no config files", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    // Create test file without import_map.json or deno.jsonc
    const testFile = join(tempDir, "test.ts");
    await Deno.writeTextFile(testFile, "// import { Hono } from \"hono\";\n");

    const modifiedCount = await uncommentImportsInProject(tempDir);

    assertEquals(modifiedCount, 0);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

