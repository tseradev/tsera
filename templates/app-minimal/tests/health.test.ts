import { assertEquals } from "../testing/asserts.ts";
import { app } from "../main.ts";

Deno.test("GET /health returns a JSON payload", async () => {
  const response = await app.request("/health");
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.status, "ok");
  assertEquals(typeof body.timestamp, "string");
});
