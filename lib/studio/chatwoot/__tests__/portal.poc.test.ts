// @vitest-environment node
/**
 * SDD-0586 (10.5, PR 1a) · Prueba de concepto contra un Chatwoot 4.19.1 REAL y efímero (§10.5.15).
 *
 * Solo corre dentro de infra/chatwoot/pruebas/portal/prueba-portal-poc.sh, que levanta la instancia (en GitHub
 * Actions: .github/workflows/chatwoot-portal-poc.yml) y pasa CHATWOOT_POC_*. Sin esas variables, todo el archivo
 * se salta: en «Calidad continua» y en una PC sin la instancia sale como omitido, no como verde.
 *
 * Usa el cliente real de Studio (router-api.ts y portal.ts), sin dobles de red. Cada PoC tiene su control: lo
 * que la prueba busca tiene que poder faltar, para que su verde diga algo.
 *
 *   PoC-1  un mensaje creado por la API de cuenta en una bandeja API guarda el source_id que se le manda y lo
 *          devuelve al listar.
 *   PoC-2  se puede buscar un contacto por su identifier; el mismo identifier dos veces da 422.
 *   PoC-3  el listado de mensajes da su tipo, si es privado, su source_id y sus adjuntos.
 *   PoC-5  la API acepta message_type incoming en una bandeja API, con el contacto como remitente, y el webhook
 *          de cuenta lo entrega como incoming.
 *   Ida    portal.ts de punta a punta: el primer mensaje crea contacto, conversación y mensaje, y un reintento
 *          incierto no duplica nada.
 *
 * Datos inventados: «SINT-…».
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ chatwoot_portal: true }));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => ({ ...flags }) }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => null }));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({ enqueueUserPush: vi.fn(), drainOperarioPushOutbox: vi.fn() }));

import { enviarPortalPendientes } from "../portal";
import {
  buscarContactoPortal,
  crearContactoPortal,
  crearConversacionPortal,
  crearMensajeEntrante,
  listarConversacionesContacto,
  listarMensajes,
} from "../router-api";

const ORIGEN = process.env.CHATWOOT_POC_ORIGIN ?? "";
const CUENTA = Number(process.env.CHATWOOT_POC_CUENTA ?? "0");
const BANDEJA = Number(process.env.CHATWOOT_POC_BANDEJA ?? "0");
const TOKEN = process.env.CHATWOOT_POC_TOKEN ?? "";
const WEBHOOKS = process.env.CHATWOOT_POC_WEBHOOKS ?? "";
const CFG = { origin: ORIGEN, token: TOKEN, accountId: CUENTA };
const LARGO = 60_000;

/** La API de cuenta sin el cliente de Studio: para los controles y para ver los campos crudos. */
async function api(ruta: string, init: RequestInit = {}): Promise<{ status: number; json: unknown }> {
  const r = await fetch(`${ORIGEN}/api/v1/accounts/${CUENTA}/${ruta}`, {
    ...init,
    headers: { api_access_token: TOKEN, Accept: "application/json", ...(init.headers as Record<string, string> | undefined) },
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
type MensajeCrudo = {
  id: number;
  source_id?: string | null;
  message_type?: number | string;
  private?: boolean;
  sender_type?: string;
  sender?: { type?: string; id?: number } | null;
  attachments?: { file_type?: string }[];
};
async function mensajesCrudos(conversacionId: number): Promise<MensajeCrudo[]> {
  const r = await api(`conversations/${conversacionId}/messages`);
  expect(r.status).toBe(200);
  return ((r.json as { payload?: MensajeCrudo[] })?.payload ?? []) as MensajeCrudo[];
}
const esEntrante = (t: unknown) => t === 0 || t === "incoming";
const esSaliente = (t: unknown) => t === 1 || t === "outgoing";

/** Un PNG de 1×1, inventado. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe.skipIf(!ORIGEN || !TOKEN || !CUENTA || !BANDEJA)("PoC de la ida contra Chatwoot 4.19.1 efímero (SDD-0586 §10.5.15)", () => {
  const sufijo = crypto.randomUUID();
  const identificador = `dtd-portal:${sufijo}`;
  const sourceId = `dtd:${crypto.randomUUID()}`;
  let contacto: { contactoId: number; sourceId: string };
  let conversacion: number;
  let mensaje: number;

  it("PoC-2a: crear el contacto con su identifier en la bandeja devuelve su id y el source_id de la bandeja", async () => {
    const r = await crearContactoPortal(CFG, { inboxId: BANDEJA, nombre: "SINT-Cliente PoC", identificador });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    contacto = r.data;
    expect(contacto.contactoId).toBeGreaterThan(0);
    expect(contacto.sourceId.length).toBeGreaterThan(0);
    // El source_id del contact_inbox de una bandeja API no es un teléfono.
    expect(contacto.sourceId).not.toMatch(/^\+?[0-9]+$/);
  }, LARGO);

  it("PoC-2b: el mismo identifier otra vez da 422, el error con el que portal.ts va a buscarlo", async () => {
    const r = await crearContactoPortal(CFG, { inboxId: BANDEJA, nombre: "SINT-Cliente PoC", identificador });
    expect(r).toEqual({ ok: false, error: "http_422" });
  }, LARGO);

  it("PoC-2c: buscar por el identifier encuentra el mismo contacto y su source_id en la bandeja", async () => {
    expect(await buscarContactoPortal(CFG, identificador, BANDEJA)).toEqual({ ok: true, data: contacto });
  }, LARGO);

  it("PoC-2 control: un identifier que nadie creó no aparece, ni uno que solo empieza igual", async () => {
    expect(await buscarContactoPortal(CFG, `dtd-portal:${crypto.randomUUID()}`, BANDEJA)).toEqual({ ok: true, data: null });
    expect(await buscarContactoPortal(CFG, identificador.slice(0, -4), BANDEJA)).toEqual({ ok: true, data: null });
  }, LARGO);

  it("la conversación se crea con el source_id del contacto y aparece entre las del contacto, en la bandeja", async () => {
    const r = await crearConversacionPortal(CFG, { inboxId: BANDEJA, contactoId: contacto.contactoId, sourceId: contacto.sourceId });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    conversacion = r.data;
    const l = await listarConversacionesContacto(CFG, contacto.contactoId);
    expect(l.ok && l.data).toContainEqual({ id: conversacion, inboxId: BANDEJA });
  }, LARGO);

  it("PoC-1 y PoC-5a: el mensaje incoming con source_id entra y vuelve al listar con ese source_id", async () => {
    const r = await crearMensajeEntrante(CFG, conversacion, { texto: "SINT-TEXTO de la PoC", sourceId });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    mensaje = r.data;
    const l = await listarMensajes(CFG, conversacion);
    expect(l.ok && l.data).toContainEqual({ id: mensaje, sourceId });
    const crudo = (await mensajesCrudos(conversacion)).find((m) => m.id === mensaje);
    expect(esEntrante(crudo?.message_type), JSON.stringify(crudo?.message_type)).toBe(true);
    expect(crudo?.private).toBe(false);
    // El remitente es el contacto, no el usuario de servicio.
    expect(String(crudo?.sender_type ?? crudo?.sender?.type ?? "").toLowerCase()).toBe("contact");
  }, LARGO);

  it("PoC-1 control: un mensaje sin source_id vuelve sin él, así que el source_id de arriba es el que se mandó", async () => {
    const r = await api(`conversations/${conversacion}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "SINT-TEXTO sin source_id", message_type: "incoming", private: false }),
    });
    expect(r.status).toBe(200);
    const id = (r.json as { id?: number }).id;
    const l = await listarMensajes(CFG, conversacion);
    expect(l.ok && l.data.find((m) => m.id === id)).toEqual({ id, sourceId: null });
    expect(l.ok && l.data.filter((m) => m.sourceId === sourceId)).toHaveLength(1);
  }, LARGO);

  it("PoC-3: el listado da el tipo, si es privado, el source_id y los adjuntos de cada mensaje", async () => {
    const form = new FormData();
    form.append("content", "SINT-ADJUNTO de la PoC");
    form.append("message_type", "outgoing");
    form.append("private", "false");
    form.append("attachments[]", new Blob([new Uint8Array(PNG)], { type: "image/png" }), "sint-poc.png");
    const r = await api(`conversations/${conversacion}/messages`, { method: "POST", body: form });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    const conAdjunto = (r.json as { id?: number }).id;
    const nota = await api(`conversations/${conversacion}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "SINT nota privada", message_type: "outgoing", private: true }),
    });
    expect(nota.status).toBe(200);
    const notaId = (nota.json as { id?: number }).id;

    const lista = await mensajesCrudos(conversacion);
    const entrante = lista.find((m) => m.id === mensaje);
    const adjunto = lista.find((m) => m.id === conAdjunto);
    const privada = lista.find((m) => m.id === notaId);
    for (const m of [entrante, adjunto, privada]) {
      expect(m, "el mensaje está en la primera página").toBeDefined();
      expect(m).toHaveProperty("message_type");
      expect(m).toHaveProperty("private");
      expect(m).toHaveProperty("source_id");
    }
    expect(entrante?.source_id).toBe(sourceId);
    expect(esSaliente(adjunto?.message_type)).toBe(true);
    expect(adjunto?.attachments?.map((a) => a.file_type)).toEqual(["image"]);
    expect(privada?.private).toBe(true);
    expect(entrante?.private).toBe(false);
    // Control: el entrante no trae adjuntos, así que «attachments» no es un campo que esté siempre lleno.
    expect(entrante?.attachments ?? []).toEqual([]);
  }, LARGO);

  it("PoC-5b: el webhook de cuenta entrega el mensaje como incoming, con su source_id", async () => {
    expect(WEBHOOKS, "la prueba pasa la ruta del receptor").not.toBe("");
    type Entrega = { cuerpo?: { event?: string; id?: number; message_type?: unknown; source_id?: unknown } | null };
    let entrega: Entrega | undefined;
    const limite = Date.now() + 45_000;
    while (!entrega && Date.now() < limite) {
      let lineas: Entrega[] = [];
      try {
        lineas = readFileSync(WEBHOOKS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Entrega);
      } catch {
        lineas = [];
      }
      entrega = lineas.find((e) => e.cuerpo?.event === "message_created" && e.cuerpo.id === mensaje);
      if (!entrega) await new Promise((r) => setTimeout(r, 1000));
    }
    expect(entrega, "Sidekiq entregó el webhook de message_created al receptor").toBeDefined();
    expect(esEntrante(entrega?.cuerpo?.message_type), JSON.stringify(entrega?.cuerpo?.message_type)).toBe(true);
    expect(entrega?.cuerpo?.source_id).toBe(sourceId);
  }, LARGO);

  it("Ida de punta a punta: el primer mensaje del hilo y un reintento incierto, sin duplicar nada", async () => {
    vi.stubEnv("CHATWOOT_URL", ORIGEN);
    vi.stubEnv("CHATWOOT_ROUTER_TOKEN", TOKEN);
    vi.stubEnv("CHATWOOT_ACCOUNT_ID", String(CUENTA));
    vi.stubEnv("CHATWOOT_TENANT_ID", "10000000-0000-4000-8000-000000000001");
    vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", String(BANDEJA));
    try {
      const ident = crypto.randomUUID();
      const mensajeId = crypto.randomUUID();
      const vinculos: Record<string, unknown>[] = [];
      const marcas: Record<string, unknown>[] = [];
      const base = (filas: Record<string, unknown>[]) => {
        const tandas = [filas];
        return {
          rpc: async (nombre: string, args: Record<string, unknown>) => {
            if (nombre === "chatwoot_portal_tomar") return { data: tandas.shift() ?? [], error: null };
            if (nombre === "chatwoot_portal_vincular") vinculos.push(args);
            if (nombre === "chatwoot_portal_marcar") marcas.push(args);
            return { data: null, error: null };
          },
          from: () => {
            const cadena = { select: () => cadena, eq: () => cadena, in: () => cadena, then: (r: (v: unknown) => void) => r({ data: [], error: null }) };
            return cadena;
          },
        } as unknown as Parameters<typeof enviarPortalPendientes>[0];
      };
      const fila = {
        mensaje_id: mensajeId,
        hilo_id: crypto.randomUUID(),
        autor: "SINT-Cliente punta a punta",
        cuerpo: "SINT-TEXTO punta a punta",
        intento: 1,
        verificar: false,
        identificador: ident,
        contacto_id: null,
        contacto_source_id: null,
        conversacion_id: null,
      };

      // 1. El primer mensaje del hilo.
      expect(await enviarPortalPendientes(base([fila]))).toEqual({ tomados: 1, enviados: 1, fallidos: 0 });
      const conContacto = vinculos.find((v) => v.p_conversacion_id === null);
      const conConversacion = vinculos.find((v) => v.p_conversacion_id !== null);
      expect(conContacto && conConversacion).toBeTruthy();
      const conv = Number(conConversacion?.p_conversacion_id);
      expect(conConversacion?.p_inbox_id).toBe(BANDEJA);
      expect(marcas[0]).toMatchObject({ p_ok: true, p_intento: 1, p_incierto: false });
      const enviado = Number(marcas[0].p_chatwoot_message_id);
      const contarSource = async () =>
        (await mensajesCrudos(conv)).filter((m) => m.source_id === `dtd:${mensajeId}`).map((m) => m.id);
      expect(await contarSource()).toEqual([enviado]);

      // 2. Un reintento después de un incierto, con el vínculo ya guardado: lo encuentra y no lo reenvía.
      await enviarPortalPendientes(
        base([{ ...fila, intento: 2, verificar: true, contacto_id: conContacto?.p_contacto_id, contacto_source_id: conContacto?.p_contacto_source_id, conversacion_id: conv }]),
      );
      expect(marcas[1]).toMatchObject({ p_ok: true, p_intento: 2, p_chatwoot_message_id: enviado });
      expect(await contarSource()).toEqual([enviado]);

      // 3. Un incierto antes de guardar nada: busca el contacto por su identificador y reusa la conversación.
      const antes = vinculos.length;
      await enviarPortalPendientes(base([{ ...fila, intento: 3, verificar: true }]));
      const nuevos = vinculos.slice(antes);
      expect(nuevos.map((v) => v.p_contacto_id)).toEqual([conContacto?.p_contacto_id, conContacto?.p_contacto_id]);
      expect(nuevos[1]?.p_conversacion_id).toBe(conv);
      expect(marcas[2]).toMatchObject({ p_ok: true, p_intento: 3, p_chatwoot_message_id: enviado });
      expect(await contarSource()).toEqual([enviado]);
      const delContacto = await listarConversacionesContacto(CFG, Number(conContacto?.p_contacto_id));
      expect(delContacto.ok && delContacto.data.filter((c) => c.inboxId === BANDEJA)).toHaveLength(1);
    } finally {
      vi.unstubAllEnvs();
    }
  }, LARGO);
});
