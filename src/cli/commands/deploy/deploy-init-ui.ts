import { Checkbox } from "cliffy/prompt";
import type { DeployProvider } from "../../definitions.ts";

/**
 * Available deployment providers with their descriptions.
 */
export const AVAILABLE_PROVIDERS: Array<{
  value: DeployProvider;
  label: string;
  description: string;
}> = [
  {
    value: "docker",
    label: "Docker",
    description: "Build and push Docker images, deploy to container registries",
  },
  {
    value: "cloudflare",
    label: "Cloudflare",
    description: "Deploy to Cloudflare Pages or Workers",
  },
  {
    value: "deno-deploy",
    label: "Deno Deploy",
    description: "Deploy to Deno Deploy platform",
  },
  {
    value: "vercel",
    label: "Vercel",
    description: "Deploy to Vercel (preview and production)",
  },
  {
    value: "github",
    label: "GitHub",
    description: "Deploy to GitHub Pages or create GitHub Releases",
  },
];

/**
 * Displays an interactive UI (checklist) to select 0/1/n providers.
 * Reusable by `tsera deploy init` and `tsera init`.
 *
 * @param current - Currently enabled providers (will be pre-selected).
 * @returns Providers selected by the user.
 */
export async function promptProviderSelection(
  current: DeployProvider[],
): Promise<DeployProvider[]> {
  const selected = await Checkbox.prompt({
    message: "Select deployment providers (CD):",
    options: AVAILABLE_PROVIDERS.map((p) => ({
      name: `${p.label} - ${p.description}`,
      value: p.value,
      checked: current.includes(p.value),
    })),
    minOptions: 0,
  });

  return selected as DeployProvider[];
}

