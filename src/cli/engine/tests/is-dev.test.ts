import { assertEquals } from "std/assert";
import { isInsideTSeraRepo } from "../is-dev.ts";

Deno.test("isInsideTSeraRepo - returns true when target is inside repo", () => {
  const templatesRoot = "/home/user/tsera/templates";
  const targetDir = "/home/user/tsera/demo";

  assertEquals(isInsideTSeraRepo(targetDir, templatesRoot), true);
});

Deno.test("isInsideTSeraRepo - returns false when target is outside repo", () => {
  const templatesRoot = "/home/user/tsera/templates";
  const targetDir = "/home/other/projects/myapp";

  assertEquals(isInsideTSeraRepo(targetDir, templatesRoot), false);
});

Deno.test("isInsideTSeraRepo - handles Windows paths", () => {
  const templatesRoot = "C:\\Users\\steve\\Projets\\TSERA\\tsera\\templates";
  const targetDir = "C:\\Users\\steve\\Projets\\TSERA\\tsera\\demo";

  assertEquals(isInsideTSeraRepo(targetDir, templatesRoot), true);
});

Deno.test("isInsideTSeraRepo - returns true when target equals repo root", () => {
  const templatesRoot = "/home/user/tsera/templates";
  const targetDir = "/home/user/tsera";

  assertEquals(isInsideTSeraRepo(targetDir, templatesRoot), true);
});

Deno.test("isInsideTSeraRepo - returns false for sibling directory", () => {
  const templatesRoot = "/home/user/tsera/templates";
  const targetDir = "/home/user/other-project";

  assertEquals(isInsideTSeraRepo(targetDir, templatesRoot), false);
});

Deno.test("isInsideTSeraRepo - handles nested subdirectories", () => {
  const templatesRoot = "/home/user/tsera/templates";
  const targetDir = "/home/user/tsera/packages/core";

  assertEquals(isInsideTSeraRepo(targetDir, templatesRoot), true);
});

Deno.test("isInsideTSeraRepo - handles mixed path separators (Windows)", () => {
  const templatesRoot = "C:/Users/steve/Projets/TSERA/tsera/templates";
  const targetDir = "C:\\Users\\steve\\Projets\\TSERA\\tsera\\demo";

  assertEquals(isInsideTSeraRepo(targetDir, templatesRoot), true);
});

Deno.test("isInsideTSeraRepo - returns false for directory starting with same prefix", () => {
  const templatesRoot = "/home/user/tsera/templates";
  const targetDir = "/home/user/tsera-other";

  assertEquals(isInsideTSeraRepo(targetDir, templatesRoot), false);
});
