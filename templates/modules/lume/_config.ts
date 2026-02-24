/**
 * @fileoverview Lume static site generator configuration.
 *
 * Configuration values are loaded from tsera.config.ts
 * for centralized project configuration management.
 */

import lume from "lume/mod.ts";
import tseraConfig from "../tsera.config.ts";

// Use centralized configuration with fallbacks
const frontConfig = tseraConfig.front;
const srcDir = frontConfig?.srcDir ?? "./";
const destDir = frontConfig?.destDir ?? "./.tsera/.temp_front";

const site = lume({
  src: srcDir,
  dest: destDir,
});

site.copy("assets");

export default site;
