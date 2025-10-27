/**
 * Shared contract definitions between the CLI and downstream engines.
 */

export interface DatabaseConfig {
  provider: "sqlite" | "postgres";
  url: string;
}

export interface DeployTarget {
  name: string;
  url: string;
}

export interface TseraConfig {
  projectName: string;
  database: DatabaseConfig;
  targets: DeployTarget[];
}
