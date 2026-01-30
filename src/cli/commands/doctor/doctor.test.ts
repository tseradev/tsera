import { join, resolve } from "../../../shared/path.ts";
import { createDefaultInitHandler } from "../init/init.ts";
import { createDefaultDoctorHandler } from "./doctor.ts";
import { assertEquals } from "std/assert";

const NOOP_WRITER = (): void => {};

function createExitCollector(): {
  codes: number[];
  exit: (code: number) => never;
} {
  const codes: number[] = [];
  const exit = (code: number): never => {
    codes.push(code);
    throw new Error(`exit:${code}`);
  };
  return { codes, exit };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

async function updateImportMapForTests(projectDir: string): Promise<void> {
  // Use resolve to get absolute path, matching patchImportMapForEnvironment logic
  const srcPath = resolve(join(Deno.cwd(), "src"));
  const normalizedPath = srcPath.replace(/\\/g, "/");
  // Ensure path starts with / for Windows paths in file:// URLs
  const pathForUrl = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
  const fileUrl = `file://${pathForUrl}/`;

  // Check if import_map.json exists (non-Lume projects)
  const importMapPath = join(projectDir, "import_map.json");
  if (await fileExists(importMapPath)) {
    const importMap = JSON.parse(await Deno.readTextFile(importMapPath));
    if (!importMap.imports) {
      importMap.imports = {};
    }
    importMap.imports["tsera/"] = fileUrl;
    importMap.imports["tsera/core/"] = `${fileUrl}core/`;
    importMap.imports["tsera/cli/"] = `${fileUrl}cli/`;
    await Deno.writeTextFile(importMapPath, JSON.stringify(importMap, null, 2));
  } else {
    // Lume projects: imports are in deno.jsonc
    const denoConfigPath = join(projectDir, "deno.jsonc");
    if (await fileExists(denoConfigPath)) {
      const { parse } = await import("jsr:@std/jsonc@1");
      const denoConfig = parse(await Deno.readTextFile(denoConfigPath)) as {
        imports?: Record<string, string>;
      };
      if (!denoConfig.imports) {
        denoConfig.imports = {};
      }
      denoConfig.imports["tsera/"] = fileUrl;
      denoConfig.imports["tsera/core/"] = `${fileUrl}core/`;
      denoConfig.imports["tsera/cli/"] = `${fileUrl}cli/`;
      await Deno.writeTextFile(denoConfigPath, JSON.stringify(denoConfig, null, 2) + "\n");
    }
  }
}

Deno.test("doctor reports a pending plan with exit code", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const projectDir = join(tempDir, "doctor-app");
    const init = createDefaultInitHandler({ cliVersion: "test", writer: NOOP_WRITER });
    await init({
      directory: projectDir,
      force: false,
      yes: true,
      global: { json: false },
      modules: {
        hono: true,
        lume: true,
        docker: true,
        ci: true,
        secrets: true,
      },
    });

    await updateImportMapForTests(projectDir);

    const entityPath = join(projectDir, "core", "entities", "User.ts");
    const original = await Deno.readTextFile(entityPath);
    const updated = original.replace(
      "Optional display name.",
      "Optional display name (doctor test).",
    );
    await Deno.writeTextFile(entityPath, updated);

    const collector = createExitCollector();
    const doctor = createDefaultDoctorHandler({
      cliVersion: "test",
      writer: NOOP_WRITER,
      exit: collector.exit,
    });

    try {
      await doctor({
        cwd: projectDir,
        fix: false,
        quick: false,
        global: { json: false, strict: false },
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("exit:")) {
        throw error;
      }
    }

    assertEquals(collector.codes, [1]);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("doctor --quick exits with code 0 even when issues found", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const projectDir = join(tempDir, "doctor-quick");
    const init = createDefaultInitHandler({ cliVersion: "test", writer: NOOP_WRITER });
    await init({
      directory: projectDir,
      force: false,
      yes: true,
      global: { json: false },
      modules: {
        hono: true,
        lume: true,
        docker: true,
        ci: true,
        secrets: true,
      },
    });

    await updateImportMapForTests(projectDir);

    const entityPath = join(projectDir, "core", "entities", "User.ts");
    const original = await Deno.readTextFile(entityPath);
    const updated = original.replace(
      "Optional display name.",
      "Optional display name (doctor quick test).",
    );
    await Deno.writeTextFile(entityPath, updated);

    const collector = createExitCollector();
    const doctor = createDefaultDoctorHandler({
      cliVersion: "test",
      writer: NOOP_WRITER,
      exit: collector.exit,
    });

    try {
      await doctor({
        cwd: projectDir,
        fix: false,
        quick: true,
        global: { json: false, strict: false },
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("exit:")) {
        throw error;
      }
    }

    // In quick mode, should exit with code 0 even if issues found
    assertEquals(collector.codes, [0]);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("doctor --fix applies changes and leaves a clean state", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const projectDir = join(tempDir, "doctor-fix");
    const init = createDefaultInitHandler({ cliVersion: "test", writer: NOOP_WRITER });
    await init({
      directory: projectDir,
      force: false,
      yes: true,
      global: { json: false },
      modules: {
        hono: true,
        lume: true,
        docker: true,
        ci: true,
        secrets: true,
      },
    });

    await updateImportMapForTests(projectDir);

    const entityPath = join(projectDir, "core", "entities", "User.ts");
    const original = await Deno.readTextFile(entityPath);
    await Deno.writeTextFile(entityPath, `${original}\n// mutation`);

    const doctor = createDefaultDoctorHandler({
      cliVersion: "test",
      writer: NOOP_WRITER,
      exit: (_code) => {
        throw new Error("unexpected-exit");
      },
    });

    await doctor({
      cwd: projectDir,
      fix: true,
      quick: false,
      global: { json: false, strict: false },
    });

    const collector = createExitCollector();
    const check = createDefaultDoctorHandler({
      cliVersion: "test",
      writer: NOOP_WRITER,
      exit: collector.exit,
    });

    await check({
      cwd: projectDir,
      fix: false,
      quick: false,
      global: { json: false, strict: false },
    });
    assertEquals(collector.codes.length, 0);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
