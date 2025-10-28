// Temporary local contract mirroring the public TSera core types.
// Replace this mapping with the real package once published.
export type DbConfig =
  | {
    dialect: "postgres";
    urlEnv: string;
    ssl?: "disable" | "prefer" | "require";
    file?: undefined;
  }
  | {
    dialect: "mysql";
    urlEnv: string;
    ssl?: boolean;
    file?: undefined;
  }
  | {
    dialect: "sqlite";
    urlEnv?: string;
    file: string;
    ssl?: undefined;
  };

export type DeployTarget = "deno_deploy" | "cloudflare" | "node_pm2";

export interface TseraConfig {
  openapi: boolean;
  docs: boolean;
  tests: boolean;
  telemetry: boolean;
  outDir: string;
  paths: {
    entities: string[];
    routes?: string[];
  };
  db: DbConfig;
  deploy: {
    target: DeployTarget;
    entry: string;
    envFile?: string;
  };
}
