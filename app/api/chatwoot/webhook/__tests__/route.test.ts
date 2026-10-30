// @vitest-environment node
/**
 * SDD-0585 · POST /api/chatwoot/webhook. Lo que importa: sin configuración o con
 * firma mala NO se toca la base, lo ajeno se ignora con 200, y el texto del
 * mensaje no aparece en lo que la ruta devuelve ni registra.
 */
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TEXTO_SINTETICO, estadoCambiado, mensajeCreado } from "@/lib/studio/chatwoot/__tests__/webhook-fixtures";

const m = vi.hoisted(() => ({ admins: 0, procesar: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    m.admins += 1;
    return { fake: true };
  },
}));
vi.mock("@/lib/studio/chatwoot/webhook-procesar", () => ({ procesarEventoChatwoot: m.procesar }));

import { POST } from "../route";

const SECRETO = "secreto-sintetico-e2";
const TENANT = "10000000-0000-4000-8000-000000000001";

function peticion(payload: unknown, opciones: { secreto?: string; ts?: number; firma?: string | null; cuerpo?: string } = {}) {
  const cuerpo = opciones.cuerpo ?? JSON.stringify(payload);
  const ts = String(opciones.ts ?? Math.floor(Date.now() / 1000));
  const firma =
    opciones.firma === undefined
      ? `sha256=${createHmac("sha256", opciones.secreto ?? SECRETO).update(`${ts}.${cuerpo}`).digest("hex")}`
      : opciones.firma;
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Chatwoot-Timestamp": ts };
  if (firma) headers["X-Chatwoot-Signature"] = firma;
  return new Request("https://dtdcargo.test/api/chatwoot/webhook", { method: "POST", headers, body: cuerpo });
}

beforeEach(() => {
  m.admins = 0;
  m.procesar.mockReset().mockResolvedValue({ estado: "procesado", aplicado: true });
  vi.stubEnv("CHATWOOT_WEBHOOK_SECRET", SECRETO);
  vi.stubEnv("CHATWOOT_TENANT_ID", TENANT);
  vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/chatwoot/webhook (SDD-0585)", () => {
  it("sin configuración: 503 y no toca la base", async () => {
    vi.stubEnv("CHATWOOT_WEBHOOK_SECRET", "");
    const r = await POST(peticion(mensajeCreado()));
    expect(r.status).toBe(503);
    expect(m.admins).toBe(0);
  });

  it.each([
    ["firma de otro secreto", { secreto: "otro" }],
    ["sin firma", { firma: null }],
    ["timestamp vencido (anti-replay)", { ts: Math.floor(Date.now() / 1000) - 3600 }],
  ])("%s: 401 y no toca la base", async (_caso, opciones) => {
    const r = await POST(peticion(mensajeCreado(), opciones));
    expect(r.status).toBe(401);
    expect(m.admins).toBe(0);
    expect(m.procesar).not.toHaveBeenCalled();
  });

  it("JSON malo con firma buena: 400", async () => {
    const r = await POST(peticion(null, { cuerpo: "{no es json" }));
    expect(r.status).toBe(400);
    expect(m.admins).toBe(0);
  });

  it("otro evento u otra cuenta: 200 ignored, sin procesar", async () => {
    const otroEvento = await POST(peticion({ event: "contact_created", id: 5, account: { id: 1 } }));
    expect(await otroEvento.json()).toEqual({ ok: true, ignored: "evento" });
    const otraCuenta = await POST(peticion(mensajeCreado({ account: { id: 2 } })));
    expect(await otraCuenta.json()).toEqual({ ok: true, ignored: "cuenta" });
    expect(m.procesar).not.toHaveBeenCalled();
  });

  it("message_created válido: procesa con el tenant configurado y responde 200 sin el texto", async () => {
    const r = await POST(peticion(mensajeCreado()));
    expect(r.status).toBe(200);
    const texto = await r.text();
    expect(JSON.parse(texto)).toEqual({ ok: true, resultado: "procesado" });
    expect(texto).not.toContain(TEXTO_SINTETICO);
    const [ctx, evento] = m.procesar.mock.calls[0] as [{ tenantId: string }, { clave: string }];
    expect(ctx.tenantId).toBe(TENANT);
    expect(evento.clave).toBe("message_created:101");
  });

  it("conversation_status_changed válido: procesa", async () => {
    const r = await POST(peticion(estadoCambiado()));
    expect(r.status).toBe(200);
    expect(m.procesar).toHaveBeenCalledTimes(1);
  });

  it("si el registro falla: 500 y el log no lleva el texto", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    m.procesar.mockRejectedValue(new Error("chatwoot_registrar_evento: XX000"));
    const r = await POST(peticion(mensajeCreado()));
    expect(r.status).toBe(500);
    expect(JSON.stringify(espia.mock.calls)).not.toContain(TEXTO_SINTETICO);
    espia.mockRestore();
  });
});
