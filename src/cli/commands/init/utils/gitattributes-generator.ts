/**
 * Git attributes file generation for git-crypt encryption.
 *
 * This module generates .gitattributes files to configure git-crypt
 * encryption for sensitive files in TSera projects.
 *
 * @module
 */

import { join } from "../../../../shared/path.ts";
import type { ComposedTemplate } from "./template-composer.ts";

/**
 * Options for generating gitattributes file.
 */
export interface GitAttributesOptions {
  /** Target directory where the project is being created. */
  targetDir: string;
  /** Composition result to update. */
  result: ComposedTemplate;
}

/**
 * Generates .gitattributes file for git-crypt encryption.
 *
 * @param options - Generation options.
 */
export async function generateGitAttributes(
  options: GitAttributesOptions,
): Promise<void> {
  const gitattributesContent = `# TSera secrets encryption with git-crypt
# Install: https://github.com/AGWA/git-crypt
# Usage:
#   git-crypt init
#   git-crypt add-gpg-user <GPG_KEY_ID>

config/secret/.env.* filter=git-crypt diff=git-crypt
`;

  const gitattributesPath = join(options.targetDir, ".gitattributes");
  await Deno.writeTextFile(gitattributesPath, gitattributesContent);
  options.result.copiedFiles.push(".gitattributes");
}
