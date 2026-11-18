// @vitest-environment node
/**
 * SDD-0586 (10.5, PR 1b) · Prueba de concepto de la vuelta contra un Chatwoot 4.19.1 REAL y efímero (§10.5.15).
 *
 * Solo corre dentro de infra/chatwoot/pruebas/portal/prueba-portal-poc.sh, que levanta la instancia (en GitHub
 * Actions: .github/workflows/chatwoot-portal-poc.yml) y pasa CHATWOOT_POC_*. Sin esas variables se salta; en el
 * workflow, la obligatoria de portal.poc.test.ts da rojo si falta la instancia.
 *
 * Usa el cliente real de Studio (router-api.ts, portal-manejadores.ts y webhook-salud.ts), sin dobles de red. La
 * base de Studio sí es doble: lo que se mide es Chatwoot. Cada medida tiene su control.
 *
 *   V-1    la carga del webhook de cuenta de una respuesta del agente (Message#webhook_data) trae lo que la vuelta
 *          lee: saliente, pública, su texto, su hora y el agente como usuario (`type: "user"`).
 *   V-2    el reproceso relee el mensaje por la API de cuenta (PoC-3) y da lo mismo que la carga.
 *   PoC-6  una nota privada creada por la API guarda su source_id, se encuentra al buscarlo (un reintento no la
 *          repite) y la vuelta no la lleva al portal; la bandeja API no tiene webhook_url, así que no sale por ahí.
 *   V-3    responderAlPortal de punta a punta: la respuesta con un adjunto avisa al cliente una vez y deja una sola
 *          nota aunque se reintente; a un hilo archivado le deja su nota una sola vez.
 *   V-4    la salud del webhook lee los webhooks de la cuenta y ve que el del arnés apunta a un host sin IP
 *          pública, el mismo rechazo que Chatwoot registra («has no public ip addresses»).
 *
 * Datos inventados: «SINT-…».
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ chatwoot_portal: true }));
const push = vi.hoisted(() => ({ notifyClientReplyPush: vi.fn(async () => undefined) }));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => ({ ...flags }) }));
vi.mock("@/lib/studio/conversation-reply-push", () => push);

import type { ContextoChatwoot } from "../webhook-procesar";
import type { EventoChatwoot } from "../webhook-events";
import {
  NOTA_ADJUNTO,
  NOTA_ARCHIVADO,
  esRespuestaDelEquipo,
  interpretarMensajePortal,
  responderAlPortal,
  salientePortalDelPayload,
} from "../portal-manejadores";
import {
  buscarMensajePorSourceId,
  crearContactoPortal,
  crearConversacionPortal,
  crearMensajeEntrante,
  crearNotaPrivada,
  leerMensaje,
  listarWebhooksCuenta,
} from "../router-api";
import { esIpPublica, evaluarWebhooks, resolverDns, RUTA_WEBHOOK } from "../webhook-salud";

const ORIGEN = process.env.CHATWOOT_POC_ORIGIN ?? "";
const CUENTA = Number(process.env.CHATWOOT_POC_CUENTA ?? "0");
const BANDEJA = Number(process.env.CHATWOOT_POC_BANDEJA ?? "0");
const TOKEN = process.env.CHATWOOT_POC_TOKEN ?? "";
const USUARIO = Number(process.env.CHATWOOT_POC_USUARIO ?? "0");
const STACK = process.env.CHATWOOT_POC_STACK ?? "";
const PROYECTO = process.env.CHATWOOT_POC_PROYECTO ?? "";
const CFG = { origin: ORIGEN, token: TOKEN, accountId: CUENTA };
const TENANT = "10000000-0000-4000-8000-000000000001";
const CLIENTE = "50000000-0000-4000-8000-0000000000cc";
const LARGO = 60_000;
const HAY_INSTANCIA = Boolean(ORIGEN && TOKEN && CUENTA && BANDEJA && USUARIO);

async function api(ruta: string, init: RequestInit = {}): Promise<{ status: number; json: unknown }> {
  const r = await fetch(`${ORIGEN}/api/v1/accounts/${CUENTA}/${ruta}`, {
    ...init,
    headers: { api_access_token: TOKEN, Accept: "application/json", ...(init.headers as Record<string, string> | undefined) },
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
type MensajeCrudo = { id: number; source_id?: string | null; private?: boolean };
async function todosLosMensajes(conversacionId: number): Promise<MensajeCrudo[]> {
  const todos: MensajeCrudo[] = [];
  let antes: number | null = null;
  for (let i = 0; i < 30; i += 1) {
    const r = await api(`conversations/${conversacionId}/messages${antes === null ? "" : `?before=${antes}`}`);
    expect(r.status).toBe(200);
    const pagina = ((r.json as { payload?: MensajeCrudo[] })?.payload ?? []) as MensajeCrudo[];
    if (pagina.length === 0) break;
    todos.push(...pagina);
    const menor = Math.min(...pagina.map((m) => m.id));
    if (antes !== null && menor >= antes) break;
    antes = menor;
  }
  return todos;
}
const conSource = async (conversacionId: number, sourceId: string) =>
  (await todosLosMensajes(conversacionId)).filter((m) => m.source_id === sourceId).map((m) => m.id);

/** Una respuesta del agente (el administrador del token), saliente y pública; con `adjunto`, con un PNG. */
async function responderComoAgente(conversacionId: number, texto: string, adjunto = false): Promise<number> {
  let r;
  if (adjunto) {
    const form = new FormData();
    form.append("content", texto);
    form.append("message_type", "outgoing");
    form.append("private", "false");
    form.append("attachments[]", new Blob([new Uint8Array(PNG)], { type: "image/png" }), "sint-poc.png");
    r = await api(`conversations/${conversacionId}/messages`, { method: "POST", body: form });
  } else {
    r = await api(`conversations/${conversacionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: texto, message_type: "outgoing", private: false }),
    });
  }
  expect(r.status, JSON.stringify(r.json)).toBe(200);
  return (r.json as { id: number }).id;
}

/** La carga del webhook de cuenta que Chatwoot arma para un mensaje (carga-saliente-poc.rb). */
function cargaWebhook(mensajeId: number): Record<string, unknown> & { modelo_sender_type?: unknown; campos_del_remitente?: unknown } {
  const salida = execFileSync(
    "docker",
    [
      "compose", "-p", PROYECTO, "-f", "compose.yml", "-f", "compose.override.yml", "-f", "compose.portal-poc.yml",
      "run", "--rm", "-T", "-e", `MENSAJE=${mensajeId}`, "prepare",
      "bundle", "exec", "rails", "runner", "/tmp/poc/carga-saliente-poc.rb",
    ],
    { cwd: STACK, encoding: "utf8", timeout: 170_000, stdio: ["ignore", "pipe", "pipe"] },
  );
  const linea = salida.split(/\r?\n/).find((l) => l.startsWith("CARGA_SALIENTE "));
  expect(linea, "la sonda imprime la carga del webhook").toBeDefined();
  return JSON.parse((linea ?? "CARGA_SALIENTE {}").slice("CARGA_SALIENTE ".length));
}

/** Un PNG de 1×1, inventado. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** La base de Studio, doble: el hilo está vinculado y la RPC da `resultado`. */
function base(resultado: string, llamadas: Record<string, unknown>[]) {
  return {
    rpc: async (nombre: string, args: Record<string, unknown>) => {
      if (nombre !== "chatwoot_portal_respuesta") throw new Error(`RPC inesperada ${nombre}`);
      llamadas.push(args);
      return { data: [{ resultado, cliente_id: resultado === "insertado" ? CLIENTE : null }], error: null };
    },
    from: () => {
      const cadena = { select: () => cadena, eq: () => cadena, limit: () => cadena, then: (r: (v: unknown) => void) => r({ data: [{ conversation_id: "x" }], error: null }) };
      return cadena;
    },
  } as unknown as ContextoChatwoot["admin"];
}
const eventoDe = (conversacionId: number, mensajeId: number, inboxId: number | null): EventoChatwoot => ({
  evento: "message_created",
  clave: `message_created:${mensajeId}`,
  accountId: CUENTA,
  mensajeId,
  avisar: false,
  conversacion: {
    id: conversacionId,
    inboxId,
    estado: "open",
    noLeidos: 0,
    asignadoId: null,
    ultimaActividad: null,
    fuenteActualizada: 0,
    telefonoUltimos10: null,
  },
});
function conEntorno<T>(fn: () => Promise<T>): Promise<T> {
  vi.stubEnv("CHATWOOT_URL", ORIGEN);
  vi.stubEnv("CHATWOOT_ROUTER_TOKEN", TOKEN);
  vi.stubEnv("CHATWOOT_ACCOUNT_ID", String(CUENTA));
  vi.stubEnv("CHATWOOT_TENANT_ID", TENANT);
  vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", String(BANDEJA));
  return fn().finally(() => vi.unstubAllEnvs());
}

describe.runIf(process.env.CHATWOOT_POC_REQUERIDA === "1")("la PoC de la vuelta es obligatoria en su workflow", () => {
  it("encuentra la instancia y el usuario agente: sin ellos, rojo y no omitido", () => {
    expect({ instancia: HAY_INSTANCIA, usuario: USUARIO > 0, stack: Boolean(STACK && PROYECTO) }).toEqual({
      instancia: true,
      usuario: true,
      stack: true,
    });
  });
});

describe.skipIf(!HAY_INSTANCIA)("PoC de la vuelta contra Chatwoot 4.19.1 efímero (SDD-0586 §10.5.15, PR 1b)", () => {
  let conversacion: number;
  let entrante: number;
  let respuesta: number;
  let conAdjunto: number;
  const TEXTO_RESPUESTA = "SINT respuesta del equipo";
  const TEXTO_ADJUNTO = "SINT va la foto";

  it("arma el hilo: contacto, conversación, un mensaje del cliente y dos respuestas del agente", async () => {
    const c = await crearContactoPortal(CFG, { inboxId: BANDEJA, nombre: "SINT-Cliente vuelta", identificador: `dtd-portal:${crypto.randomUUID()}` });
    expect(c.ok, JSON.stringify(c)).toBe(true);
    if (!c.ok) return;
    const v = await crearConversacionPortal(CFG, { inboxId: BANDEJA, contactoId: c.data.contactoId, sourceId: c.data.sourceId });
    expect(v.ok, JSON.stringify(v)).toBe(true);
    if (!v.ok) return;
    conversacion = v.data;
    const e = await crearMensajeEntrante(CFG, conversacion, { texto: "SINT pregunta del cliente", sourceId: `dtd:${crypto.randomUUID()}` });
    expect(e.ok).toBe(true);
    if (e.ok) entrante = e.data;
    respuesta = await responderComoAgente(conversacion, TEXTO_RESPUESTA);
    conAdjunto = await responderComoAgente(conversacion, TEXTO_ADJUNTO, true);
  }, LARGO);

  it("V-1: la carga del webhook de la respuesta trae lo que la vuelta lee, con el agente como usuario", () => {
    const carga = cargaWebhook(respuesta);
    const m = salientePortalDelPayload(carga, BANDEJA);
    expect(m, JSON.stringify(carga)).not.toBeNull();
    expect(m).toMatchObject({ id: respuesta, conversacionId: conversacion, inboxId: BANDEJA, tipo: "outgoing", privado: false, texto: TEXTO_RESPUESTA });
    // El modelo dice que es un usuario, y la carga lo dice sola: `sender_type` no viaja en ella.
    expect(carga.modelo_sender_type).toBe("User");
    expect(carga).not.toHaveProperty("sender_type");
    expect(m?.agenteId, JSON.stringify(carga.campos_del_remitente)).toBe(USUARIO);
    expect(Number.isNaN(Date.parse(String(m?.creado)))).toBe(false);
    expect(esRespuestaDelEquipo(m!, BANDEJA)).toBe(true);
    // Control: el mensaje del cliente, en la misma bandeja, no pasa a la vuelta (es entrante y no tiene agente).
    const delCliente = cargaWebhook(entrante);
    expect(salientePortalDelPayload(delCliente, BANDEJA)).toBeNull();
    expect(interpretarMensajePortal(delCliente)?.agenteId).toBeNull();
    // Control: con otra bandeja configurada, la ruta no lee el texto.
    expect(salientePortalDelPayload(carga, BANDEJA + 1000)).toBeNull();
  }, 180_000);

  it("V-2 (PoC-3): el reproceso relee el mensaje y da lo mismo que la carga del webhook", async () => {
    const r = await leerMensaje(CFG, conversacion, respuesta);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    const releido = interpretarMensajePortal(r.ok ? r.data : null);
    const enVivo = salientePortalDelPayload(cargaWebhook(respuesta), BANDEJA);
    expect(releido).toMatchObject({ id: respuesta, tipo: "outgoing", privado: false, texto: TEXTO_RESPUESTA, agenteId: USUARIO, inboxId: BANDEJA });
    // La API da la hora en segundos y el webhook con milisegundos: el mismo segundo.
    expect(Math.floor(Date.parse(String(releido?.creado)) / 1000)).toBe(Math.floor(Date.parse(String(enVivo?.creado)) / 1000));
    // Con el adjunto, la cuenta de adjuntos.
    const a = await leerMensaje(CFG, conversacion, conAdjunto);
    expect(interpretarMensajePortal(a.ok ? a.data : null)?.adjuntos).toBe(1);
    // Control: un id que no existe no aparece.
    expect(await leerMensaje(CFG, conversacion, conAdjunto + 100_000)).toEqual({ ok: true, data: null });
  }, 180_000);

  it("PoC-6: la nota privada guarda su source_id, se encuentra al buscarla y no va al portal", async () => {
    const sourceId = `dtd:nota:prueba:${crypto.randomUUID()}`;
    const desde = new Date(Date.now() - 60_000);
    const n = await crearNotaPrivada(CFG, conversacion, { texto: "SINT nota de la PoC", sourceId });
    expect(n.ok, JSON.stringify(n)).toBe(true);
    if (!n.ok) return;
    expect(await buscarMensajePorSourceId(CFG, conversacion, sourceId, desde)).toEqual({ ok: true, data: n.data });
    const leida = await leerMensaje(CFG, conversacion, n.data);
    const m = interpretarMensajePortal(leida.ok ? leida.data : null);
    expect(m).toMatchObject({ privado: true, sourceId, tipo: "outgoing" });
    expect(esRespuestaDelEquipo(m!, BANDEJA)).toBe(false);
    const carga = cargaWebhook(n.data);
    expect(carga.private).toBe(true);
    expect(carga.source_id).toBe(sourceId);
    // Control: la búsqueda no encuentra una nota que nunca se creó.
    expect(await buscarMensajePorSourceId(CFG, conversacion, `dtd:nota:prueba:${crypto.randomUUID()}`, desde)).toEqual({ ok: true, data: null });
    // La bandeja API del arnés no tiene webhook_url (como la de producción, §10.5.9): una nota no sale por ahí.
    expect(process.env.CHATWOOT_POC_CANAL_CON_URL).toBe("no");
  }, 180_000);

  it("V-3: con un adjunto, el reproceso avisa una vez y deja una sola nota aunque se reintente", async () => {
    const llamadas: Record<string, unknown>[] = [];
    push.notifyClientReplyPush.mockClear();
    await conEntorno(async () => {
      await responderAlPortal({ admin: base("insertado", llamadas), tenantId: TENANT }, eventoDe(conversacion, conAdjunto, null), {
        nuevo: true,
        aplicado: false,
        clientId: null,
      });
      await responderAlPortal({ admin: base("duplicado", llamadas), tenantId: TENANT }, eventoDe(conversacion, conAdjunto, null), {
        nuevo: true,
        aplicado: false,
        clientId: null,
      });
    });
    expect(llamadas[0]).toMatchObject({ p_chatwoot_message_id: conAdjunto, p_cuerpo: TEXTO_ADJUNTO, p_chatwoot_user_id: USUARIO });
    expect(push.notifyClientReplyPush).toHaveBeenCalledTimes(1);
    expect(push.notifyClientReplyPush).toHaveBeenCalledWith(expect.anything(), { clientId: CLIENTE, body: TEXTO_ADJUNTO });
    const notas = await conSource(conversacion, `dtd:nota:adjunto:${conAdjunto}`);
    expect(notas).toHaveLength(1);
    const nota = await leerMensaje(CFG, conversacion, notas[0]);
    expect(interpretarMensajePortal(nota.ok ? nota.data : null)).toMatchObject({ privado: true, texto: NOTA_ADJUNTO });
  }, 180_000);

  it("V-3: a un hilo archivado no le avisa y le deja su nota una sola vez, en vivo y en el reproceso", async () => {
    const llamadas: Record<string, unknown>[] = [];
    push.notifyClientReplyPush.mockClear();
    const enVivo = salientePortalDelPayload(cargaWebhook(respuesta), BANDEJA);
    await conEntorno(async () => {
      await responderAlPortal(
        { admin: base("archivado", llamadas), tenantId: TENANT, salientePortal: enVivo },
        eventoDe(conversacion, respuesta, BANDEJA),
        { nuevo: true, aplicado: true, clientId: null },
      );
      await responderAlPortal({ admin: base("archivado", llamadas), tenantId: TENANT }, eventoDe(conversacion, respuesta, null), {
        nuevo: true,
        aplicado: false,
        clientId: null,
      });
    });
    expect(push.notifyClientReplyPush).not.toHaveBeenCalled();
    // En vivo y releído, la RPC recibe lo mismo (salvo los milisegundos de la hora).
    const sinHora = (a: Record<string, unknown>) => ({ ...a, p_enviado_at: Math.floor(Date.parse(String(a.p_enviado_at)) / 1000) });
    expect(sinHora(llamadas[0])).toEqual(sinHora(llamadas[1]));
    const notas = await conSource(conversacion, `dtd:nota:archivado:${respuesta}`);
    expect(notas).toHaveLength(1);
    const nota = await leerMensaje(CFG, conversacion, notas[0]);
    expect(interpretarMensajePortal(nota.ok ? nota.data : null)).toMatchObject({ privado: true, texto: NOTA_ARCHIVADO });
  }, 300_000);

  it("V-4: la salud lee los webhooks de la cuenta y ve el del arnés sin IP pública, como Chatwoot", async () => {
    const r = await listarWebhooksCuenta(CFG);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    const delArnes = r.data.find((w) => w.url.endsWith(RUTA_WEBHOOK));
    expect(delArnes).toMatchObject({ url: `http://receptor:8080${RUTA_WEBHOOK}`, deBandeja: false });
    expect(delArnes?.eventos).toContain("message_created");
    expect(await evaluarWebhooks(r.data, resolverDns)).toEqual(["webhook_sin_ip_publica"]);
    // Control: el mismo webhook con un host público no da alerta (solo DNS: no se le manda nada).
    const publicas = await resolverDns("example.com");
    expect(publicas.some(esIpPublica), JSON.stringify(publicas)).toBe(true);
    expect(await evaluarWebhooks(r.data, async () => publicas)).toEqual([]);
  }, LARGO);
});
