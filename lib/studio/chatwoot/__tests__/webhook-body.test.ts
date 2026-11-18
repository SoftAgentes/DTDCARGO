// @vitest-environment node
/**
 * SDD-0585 (2.3, v3) · Tope de tamaño del cuerpo del webhook, ANTES de la firma.
 * Lo que importa: un cuerpo grande no se lee entero ni se registra.
 */
import { describe, expect, it } from "vitest";

import { LIMITE_CUERPO_BYTES, leerCuerpoAcotado } from "../webhook-body";

/** Un cuerpo en trozos, sin Content-Length; cuenta cuántos trozos se pidieron. */
function enTrozos(trozos: string[]) {
  let leidos = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(ctrl) {
      if (leidos >= trozos.length) return ctrl.close();
      ctrl.enqueue(new TextEncoder().encode(trozos[leidos]));
      leidos += 1;
    },
  });
  const req = new Request("https://dtdcargo.test/api/chatwoot/webhook", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  return { req, leidos: () => leidos };
}

describe("leerCuerpoAcotado (SDD-0585)", () => {
  it("un cuerpo dentro del tope se lee entero", async () => {
    const req = new Request("https://dtdcargo.test/x", { method: "POST", body: '{"event":"message_created"}' });
    expect(await leerCuerpoAcotado(req)).toEqual({ ok: true, texto: '{"event":"message_created"}' });
  });

  it("Content-Length mayor que el tope: no lee nada", async () => {
    const req = new Request("https://dtdcargo.test/x", {
      method: "POST",
      body: "x",
      headers: { "Content-Length": String(LIMITE_CUERPO_BYTES + 1) },
    });
    expect(await leerCuerpoAcotado(req)).toEqual({ ok: false });
    expect(req.bodyUsed).toBe(false);
  });

  it("sin Content-Length: corta al pasar el tope y no pide el resto", async () => {
    const trozo = "x".repeat(64 * 1024);
    const { req, leidos } = enTrozos(Array.from({ length: 20 }, () => trozo));
    expect(await leerCuerpoAcotado(req)).toEqual({ ok: false });
    expect(leidos()).toBeLessThan(20);
  });

  it("el tope cuenta bytes, no caracteres", async () => {
    const req = new Request("https://dtdcargo.test/x", { method: "POST", body: "ñ".repeat(6) });
    expect(await leerCuerpoAcotado(req, 10)).toEqual({ ok: false });
    expect(await leerCuerpoAcotado(new Request("https://dtdcargo.test/x", { method: "POST", body: "ñ".repeat(5) }), 10)).toEqual({ ok: true, texto: "ñ".repeat(5) });
  });

  it("sin cuerpo: texto vacío", async () => {
    expect(await leerCuerpoAcotado(new Request("https://dtdcargo.test/x", { method: "POST" }))).toEqual({ ok: true, texto: "" });
  });
});
