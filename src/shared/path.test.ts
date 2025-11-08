import { join } from "./path.ts";
import { assertEquals } from "@std/assert";

if (Deno.build.os === "windows") {
  Deno.test("join preserves the Windows drive prefix", () => {
    const result = join("D:\\workspace", "project", "file.txt");
    assertEquals(result, "D:\\workspace\\project\\file.txt");
  });

  Deno.test("join keeps the Windows root directory normalized", () => {
    const root = "C:\\";
    const result = join(root);
    assertEquals(result, root);
  });
}
