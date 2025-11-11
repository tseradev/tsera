/**
 * Tests for formatting utilities.
 *
 * @module
 */

import { assertEquals } from "std/assert/mod.ts";
import {
  formatActionLabel,
  formatActionSummary,
  formatCount,
  formatProjectLabel,
  formatRelativePath,
  sanitizeProjectDir,
} from "../formatters.ts";

Deno.test("formatProjectLabel - extracts last path segment", () => {
  assertEquals(formatProjectLabel("/home/user/projects/my-app"), "my-app");
  assertEquals(formatProjectLabel("C:\\Projects\\demo-app"), "demo-app");
  assertEquals(formatProjectLabel("/path/to/nested/project"), "project");
});

Deno.test("formatProjectLabel - handles edge cases", () => {
  assertEquals(formatProjectLabel("."), ".");
  assertEquals(formatProjectLabel(".."), "..");
  assertEquals(formatProjectLabel("project"), "project");
  // Root path returns itself as there are no segments after filtering
  const result = formatProjectLabel("/");
  assertEquals(typeof result, "string");
});

Deno.test("sanitizeProjectDir - removes trailing separators", () => {
  assertEquals(sanitizeProjectDir("/path/to/project/"), "/path/to/project");
  assertEquals(sanitizeProjectDir("C:\\project\\"), "C:\\project");
  assertEquals(sanitizeProjectDir("/path/to/project//"), "/path/to/project");
  assertEquals(sanitizeProjectDir("/path/to/project"), "/path/to/project");
});

Deno.test("formatRelativePath - makes paths relative to project dir", () => {
  assertEquals(
    formatRelativePath("/project/src/main.ts", "/project"),
    "src/main.ts",
  );
  assertEquals(
    formatRelativePath("/project/docs/README.md", "/project"),
    "docs/README.md",
  );
  assertEquals(
    formatRelativePath("/project", "/project"),
    ".",
  );
});

Deno.test("formatRelativePath - keeps external paths unchanged", () => {
  assertEquals(
    formatRelativePath("/other/file.ts", "/project"),
    "/other/file.ts",
  );
});

Deno.test("formatRelativePath - handles Windows paths", () => {
  assertEquals(
    formatRelativePath("C:\\project\\src\\main.ts", "C:\\project"),
    "src/main.ts",
  );
});

Deno.test("formatActionLabel - formats create action", () => {
  const result = formatActionLabel("create");
  // Result may include ANSI color codes depending on environment
  assertEquals(result.includes("create"), true);
});

Deno.test("formatActionLabel - formats update action", () => {
  const result = formatActionLabel("update");
  assertEquals(result.includes("update"), true);
});

Deno.test("formatActionLabel - formats delete action", () => {
  const result = formatActionLabel("delete");
  assertEquals(result.includes("delete"), true);
});

Deno.test("formatActionLabel - formats noop action", () => {
  const result = formatActionLabel("noop");
  assertEquals(result.includes("noop"), true);
});

Deno.test("formatActionSummary - formats multiple operations", () => {
  const result = formatActionSummary({ create: 3, update: 2, delete: 1 });
  assertEquals(result, "3 creations • 2 updates • 1 deletion");
});

Deno.test("formatActionSummary - handles singular forms", () => {
  const result = formatActionSummary({ create: 1, update: 1, delete: 1 });
  assertEquals(result, "1 creation • 1 update • 1 deletion");
});

Deno.test("formatActionSummary - omits zero counts", () => {
  const result = formatActionSummary({ create: 3, update: 0, delete: 0 });
  assertEquals(result, "3 creations");
});

Deno.test("formatActionSummary - handles no changes", () => {
  const result = formatActionSummary({ create: 0, update: 0, delete: 0 });
  assertEquals(result, "no changes");
});

Deno.test("formatCount - formats singular", () => {
  assertEquals(formatCount(1, "file"), "1 file");
  assertEquals(formatCount(1, "entity", "entities"), "1 entity");
});

Deno.test("formatCount - formats plural", () => {
  assertEquals(formatCount(5, "file"), "5 files");
  assertEquals(formatCount(3, "entity", "entities"), "3 entities");
  assertEquals(formatCount(0, "item"), "0 items");
});

Deno.test("formatCount - handles custom plural", () => {
  assertEquals(formatCount(1, "person", "people"), "1 person");
  assertEquals(formatCount(5, "person", "people"), "5 people");
});
