// @vitest-environment node
/**
 * SDD-0626 §3.2 · Si `exigirTextosDelCable` rechaza lo que el webhook iba a escribir, NO se guarda
 * nada, el log dice por qué SIN repetir el dato, y Chatwoot recibe 422. Aparte de la otra prueba
 * porque aquí se sustituye la regla (vi.mock): con ids numéricos el webhook real nunca la dispara.
 */
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ codigos: ["meta_datos_con_datos_personales"] as string[] }));
vi.mock("../oficina/cable-textos", () => {
  class TextoDelCableRechazado extends Error {
    codigos: string[];
    constructor(c: string[]) {
      super(c.join(","));
      this.codigos = c;
    }
  }
  return {
    TextoDelCableRechazado,
    exigirTextosDelCable: vi.fn(() => {
      throw new TextoDelCableRechazado(m.codigos);
    }),
  };
});

import { reglasDeEntorno } from "../oficina/filtro-nivel1";
import { procesarWebhookOficina } from "../oficina/webhook-chatwoot";

const SECRETO = "secreto-sintetico";

function peticion() {
  const cuerpo = JSON.stringify({
    event: "message_created",
    id: 5,
    message_type: "incoming",
    private: false,
    content: "mi cédula es V-12.345.678",
    account: { id: 1 },
    conversation: { id: 3, inbox_id: 7, status: "open", labels: [] },
  });
  const ts = String(Math.floor(Date.now() / 1000));
  const firma = `sha256=${createHmac("sha256", SECRETO).update(`${ts}.${cuerpo}`).digest("hex")}`;
  return new Request("https://dtdcargo.test/api/oficina/webhook-chatwoot", {
    method: "POST",
    headers: { "X-Chatwoot-Timestamp": ts, "X-Chatwoot-Signature": firma },
    body: cuerpo,
  });
}

describe("el webhook respeta el rechazo de exigirTextosDelCable", () => {
  it("no guarda, responde 422 y el log lleva el código pero no el dato", async () => {
    const guardar = vi.fn(async () => "guardado" as const);
    const log: string[] = [];
    const r = await procesarWebhookOficina(peticion(), {
      config: { activo: true, secreto: SECRETO, bandejaPrueba: 7, cuenta: 1, reglas: reglasDeEntorno(undefined, undefined) },
      crearAlmacen: () => ({ guardar }),
      registrar: (x) => log.push(x),
    });
    expect(r).toEqual({ status: 422, cuerpo: { ok: false, error: "texto_rechazado" } });
    expect(guardar).not.toHaveBeenCalled();
    expect(log.join("\n")).toContain("meta_datos_con_datos_personales");
    expect(log.join("\n")).not.toContain("12.345.678");
  });
});
