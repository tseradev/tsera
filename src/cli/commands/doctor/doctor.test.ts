import { join } from "../../../shared/path.ts";
import { createDefaultInitHandler } from "../init/init.ts";
import { createDefaultDoctorHandler } from "./doctor.ts";
import { assertEquals } from "../../../testing/asserts.ts";

const NOOP_WRITER = () => {};

function createExitCollector() {
  const codes: number[] = [];
  const exit = (code: number): never => {
    codes.push(code);
    throw new Error(`exit:${code}`);
  };
  return { codes, exit };
}

async function updateImportMapForTests(projectDir: string): Promise<void> {
  const importMapPath = join(projectDir, "import_map.json");
  const importMap = JSON.parse(await Deno.readTextFile(importMapPath));
  const srcPath = join(Deno.cwd(), "src");
  const normalizedSrcPath = srcPath.replace(/\\/g, "/");
  importMap.imports["tsera/"] = `file://${normalizedSrcPath}/`;
  importMap.imports["tsera/core/"] = `file://${normalizedSrcPath}/core/`;
  importMap.imports["tsera/cli/"] = `file://${normalizedSrcPath}/cli/`;
  await Deno.writeTextFile(importMapPath, JSON.stringify(importMap, null, 2));
}

Deno.test("doctor reports a pending plan with exit code", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const projectDir = join(tempDir, "doctor-app");
    const init = createDefaultInitHandler({ cliVersion: "test", writer: NOOP_WRITER });
    await init({
      directory: projectDir,
      template: "base",
      force: false,
      yes: true,
      global: { json: false },
      modules: {
        hono: true,
        fresh: true,
        docker: true,
        ci: true,
        secrets: true,
      },
    });

    await updateImportMapForTests(projectDir);

    const entityPath = join(projectDir, "domain", "User.entity.ts");
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
      await doctor({ cwd: projectDir, fix: false, global: { json: false, strict: false } });
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

Deno.test("doctor --fix applies changes and leaves a clean state", async () => {
  const tempDir = await Deno.makeTempDir({ dir: Deno.cwd() });
  try {
    const projectDir = join(tempDir, "doctor-fix");
    const init = createDefaultInitHandler({ cliVersion: "test", writer: NOOP_WRITER });
    await init({
      directory: projectDir,
      template: "base",
      force: false,
      yes: true,
      global: { json: false },
      modules: {
        hono: true,
        fresh: true,
        docker: true,
        ci: true,
        secrets: true,
      },
    });

    await updateImportMapForTests(projectDir);

    const entityPath = join(projectDir, "domain", "User.entity.ts");
    const original = await Deno.readTextFile(entityPath);
    await Deno.writeTextFile(entityPath, `${original}\n// mutation`);

    const doctor = createDefaultDoctorHandler({
      cliVersion: "test",
      writer: NOOP_WRITER,
      exit: (_code) => {
        throw new Error("unexpected-exit");
      },
    });

    await doctor({ cwd: projectDir, fix: true, global: { json: false, strict: false } });

    const collector = createExitCollector();
    const check = createDefaultDoctorHandler({
      cliVersion: "test",
      writer: NOOP_WRITER,
      exit: collector.exit,
    });

    await check({ cwd: projectDir, fix: false, global: { json: false, strict: false } });
    assertEquals(collector.codes.length, 0);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
