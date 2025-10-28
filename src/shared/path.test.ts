import { join } from "./path.ts";
import { assertEquals } from "../testing/asserts.ts";

if (Deno.build.os === "windows") {
  Deno.test("join conserve le préfixe de lecteur Windows", () => {
    const result = join("D:\\workspace", "project", "file.txt");
    assertEquals(result, "D:\\workspace\\project\\file.txt");
  });

  Deno.test("join normalise le dossier racine Windows", () => {
    const root = "C:\\";
    const result = join(root);
    assertEquals(result, root);
  });
}
