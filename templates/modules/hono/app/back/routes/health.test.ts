import { assertEquals } from "std/assert";
import { app } from "../main.ts";

Deno.test("GET /health returns ok status", async () => {
  const req = new Request("http://localhost:8000/health");
  const res = await app.fetch(req);
  const body = await res.json();

  assertEquals(res.status, 200);
  assertEquals(body, { status: "ok" });
});

