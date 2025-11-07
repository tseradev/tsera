import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { join } from "../../shared/path.ts";
import { resolveConfig } from "./resolve-config.ts";
import type { TseraConfig } from "../definitions.ts";

async function withTempDir<T>(
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await Deno.makeTempDir();
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => { });
  }
}

function validPostgresConfig(): TseraConfig {
  return {
    openapi: true,
    docs: true,
    tests: true,
    telemetry: false,
    outDir: ".tsera",
    paths: {
      entities: ["domain/**/*.entity.ts"],
      routes: ["routes/**/*.ts"],
    },
    db: {
      dialect: "postgres",
      urlEnv: "DATABASE_URL",
      ssl: "prefer",
    },
    deploy: {
      target: "deno_deploy",
      entry: "main.ts",
      envFile: ".env",
    },
  };
}

function validMysqlConfig(): TseraConfig {
  return {
    openapi: true,
    docs: true,
    tests: true,
    telemetry: false,
    outDir: ".tsera",
    paths: {
      entities: ["domain/**/*.entity.ts"],
    },
    db: {
      dialect: "mysql",
      urlEnv: "DATABASE_URL",
      ssl: true,
    },
    deploy: {
      target: "cloudflare",
      entry: "main.ts",
    },
  };
}

function validSqliteConfig(): TseraConfig {
  return {
    openapi: false,
    docs: false,
    tests: false,
    telemetry: true,
    outDir: ".generated",
    paths: {
      entities: ["entities/*.ts"],
    },
    db: {
      dialect: "sqlite",
      file: "db.sqlite",
    },
    deploy: {
      target: "node_pm2",
      entry: "server.ts",
    },
  };
}

Deno.test("resolveConfig loads valid Postgres config", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config, null, 2)};`,
    );

    const result = await resolveConfig(dir);

    assertEquals(result.configPath, configPath);
    assertEquals(result.config.db.dialect, "postgres");
    assertEquals(result.config.db.urlEnv, "DATABASE_URL");
  });
});

Deno.test("resolveConfig loads valid MySQL config", async () => {
  await withTempDir(async (dir) => {
    const config = validMysqlConfig();
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config, null, 2)};`,
    );

    const result = await resolveConfig(dir);

    assertEquals(result.config.db.dialect, "mysql");
    assertEquals(result.config.db.ssl, true);
  });
});

Deno.test("resolveConfig loads valid SQLite config", async () => {
  await withTempDir(async (dir) => {
    const config = validSqliteConfig();
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config, null, 2)};`,
    );

    const result = await resolveConfig(dir);

    assertEquals(result.config.db.dialect, "sqlite");
    assertEquals(result.config.db.file, "db.sqlite");
  });
});

Deno.test("resolveConfig accepts export named config", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export const config = ${JSON.stringify(config, null, 2)};`,
    );

    const result = await resolveConfig(dir);

    assertEquals(result.config.db.dialect, "postgres");
  });
});

Deno.test("resolveConfig accepts export named CONFIG", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export const CONFIG = ${JSON.stringify(config, null, 2)};`,
    );

    const result = await resolveConfig(dir);

    assertEquals(result.config.db.dialect, "postgres");
  });
});

Deno.test("resolveConfig fails if no export", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(configPath, "const config = {};");

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "No configuration exported",
    );
  });
});

Deno.test("resolveConfig fails if openapi is not boolean", async () => {
  await withTempDir(async (dir) => {
    const config = { ...validPostgresConfig(), openapi: "true" };
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "openapi",
    );
  });
});

Deno.test("resolveConfig fails if docs is not boolean", async () => {
  await withTempDir(async (dir) => {
    const config = { ...validPostgresConfig(), docs: 1 };
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "docs",
    );
  });
});

Deno.test("resolveConfig fails if outDir is not string", async () => {
  await withTempDir(async (dir) => {
    const config = { ...validPostgresConfig(), outDir: 123 };
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "outDir",
    );
  });
});

Deno.test("resolveConfig fails if outDir is empty", async () => {
  await withTempDir(async (dir) => {
    const config = { ...validPostgresConfig(), outDir: "" };
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "outDir",
    );
  });
});

Deno.test("resolveConfig fails if paths entities is not array", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    config.paths.entities = "domain/**/*.entity.ts" as never;
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "paths.entities",
    );
  });
});

Deno.test("resolveConfig fails if paths entities is empty", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    config.paths.entities = [];
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "at least one entity path",
    );
  });
});

Deno.test("resolveConfig fails if paths entities contains empty string", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    config.paths.entities = ["domain/**/*.ts", ""];
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "paths.entities",
    );
  });
});

Deno.test("resolveConfig accepts optional paths routes", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    delete config.paths.routes;
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    const result = await resolveConfig(dir);

    assertEquals(result.config.paths.routes, undefined);
  });
});

Deno.test("resolveConfig fails if db dialect is invalid", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    config.db.dialect = "mongodb" as never;
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "Unsupported database dialect",
    );
  });
});

Deno.test("resolveConfig fails if Postgres without urlEnv", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    delete (config.db as { urlEnv?: string }).urlEnv;
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "db.urlEnv",
    );
  });
});

Deno.test("resolveConfig fails if Postgres with invalid ssl", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    config.db.ssl = "always" as never;
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "Invalid Postgres SSL mode",
    );
  });
});

Deno.test("resolveConfig fails if Postgres with file", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    (config.db as { file?: string }).file = "db.sqlite";
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "must not declare a file path",
    );
  });
});

Deno.test("resolveConfig fails if MySQL with ssl not boolean", async () => {
  await withTempDir(async (dir) => {
    const config = validMysqlConfig();
    config.db.ssl = "true" as never;
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "MySQL SSL configuration must be a boolean",
    );
  });
});

Deno.test("resolveConfig fails if SQLite without file", async () => {
  await withTempDir(async (dir) => {
    const config = validSqliteConfig();
    delete (config.db as { file?: string }).file;
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "SQLite configuration requires a non-empty file path",
    );
  });
});

Deno.test("resolveConfig fails if SQLite with ssl", async () => {
  await withTempDir(async (dir) => {
    const config = validSqliteConfig();
    (config.db as { ssl?: boolean }).ssl = true;
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "SQLite configuration does not support SSL",
    );
  });
});

Deno.test("resolveConfig fails if deploy target is invalid", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    config.deploy.target = "aws_lambda" as never;
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "Unsupported deploy target",
    );
  });
});

Deno.test("resolveConfig fails if deploy entry is missing", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    delete (config.deploy as { entry?: string }).entry;
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    await assertRejects(
      async () => {
        await resolveConfig(dir);
      },
      Error,
      "deploy.entry",
    );
  });
});

Deno.test("resolveConfig accepts optional deploy envFile", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    delete config.deploy.envFile;
    const configPath = join(dir, "tsera.config.ts");
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    const result = await resolveConfig(dir);

    assertEquals(result.config.deploy.envFile, undefined);
  });
});

Deno.test("resolveConfig cache bust with timestamp", async () => {
  await withTempDir(async (dir) => {
    const config = validPostgresConfig();
    const configPath = join(dir, "tsera.config.ts");

    // Crée la config initiale
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(config)};`,
    );

    const result1 = await resolveConfig(dir);
    assertEquals(result1.config.db.dialect, "postgres");

    // Modifie la config
    const newConfig = validSqliteConfig();
    await Deno.writeTextFile(
      configPath,
      `export default ${JSON.stringify(newConfig)};`,
    );

    // Devrait charger la nouvelle config grâce au cache bust
    const result2 = await resolveConfig(dir);
    assertEquals(result2.config.db.dialect, "sqlite");
  });
});

