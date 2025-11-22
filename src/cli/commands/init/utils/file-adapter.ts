/**
 * File adaptation utilities for template composition.
 *
 * This module provides utilities to adapt TypeScript files during template
 * composition, using TS-Morph for AST manipulation.
 *
 * @module
 */

import { join } from "../../../../shared/path.ts";
import { exists } from "std/fs";
import { parse as parseJsonc } from "jsr:@std/jsonc@1";
import {
  createTSeraProject,
  createInMemorySourceFile,
  VariableDeclarationKind,
} from "../../../utils/ts-morph.ts";

/**
 * Configuration for code elements that should be added when dependencies are available.
 * This declarative approach makes it easy to maintain and extend.
 */
const CONNECT_FILE_ELEMENTS = [
  {
    type: "import" as const,
    moduleSpecifier: "drizzle-orm/node-postgres",
    namedImports: ["drizzle"],
  },
  {
    type: "import" as const,
    moduleSpecifier: "pg",
    namedImports: ["Pool"],
  },
  {
    type: "variable" as const,
    name: "pool",
    isExported: true,
    initializer: `new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})`,
  },
  {
    type: "variable" as const,
    name: "db",
    isExported: true,
    initializer: "drizzle(pool)",
  },
  {
    type: "function" as const,
    name: "testConnection",
    isExported: true,
    isAsync: true,
    returnType: "Promise<boolean>",
    body: `const client = await pool.connect();
try {
  await client.query("SELECT 1");
  return true;
} finally {
  client.release();
}`,
  },
  {
    type: "function" as const,
    name: "closeConnection",
    isExported: true,
    isAsync: true,
    returnType: "Promise<void>",
    body: "await pool.end();",
  },
] as const;

/**
 * Checks if database dependencies are installed by looking at deno.jsonc.
 *
 * @param targetDir - Target directory where the project is being created.
 * @returns True if dependencies are installed, false otherwise.
 */
export async function checkDependenciesInstalled(targetDir: string): Promise<boolean> {
  const denoJsonPath = join(targetDir, "deno.jsonc");

  if (!(await exists(denoJsonPath))) {
    return false;
  }

  try {
    const denoContent = await Deno.readTextFile(denoJsonPath);
    const denoConfig = parseJsonc(denoContent) as {
      imports?: Record<string, string>;
      [key: string]: unknown;
    };

    const imports = denoConfig.imports || {};
    return (
      Object.values(imports).some(v => typeof v === "string" && v.includes("drizzle-orm")) &&
      Object.values(imports).some(v => typeof v === "string" && v.includes("pg"))
    );
  } catch {
    return false;
  }
}

/**
 * Checks if drizzle-kit is installed by looking at deno.jsonc or import_map.json.
 *
 * @param targetDir - Target directory where the project is being created.
 * @returns True if drizzle-kit is installed, false otherwise.
 */
export async function checkDrizzleKitInstalled(targetDir: string): Promise<boolean> {
  // Check deno.jsonc first
  const denoJsonPath = join(targetDir, "deno.jsonc");
  if (await exists(denoJsonPath)) {
    try {
      const denoContent = await Deno.readTextFile(denoJsonPath);
      const denoConfig = parseJsonc(denoContent) as {
        imports?: Record<string, string>;
        [key: string]: unknown;
      };

      const imports = denoConfig.imports || {};
      if (Object.values(imports).some(v => typeof v === "string" && v.includes("drizzle-kit"))) {
        return true;
      }
    } catch {
      // Ignore errors
    }
  }

  // Check import_map.json as fallback
  const importMapPath = join(targetDir, "import_map.json");
  if (await exists(importMapPath)) {
    try {
      const importMapContent = await Deno.readTextFile(importMapPath);
      const importMap = parseJsonc(importMapContent) as {
        imports?: Record<string, string>;
      };

      const imports = importMap.imports || {};
      return Object.values(imports).some(v => typeof v === "string" && v.includes("drizzle-kit"));
    } catch {
      // Ignore errors
    }
  }

  return false;
}

/**
 * Adapts connect.ts file to add database code if dependencies are installed.
 * Uses TS-Morph to manipulate the AST directly instead of regex replacements.
 *
 * @param content - Original file content.
 * @param targetDir - Target directory where the project is being created.
 * @returns Adapted file content.
 */
