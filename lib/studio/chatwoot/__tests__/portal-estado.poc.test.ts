// @vitest-environment node
/**
 * SDD-0586 (10.5, PR 1c-2) · Prueba de concepto del estado y la conciliación contra un Chatwoot 4.19.1 REAL y
 * efímero (§10.5.15).
 *
 * Solo corre dentro de infra/chatwoot/pruebas/portal/prueba-portal-poc.sh, que levanta la instancia (en GitHub
 * Actions: .github/workflows/chatwoot-portal-poc.yml) y pasa CHATWOOT_POC_*. Sin esas variables se salta; en el
 * workflow, la obligatoria de portal.poc.test.ts da rojo si falta la instancia.
 *
 * Usa el cliente real de Studio (router-api.ts, portal-manejadores.ts y portal-conciliar.ts), sin dobles de red. La
 * base de Studio sí es doble: lo que se mide es Chatwoot.
 *
 *   PoC-4  un mensaje entrante por la API en una conversación resuelta, ¿la reabre? (E10-D39). Si no, la 1c-2 suma
 *          la reapertura desde el envío: este rojo es la señal.
 *   E-1    el estado que lee la conciliación (`obtenerConversacion`) sigue a `toggle_status`: resolved, pending y open.
 *   E-2    la conciliación de punta a punta: con el webhook «perdido» (no se corre `responderAlPortal`), trae las
 *          respuestas del agente en orden ascendente, sin el entrante ni la nota, pagina más de una página y no
 *          duplica en la corrida siguiente.
 *
 * Lo que esta PoC no puede medir: si Chatwoot 4.19.1 reintenta un webhook de cuenta. Chatwoot no le entrega al
 * receptor del arnés, que no tiene IP pública (PoC-5 de la 1a: «has no public ip addresses»). Queda como inferencia
 * (I), por la lectura de `Webhooks::Trigger#execute` (comentario del cron chatwoot-reintentos).
 *
 * Datos inventados: «SINT-…».
 */
import { describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ chatwoot_portal: true }));
const push = vi.hoisted(() => ({ notifyClientReplyPush: vi.fn(async () => undefined) }));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => ({ ...flags }) }));
vi.mock("@/lib/studio/conversation-reply-push", () => push);

import { conciliarHilo } from "../portal-conciliar";
import { crearContactoPortal, crearConversacionPortal, crearMensajeEntrante, obtenerConversacion } from "../router-api";

const ORIGEN = process.env.CHATWOOT_POC_ORIGIN ?? "";
const CUENTA = Number(process.env.CHATWOOT_POC_CUENTA ?? "0");
const BANDEJA = Number(process.env.CHATWOOT_POC_BANDEJA ?? "0");
const TOKEN = process.env.CHATWOOT_POC_TOKEN ?? "";
const USUARIO = Number(process.env.CHATWOOT_POC_USUARIO ?? "0");
const TENANT = "10000000-0000-4000-8000-000000000001";
const HILO = "60000000-0000-4000-8000-000000000001";
const CFG = { origin: ORIGEN, token: TOKEN, accountId: CUENTA, tenantId: TENANT, inboxPortalId: BANDEJA };
const LARGO = 120_000;
const HAY_INSTANCIA = Boolean(ORIGEN && TOKEN && CUENTA && BANDEJA && USUARIO);

