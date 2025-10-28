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

export interface DeployConfig {
  target: DeployTarget;
  entry: string;
  envFile?: string;
}

export interface PathsConfig {
  entities: string[];
  routes?: string[];
}

export interface TseraConfig {
  openapi: boolean;
  docs: boolean;
  tests: boolean;
  telemetry: boolean;
  outDir: string;
  paths: PathsConfig;
  db: DbConfig;
  deploy: DeployConfig;
}

export interface ResolvedTseraConfig {
  configPath: string;
  config: TseraConfig;
}
