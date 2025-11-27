import { Project, SyntaxKind } from "ts-morph";
import type { DeployProvider } from "../definitions.ts";
import { resolveProject } from "./project.ts";
import { formatAndSave } from "./ts-morph.ts";

/**
 * Reads deployTargets from config/tsera.config.ts.
 * Always returns an array: if deployTargets is undefined or doesn't exist, returns [].
 *
 * @param projectDir - Project directory.
 * @returns Array of enabled deployment providers.
 */
export async function readDeployTargets(
  projectDir: string,
): Promise<DeployProvider[]> {
  try {
    const project = await resolveProject(projectDir);
    const configPath = project.configPath;

    // Load config file with TS-Morph
    const tsProject = new Project();
    const sourceFile = tsProject.addSourceFileAtPath(configPath);

    // Find config declaration
    const configVar = sourceFile.getVariableDeclaration("config");
    if (!configVar) {
      return [];
    }

    // Find deployTargets property in config object
    const initializer = configVar.getInitializer();
    if (!initializer || initializer.getKind() !== SyntaxKind.ObjectLiteralExpression) {
      return [];
    }

    const objLiteral = initializer.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    const deployTargetsProp = objLiteral.getProperty("deployTargets");

    if (!deployTargetsProp) {
      return [];
    }

    // Extract array (verify it's a PropertyAssignment)
    if (deployTargetsProp.getKind() !== SyntaxKind.PropertyAssignment) {
      return [];
    }

    const propAssignment = deployTargetsProp.asKindOrThrow(SyntaxKind.PropertyAssignment);
    const propInitializer = propAssignment.getInitializer();
    if (!propInitializer || propInitializer.getKind() !== SyntaxKind.ArrayLiteralExpression) {
      return [];
    }

    const arrayLiteral = propInitializer.asKindOrThrow(SyntaxKind.ArrayLiteralExpression);
    const elements = arrayLiteral.getElements();

    const providers: DeployProvider[] = [];
    for (const element of elements) {
      if (element.getKind() === SyntaxKind.StringLiteral) {
        const value = element.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();
        if (
          value === "docker" || value === "cloudflare" || value === "deno-deploy" ||
          value === "vercel" || value === "github"
        ) {
          providers.push(value as DeployProvider);
        }
      }
    }

    return providers;
  } catch {
    // If config file doesn't exist, return empty array
    return [];
  }
}

/**
 * Updates deployTargets in config/tsera.config.ts.
 * Completely replaces the existing array.
 *
 * @param projectDir - Project directory.
 * @param providers - New providers to set.
 */
export async function updateDeployTargets(
  projectDir: string,
  providers: DeployProvider[],
): Promise<void> {
  const project = await resolveProject(projectDir);
  const configPath = project.configPath;

  // Load config file with TS-Morph
  const tsProject = new Project();
  const sourceFile = tsProject.addSourceFileAtPath(configPath);

  // Find config declaration
  const configVar = sourceFile.getVariableDeclaration("config");
  if (!configVar) {
    throw new Error(`Could not find 'config' variable in ${configPath}`);
  }

  // Find config object
  const initializer = configVar.getInitializer();
  if (!initializer || initializer.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    throw new Error(`Invalid config object in ${configPath}`);
  }

  const objLiteral = initializer.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const deployTargetsProp = objLiteral.getProperty("deployTargets");

  // Create new array
  const providersArray = providers.map((p) => `"${p}"`).join(", ");
  const newArrayText = `[${providersArray}]`;

  if (deployTargetsProp && deployTargetsProp.getKind() === SyntaxKind.PropertyAssignment) {
    // Update existing property
    const propAssignment = deployTargetsProp.asKindOrThrow(SyntaxKind.PropertyAssignment);
    const propInitializer = propAssignment.getInitializer();
    if (propInitializer) {
      propInitializer.replaceWithText(newArrayText);
    } else {
      propAssignment.setInitializer(newArrayText);
    }
  } else {
    // Add property if it doesn't exist
    objLiteral.addPropertyAssignment({
      name: "deployTargets",
      initializer: newArrayText,
    });
  }

  // Save file
  await formatAndSave(sourceFile, configPath);
}