async function api(ruta: string, init: RequestInit = {}): Promise<{ status: number; json: unknown }> {
  const r = await fetch(`${ORIGEN}/api/v1/accounts/${CUENTA}/${ruta}`, {
    ...init,
    headers: { api_access_token: TOKEN, Accept: "application/json", "Content-Type": "application/json", ...(init.headers as Record<string, string> | undefined) },
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
async function estado(conversacion: number, nuevo: "open" | "resolved" | "pending"): Promise<void> {
  const r = await api(`conversations/${conversacion}/toggle_status`, { method: "POST", body: JSON.stringify({ status: nuevo }) });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
}
async function responderComoAgente(conversacion: number, texto: string): Promise<number> {
  const r = await api(`conversations/${conversacion}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: texto, message_type: "outgoing", private: false }),
  });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
  return (r.json as { id: number }).id;
}
async function hilo(nombre: string): Promise<number> {
  const c = await crearContactoPortal(CFG, { inboxId: BANDEJA, nombre, identificador: `dtd-portal:${crypto.randomUUID()}` });
  expect(c.ok, JSON.stringify(c)).toBe(true);
  if (!c.ok) throw new Error("contacto");
  const v = await crearConversacionPortal(CFG, { inboxId: BANDEJA, contactoId: c.data.contactoId, sourceId: c.data.sourceId });
  expect(v.ok, JSON.stringify(v)).toBe(true);
  if (!v.ok) throw new Error("conversación");
  return v.data;
}

/** La base de Studio: idempotente por id, como la 0520, con el orden de lo escrito y la marca. */
function base() {
  const escritos = new Set<number>();
  const orden: number[] = [];
  const marcas: (number | null)[] = [];
  const rpc = vi.fn(async (nombre: string, args: Record<string, unknown>) => {
    if (nombre === "chatwoot_registrar_evento") return { data: [{ nuevo: false, aplicado: true, client_id: null }], error: null };
    if (nombre === "chatwoot_portal_estado_hilo") return { data: [{ resultado: "igual", estado: "abierto" }], error: null };
    if (nombre === "chatwoot_portal_respuesta") {
      const id = args.p_chatwoot_message_id as number;
      orden.push(id);
      if (escritos.has(id)) return { data: [{ resultado: "duplicado", cliente_id: null }], error: null };
      escritos.add(id);
      return { data: [{ resultado: "insertado", cliente_id: "50000000-0000-4000-8000-0000000000cc" }], error: null };
    }
    if (nombre === "chatwoot_portal_marcar_conciliado") {
      marcas.push(args.p_hasta as number | null);
      return { data: true, error: null };
    }
    throw new Error(`rpc inesperada ${nombre}`);
  });
  return { admin: { rpc } as unknown as Parameters<typeof conciliarHilo>[0], rpc, escritos, orden, marcas };
}

describe.skipIf(!HAY_INSTANCIA)("PoC del estado y la conciliación contra Chatwoot 4.19.1 efímero (SDD-0586 §10.5.15, 1c-2)", () => {
  it("PoC-4: un entrante por la API en una conversación resuelta la reabre", async () => {
    const conversacion = await hilo("SINT-Cliente reabrir");
    await estado(conversacion, "resolved");
    const antes = await obtenerConversacion(CFG, conversacion);
    expect(antes.ok && antes.data.estado).toBe("resolved");
    const e = await crearMensajeEntrante(CFG, conversacion, { texto: "SINT vuelvo a escribir", sourceId: `dtd:${crypto.randomUUID()}` });
    expect(e.ok, JSON.stringify(e)).toBe(true);
    const despues = await obtenerConversacion(CFG, conversacion);
    expect(despues.ok, JSON.stringify(despues)).toBe(true);
    // Rojo aquí = Chatwoot no reabre una conversación resuelta por la API: la 1c-2 tiene que reabrirla desde el envío.
    expect(despues.ok && despues.data.estado, "un entrante reabre una conversación resuelta").toBe("open");
  }, LARGO);

  it("E-1: el estado que lee la conciliación sigue a toggle_status (resolved, pending y open)", async () => {
    const conversacion = await hilo("SINT-Cliente estados");
    for (const nuevo of ["resolved", "pending", "open"] as const) {
      await estado(conversacion, nuevo);
      const c = await obtenerConversacion(CFG, conversacion);
      expect(c.ok && c.data.estado, nuevo).toBe(nuevo);
    }
  }, LARGO);

  it("E-2: con el webhook perdido, la conciliación trae las respuestas en orden, pagina y no duplica", async () => {
    const conversacion = await hilo("SINT-Cliente conciliar");
    const e = await crearMensajeEntrante(CFG, conversacion, { texto: "SINT pregunta", sourceId: `dtd:${crypto.randomUUID()}` });
    expect(e.ok).toBe(true);
    // Más de una página de Chatwoot (20): 23 respuestas del agente, sin correr la vuelta (el webhook «se perdió»).
    const respuestas: number[] = [];
    for (let i = 1; i <= 23; i += 1) respuestas.push(await responderComoAgente(conversacion, `SINT respuesta ${i}`));

    const b = base();
    const primera = await conciliarHilo(b.admin, CFG, { conversation_id: HILO, chatwoot_conversation_id: conversacion, conciliado_hasta: null });
    expect(primera).toEqual({ traidas: 23, completo: true });
    expect(b.orden, "en orden ascendente, solo las respuestas del agente").toEqual(respuestas);
    expect(b.marcas).toHaveLength(1);
    const marca = b.marcas[0];
    expect(marca).toBeGreaterThanOrEqual(respuestas[respuestas.length - 1]);

    // La corrida siguiente, desde la marca: nada nuevo, nada duplicado.
    b.orden.length = 0;
    const segunda = await conciliarHilo(b.admin, CFG, { conversation_id: HILO, chatwoot_conversation_id: conversacion, conciliado_hasta: marca });
    expect(segunda).toEqual({ traidas: 0, completo: true });
    expect(b.orden).toEqual([]);

    // Una respuesta nueva después de la marca entra sola.
    const nueva = await responderComoAgente(conversacion, "SINT respuesta tardía");
    const tercera = await conciliarHilo(b.admin, CFG, { conversation_id: HILO, chatwoot_conversation_id: conversacion, conciliado_hasta: marca });
    expect(tercera).toEqual({ traidas: 1, completo: true });
    expect(b.orden).toEqual([nueva]);
  }, LARGO);
});
