/**
 * Tests del helper readJsonBody (tope de tamaño de body para endpoints públicos).
 *
 * Cubre: JSON válido bajo el límite → ok+body; Content-Length sobre el límite →
 * 413 SIN leer; body sobre el límite sin Content-Length → 413 (backstop por bytes);
 * JSON roto → 400.
 */
import { describe, it, expect } from "vitest";
import { readJsonBody, MAX_PUBLIC_JSON_BYTES } from "../read-json-body";

function jsonReq(body: unknown): Request {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("readJsonBody", () => {
  it("JSON válido bajo el límite → ok + body parseado", async () => {
    const res = await readJsonBody<{ a: number }>(jsonReq({ a: 1 }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.body.a).toBe(1);
  });

  it("Content-Length sobre el límite → 413 (rechaza antes de leer)", async () => {
    // Body chico, pero un maxBytes diminuto: el Content-Length auto-seteado por
    // Request ya excede el tope → 413 por el guard del header.
    const res = await readJsonBody(jsonReq({ hola: "mundo" }), 4);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(413);
  });

  it("body grande SIN Content-Length → 413 por el backstop de bytes", async () => {
    // Request-like sin Content-Length (headers.get devuelve null) y texto enorme.
    const fake = {
      headers: { get: () => null },
      text: async () => "x".repeat(MAX_PUBLIC_JSON_BYTES + 100),
    } as unknown as Request;
    const res = await readJsonBody(fake);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(413);
  });

  it("JSON roto bajo el límite → 400", async () => {
    const bad = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ no es json",
    });
    const res = await readJsonBody(bad);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });
});
