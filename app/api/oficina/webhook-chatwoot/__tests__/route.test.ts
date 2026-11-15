// @vitest-environment node
/**
 * SDD-0626 §3.2 · POST /api/oficina/webhook-chatwoot. Lo que importa de la ruta: apagada (el defecto),
 * con firma mala o de otra bandeja NO se crea ni el cliente de la base; encendida y válida, guarda
 * UNA referencia (nunca el texto) con ON CONFLICT DO NOTHING. La lógica fina está en
 * lib/studio/__tests__/oficina-webhook.test.ts contra el esquema real.
 */
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ admins: 0, upsert: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    m.admins += 1;
    return { from: () => ({ upsert: m.upsert }) };
  },
}));

import { POST } from "../route";

const SECRETO = "secreto-sintetico-del-cable";

function peticion(o: { inbox?: number; secreto?: string } = {}) {
  const cuerpo = JSON.stringify({
    event: "message_created",
    id: 55,
    message_type: "incoming",
    private: false,
    content: "Hola, soy Juan Pérez, mi correo es juan@correo.test",
    account: { id: 1 },
    conversation: { id: 33, inbox_id: o.inbox ?? 7, status: "open", labels: ["pago"] },
  });
  const ts = String(Math.floor(Date.now() / 1000));
  const firma = `sha256=${createHmac("sha256", o.secreto ?? SECRETO).update(`${ts}.${cuerpo}`).digest("hex")}`;
  return new Request("https://dtdcargo.test/api/oficina/webhook-chatwoot", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Chatwoot-Timestamp": ts, "X-Chatwoot-Signature": firma },
    body: cuerpo,
  });
}

beforeEach(() => {
  m.admins = 0;
  m.upsert.mockReset().mockReturnValue({ select: async () => ({ data: [{ id: "x" }], error: null }) });
  vi.stubEnv("OFICINA_WEBHOOK_ACTIVO", "1");
  vi.stubEnv("OFICINA_WEBHOOK_SECRET", SECRETO);
  vi.stubEnv("OFICINA_CHATWOOT_INBOX_PRUEBA", "7");
  vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/oficina/webhook-chatwoot (SDD-0626 §3.2)", () => {
  it("apagado por defecto (sin OFICINA_WEBHOOK_ACTIVO): 200 sin hacer nada y sin tocar la base", async () => {
    vi.stubEnv("OFICINA_WEBHOOK_ACTIVO", "");
    const r = await POST(peticion());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, ignorado: "apagado" });
    expect(m.admins).toBe(0);
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("firma mala: 401 y sin cliente de base", async () => {
    const r = await POST(peticion({ secreto: "otro" }));
    expect(r.status).toBe(401);
    expect(m.admins).toBe(0);
  });

  it("bandeja de prueba vacía: se rechaza todo (503), sin cliente de base", async () => {
    vi.stubEnv("OFICINA_CHATWOOT_INBOX_PRUEBA", "");
    const r = await POST(peticion());
    expect(r.status).toBe(503);
    expect(m.admins).toBe(0);
  });

  it("bandeja ajena: 200 ignorada y no escribe", async () => {
    const r = await POST(peticion({ inbox: 99 }));
    expect(await r.json()).toEqual({ ok: true, ignorado: "bandeja" });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("encendido y válido: guarda una referencia con ON CONFLICT DO NOTHING, nunca el texto", async () => {
    const r = await POST(peticion());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, resultado: "guardado" });
    expect(m.upsert).toHaveBeenCalledTimes(1);
    expect(m.upsert).toHaveBeenCalledWith(
      {
        tipo: "chatwoot.message_created",
        origen: "chatwoot",
        clave_dedupe: "chatwoot:conv:33:msg:55",
        prioridad: 3,
        payload_ref: "chatwoot:conversations/33/messages/55",
      },
      { onConflict: "clave_dedupe", ignoreDuplicates: true },
    );
    expect(JSON.stringify(m.upsert.mock.calls)).not.toContain("Juan");
  });
});