export async function adaptConnectFile(content: string, targetDir: string): Promise<string> {
  // Check if dependencies are installed
  const hasDependencies = await checkDependenciesInstalled(targetDir);
  if (!hasDependencies) {
    return content;
  }

  try {
    const project = createTSeraProject();
    const sourceFile = createInMemorySourceFile(project, "connect.ts", content);

    // Process each element in the configuration
    for (const element of CONNECT_FILE_ELEMENTS) {
      switch (element.type) {
        case "import": {
          // Check if import already exists
          const existing = sourceFile.getImportDeclaration(element.moduleSpecifier);
          if (!existing) {
            sourceFile.addImportDeclaration({
              moduleSpecifier: element.moduleSpecifier,
              namedImports: element.namedImports.map(name => ({ name })),
            });
          }
          break;
        }

        case "variable": {
          // Check if variable already exists
          const existing = sourceFile.getVariableDeclaration(element.name);
          if (!existing) {
            // Add variable statement - TS-Morph will format it correctly
            sourceFile.addVariableStatement({
              isExported: element.isExported,
              declarationKind: VariableDeclarationKind.Const,
              declarations: [{
                name: element.name,
                initializer: element.initializer,
              }],
            });
          }
          break;
        }

        case "function": {
          // Check if function already exists
          const existing = sourceFile.getFunction(element.name);
          if (!existing) {
            sourceFile.addFunction({
              isExported: element.isExported,
              isAsync: element.isAsync,
              name: element.name,
              returnType: element.returnType,
              statements: element.body,
            });
          }
          break;
        }
      }
    }

    // Format the code
    sourceFile.formatText();

    return sourceFile.getFullText();
  } catch (error) {
    // If TS-Morph fails (e.g., syntax errors in template), return original content
    // This can happen if the template has syntax issues, but we don't want to break the init
    console.warn(`Failed to adapt connect.ts with TS-Morph: ${error instanceof Error ? error.message : String(error)}`);
    return content;
  }
}

/**
 * Adapts drizzle.config.ts file to uncomment drizzle-kit import and satisfies clause
 * if drizzle-kit is installed. Uses TS-Morph to manipulate the AST directly.
 *
 * @param content - Original file content.
 * @param targetDir - Target directory where the project is being created.
 * @returns Adapted file content.
 */
export async function adaptDrizzleConfigFile(
  content: string,
  targetDir: string,
): Promise<string> {
  // Check if drizzle-kit is installed
  const hasDrizzleKit = await checkDrizzleKitInstalled(targetDir);
  if (!hasDrizzleKit) {
    return content;
  }

  try {
    const project = createTSeraProject();
    const sourceFile = createInMemorySourceFile(project, "drizzle.config.ts", content);

    // Check if import already exists (uncommented)
    const existingImport = sourceFile.getImportDeclaration("drizzle-kit");
    if (!existingImport) {
      // Add the import declaration
      sourceFile.addImportDeclaration({
        moduleSpecifier: "drizzle-kit",
        namedImports: [{ name: "Config" }],
        isTypeOnly: true,
      });
    }

    // Find the default export statement by searching all statements
    const statements = sourceFile.getStatements();
    let defaultExportStatement: ReturnType<typeof sourceFile.getStatements>[number] | undefined;
    
    for (const statement of statements) {
      const text = statement.getText();
      if (text.includes("export default")) {
        defaultExportStatement = statement;
        break;
      }
    }

    if (!defaultExportStatement) {
      // If no default export found, return original content
      return content;
    }

    // Check if the statement already has a satisfies clause
    const statementText = defaultExportStatement.getText();
    if (statementText.includes("satisfies Config")) {
      // Already has satisfies, return as is
      return content;
    }

    // Get the full text of the statement to extract the object literal
    // The statement should be: export default { ... };
    // We need to extract the object literal and add satisfies
    const fullText = defaultExportStatement.getFullText();
    
    // Extract the object literal from "export default { ... };" or "export default { ... },"
    const objectMatch = fullText.match(/export\s+default\s+(\{[\s\S]*?\})(?:,|;)?/);
    if (!objectMatch) {
      return content;
    }

    const objectText = objectMatch[1];
    
    // Get indentation from the original statement (first line)
    const firstLine = fullText.split("\n")[0];
    const indentation = firstLine.match(/^(\s*)/)?.[1] || "";

    // Remove the old statement
    defaultExportStatement.remove();

    // Add the new statement with satisfies Config
    sourceFile.addStatements(
      `${indentation}export default ${objectText} satisfies Config;`,
    );

    // Format the code
    sourceFile.formatText();

    return sourceFile.getFullText();
  } catch (error) {
    // If TS-Morph fails (e.g., syntax errors in template), return original content
    // This can happen if the template has syntax issues, but we don't want to break the init
    console.warn(`Failed to adapt drizzle.config.ts with TS-Morph: ${error instanceof Error ? error.message : String(error)}`);
    return content;
  }
}

