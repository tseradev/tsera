/**
 * @fileoverview Drizzle Kit configuration for database migrations.
 *
 * This configuration is automatically generated from tsera.config.ts
 * by the TSera core module. Database credentials are resolved from
 * environment variables when needed.
 *
 * @module config/db/drizzle
 * @see https://orm.drizzle.team/kit-docs/config-reference
 */

import { createDrizzleConfigFromTsera } from "@tsera/core";
import tseraConfig from "../../../tsera.config.ts";

export default createDrizzleConfigFromTsera(tseraConfig);
