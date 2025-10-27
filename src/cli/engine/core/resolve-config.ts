/**
 * Config resolution placeholder. Eventually this will read `tsera.config.ts`
 * files but for now it simply exposes the shape so commands compile.
 */

import type { TseraConfig } from "../../contracts/types.ts";

export async function resolveConfig(_path: string): Promise<TseraConfig | null> {
  await Promise.resolve();
  console.warn("resolveConfig placeholder: aucun fichier tsera.config.ts chargé");
  return null;
}
