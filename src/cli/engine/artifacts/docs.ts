/**
 * Placeholder artifact generator for Markdown documentation.
 */

export async function emitDocs(name: string, markdown: string): Promise<void> {
  await Promise.resolve();
  console.log(`Génération docs (placeholder): ${name}\n${markdown.substring(0, 40)}...`);
}
