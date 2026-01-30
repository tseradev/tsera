import { assertEquals } from "std/assert";
import { app } from "../main.ts";

// Get port from environment or use default
const TEST_PORT = Number(Deno.env.get("PORT") ?? 8000);

Deno.test("GET /health returns ok status", async () => {
  const req = new Request(`http://localhost:${TEST_PORT}/health`);
  const res = await app.fetch(req);
  const body = await res.json();

  assertEquals(res.status, 200);
  assertEquals(body, { status: "ok" });
});
