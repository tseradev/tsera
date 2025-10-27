export type DbDialect = "postgres" | "sqlite";

export interface DbConfig {
  dialect: DbDialect;
  connectionString: string;
  migrationsDir: string;
  schemaDir: string;
}

export type DeployTargetKind = "deno-deploy" | "docker" | "custom-script";

export interface DeployTarget {
  name: string;
  kind: DeployTargetKind;
  script?: string;
  envFile?: string;
}

export interface TseraConfig {
  projectName: string;
  rootDir: string;
  entitiesDir: string;
  artifactsDir: string;
  db: DbConfig;
  deploy?: DeployTarget[];
}

export interface ResolvedTseraConfig {
  configPath: string;
  config: TseraConfig;
}
