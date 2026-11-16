#!/usr/bin/env node
// infra/ops/cable-oficina/puente-prueba.mjs — Paso 2b del cable (SDD-0626): puente interno de PRUEBA.
//
// Elegido por Sam el 2026-11-15 («Opción 3: puente») en lugar de un webhook de Chatwoot por la ruta
// pública. Lee por la API de Chatwoot SOLO la cuenta 2 («DTD Prueba») y SOLO la bandeja 11 («Prueba
// Oficina»), y entrega cada mensaje entrante nuevo al ERP de PRUEBA por la red Docker interna, en
// `POST /api/oficina/webhook-chatwoot`, con la misma firma que Chatwoot 4.19.1
// (`X-Chatwoot-Timestamp` + `X-Chatwoot-Signature: sha256=HMAC(secreto, "<ts>.<cuerpo>")`), para que
// el ERP la valide igual que la de un webhook real.
//
// Lo que NO hace, a propósito:
//   - no escribe en Chatwoot: solo pide GET (`chatwoot()` rechaza cualquier otro método);
//   - no manda el texto del mensaje ni los datos del contacto: el cuerpo lleva solo ids, tipo,
//     estado y etiquetas (lo que el ERP lee; `interpretarEvento` no usa nada más para message_created);
//   - no guarda textos: en disco solo el cursor (el último id de mensaje entregado), y en el log
//     solo ids y códigos;
//   - no corre fuera de prueba: sin PUENTE_ENTORNO=prueba, con otra cuenta u otra bandeja, o con un
//     destino que no sea el web de prueba, falla al arrancar (código 2).
//
// Entorno (en el VPS, /etc/dtd-cable/puente-prueba.env, root 600; nunca en Git ni en el log):
//   PUENTE_ENTORNO=prueba            obligatorio
//   CHATWOOT_API_TOKEN               token de un usuario de la cuenta 2, miembro solo de la bandeja 11
//   OFICINA_WEBHOOK_SECRET           el mismo secreto que el `.env` del ERP de prueba
//   CHATWOOT_API_URL                 por defecto http://rails:3000 (red chatwoot_interna)
//   PUENTE_ERP_URL                   por defecto http://web:3000/api/oficina/webhook-chatwoot
//                                    (red dtd-cargo-staging_dtd_internal)
//   PUENTE_CURSOR                    por defecto /estado/cursor
//   PUENTE_INTERVALO_MS              por defecto 5000
//   PUENTE_UNA_VUELTA=1              una sola vuelta y sale (pruebas y diagnóstico)
//
// Arranque, parada y reversión: infra/ops/cable-oficina/puente-prueba.sh y
// docs/runbooks/oficina-cable.md §9. Se para en un segundo (SIGTERM → sale).
//
// Códigos: 0 salió bien · 2 configuración inválida o fuera de prueba · 3 error que no se puede seguir.

import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Las únicas que el puente atiende (SDD-0626 Paso 2b, OK de Sam y del DG del 2026-11-15). */
export const CUENTA = 2;
export const BANDEJA = 11;
/** Los únicos destinos válidos: el web de PRUEBA por su nombre en la red interna de prueba. */
export const DESTINOS = new Set(["web", "dtd-cargo-staging-web-1"]);
export const RUTA_ERP = "/api/oficina/webhook-chatwoot";

export class ConfigInvalida extends Error {}

const ID = /^[1-9][0-9]{0,9}$/;

/** Lee y valida el entorno. Cualquier duda → ConfigInvalida (el proceso sale con 2). */
export function leerConfig(env = process.env) {
  const t = (k) => (env[k] ?? "").trim();
  if (t("PUENTE_ENTORNO") !== "prueba") throw new ConfigInvalida("PUENTE_ENTORNO tiene que ser «prueba»");
  for (const [k, fijo] of [["PUENTE_CUENTA", CUENTA], ["PUENTE_BANDEJA", BANDEJA]]) {
    if (t(k) !== "" && t(k) !== String(fijo)) throw new ConfigInvalida(`${k} solo puede ser ${fijo}`);
  }
  const token = t("CHATWOOT_API_TOKEN");
  const secreto = t("OFICINA_WEBHOOK_SECRET");
  if (token.length < 16) throw new ConfigInvalida("falta CHATWOOT_API_TOKEN");
  if (secreto.length < 32) throw new ConfigInvalida("falta OFICINA_WEBHOOK_SECRET (32 caracteres o más)");

  const chatwoot = url(t("CHATWOOT_API_URL") || "http://rails:3000", "CHATWOOT_API_URL");
  const erp = url(t("PUENTE_ERP_URL") || `http://web:3000${RUTA_ERP}`, "PUENTE_ERP_URL");
  if (erp.protocol !== "http:" || !DESTINOS.has(erp.hostname) || erp.pathname !== RUTA_ERP || erp.search) {
    throw new ConfigInvalida(`PUENTE_ERP_URL tiene que ser http://web:3000${RUTA_ERP} (el web de prueba)`);
  }
  const intervalo = Number.parseInt(t("PUENTE_INTERVALO_MS") || "5000", 10);
  if (!Number.isFinite(intervalo) || intervalo < 200 || intervalo > 600_000) {
    throw new ConfigInvalida("PUENTE_INTERVALO_MS fuera de rango (200..600000)");
  }
  return {
    token,
    secreto,
    chatwoot: chatwoot.origin,
    erp: erp.href,
    cursor: t("PUENTE_CURSOR") || "/estado/cursor",
    intervalo,
    unaVuelta: t("PUENTE_UNA_VUELTA") === "1",
  };
}

function url(cruda, nombre) {
  try {
    return new URL(cruda);
  } catch {
    throw new ConfigInvalida(`${nombre} no es una URL`);
  }
}

/** La firma de Chatwoot 4.19.1 (`lib/webhooks/trigger.rb`). */
export function firmar(secreto, timestamp, cuerpo) {
  return `sha256=${createHmac("sha256", secreto).update(`${timestamp}.${cuerpo}`).digest("hex")}`;
}

const entero = (v) => (Number.isInteger(v) && v > 0 ? v : null);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

/** En la API de cuenta `message_type` es un número; en el webhook, texto. 0 = incoming. */
const TIPOS = { 0: "incoming", 1: "outgoing", 2: "activity", 3: "template" };

/** ¿El mensaje (de la API) merece entregarse? Entrante, no privado, de la bandeja 11 y más nuevo que el cursor. */
export function esNuevoEntrante(m, cursor) {
  const id = entero(m?.id);
  if (!id || id <= cursor) return false;
  if (m.private === true) return false;
  if (!(m.message_type === 0 || m.message_type === "incoming")) return false;
  const bandeja = entero(m.inbox_id);
  return bandeja === null || bandeja === BANDEJA;
}

/** ¿La conversación (de la API) es de la cuenta 2 y la bandeja 11? */
export function esConversacionDePrueba(c) {
  const cuenta = entero(c?.account_id);
  return entero(c?.id) !== null && entero(c?.inbox_id) === BANDEJA && (cuenta === null || cuenta === CUENTA);
}

/**
 * El cuerpo del `message_created`, con la forma de `Message#webhook_data` de Chatwoot 4.19.1, SIN
 * `content`, `sender`, `contact` ni adjuntos. La conversación lleva solo lo que el ERP interpreta
 * (id, bandeja, estado, no leídos, etiquetas, asignado, equipo y fechas).
 */
export function cuerpoMessageCreated(conversacion, mensaje) {
  const c = conversacion;
  const meta = obj(c.meta) ?? {};
  const asignado = entero(obj(meta.assignee)?.id);
  const equipo = entero(obj(meta.team)?.id);
  return {
    event: "message_created",
    id: mensaje.id,
    message_type: TIPOS[mensaje.message_type] ?? String(mensaje.message_type),
    private: false,
    created_at: mensaje.created_at ?? null,
    account: { id: CUENTA },
    inbox: { id: BANDEJA },
    conversation: {
      id: c.id,
      inbox_id: c.inbox_id,
      status: c.status,
      unread_count: Number.isFinite(c.unread_count) ? c.unread_count : 0,
      labels: Array.isArray(c.labels) ? c.labels.filter((l) => typeof l === "string") : [],
      last_activity_at: c.last_activity_at ?? null,
      updated_at: c.updated_at ?? c.last_activity_at ?? null,
      account: { id: CUENTA },
      meta: { assignee: asignado ? { id: asignado } : null, team: equipo ? { id: equipo } : null },
    },
  };
}

// ─── E/S ─────────────────────────────────────────────────────────────────────

function decir(linea) {
  process.stdout.write(`${new Date().toISOString()} ${linea}\n`);
}

export function leerCursor(ruta) {
  try {
    const s = readFileSync(ruta, "utf8").trim();
    return /^[0-9]{1,12}$/.test(s) ? Number(s) : null;
  } catch {
    return null;
  }
}

export function guardarCursor(ruta, n) {
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  writeFileSync(tmp, `${n}\n`, { mode: 0o600 });
  renameSync(tmp, ruta);
}

/** Solo GET a la API de cuenta de Chatwoot. Cualquier otra cosa no se puede ni pedir. */
async function chatwoot(cfg, ruta) {
  if (!ruta.startsWith(`/api/v1/accounts/${CUENTA}/`)) throw new Error("ruta fuera de la cuenta de prueba");
  const r = await fetch(`${cfg.chatwoot}${ruta}`, {
    method: "GET",
    redirect: "manual",
    // Chatwoot fuerza https: por la red interna, Rails lo acepta con esta cabecera (como detrás de Traefik).
    headers: { api_access_token: cfg.token, "X-Forwarded-Proto": "https", Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (r.status !== 200) throw new Error(`chatwoot ${ruta.split("?")[0].replace(/[0-9]+/g, "<id>")} → ${r.status}`);
  return r.json();
}

async function entregar(cfg, conversacion, mensaje) {
  const cuerpo = JSON.stringify(cuerpoMessageCreated(conversacion, mensaje));
  const ts = String(Math.floor(Date.now() / 1000));
  const r = await fetch(cfg.erp, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "dtd-cable-puente-prueba",
      "X-Chatwoot-Timestamp": ts,
      "X-Chatwoot-Signature": firmar(cfg.secreto, ts, cuerpo),
    },
    body: cuerpo,
    signal: AbortSignal.timeout(15_000),
  });
  let resultado = "";
  try {
    const j = await r.json();
    resultado = String(j.resultado ?? j.ignorado ?? j.omitido ?? j.error ?? "").replace(/[^a-z_]/g, "").slice(0, 30);
  } catch {
    /* sin cuerpo JSON */
  }
  return { status: r.status, resultado };
}

/** Una vuelta: conversaciones de la bandeja 11 → mensajes nuevos → entrega en orden de id. */
export async function vuelta(cfg, cursor) {
  const lista = await chatwoot(cfg, `/api/v1/accounts/${CUENTA}/conversations?inbox_id=${BANDEJA}&status=all&page=1`);
  const conversaciones = (obj(lista?.data)?.payload ?? []).filter(esConversacionDePrueba);
  const pendientes = [];
  for (const c of conversaciones) {
    const ms = await chatwoot(cfg, `/api/v1/accounts/${CUENTA}/conversations/${c.id}/messages`);
    for (const m of ms?.payload ?? []) if (esNuevoEntrante(m, cursor)) pendientes.push([c, m]);
  }
  pendientes.sort((a, b) => a[1].id - b[1].id);
  let nuevo = cursor;
  for (const [c, m] of pendientes) {
    const { status, resultado } = await entregar(cfg, c, m);
    decir(`entrega conv=${c.id} msg=${m.id} → ${status} ${resultado}`);
    // 5xx: se reintenta en la próxima vuelta (no se avanza). 2xx y 4xx: se avanza (un 4xx no se
    // arregla reintentando; queda en el log con su código).
    if (status >= 500) break;
    nuevo = m.id;
  }
  return { cursor: nuevo, conversaciones: conversaciones.length, entregados: pendientes.length };
}

/** El primer arranque no reenvía la historia: el cursor empieza en el último entrante que ya existe. */
async function cursorInicial(cfg) {
  const lista = await chatwoot(cfg, `/api/v1/accounts/${CUENTA}/conversations?inbox_id=${BANDEJA}&status=all&page=1`);
  let max = 0;
  for (const c of (obj(lista?.data)?.payload ?? []).filter(esConversacionDePrueba)) {
    const ms = await chatwoot(cfg, `/api/v1/accounts/${CUENTA}/conversations/${c.id}/messages`);
    for (const m of ms?.payload ?? []) if (entero(m?.id) && m.id > max) max = m.id;
  }
  return max;
}

async function main() {
  let cfg;
  try {
    cfg = leerConfig();
  } catch (e) {
    process.stderr.write(`puente-prueba: ${e instanceof ConfigInvalida ? e.message : "configuración inválida"}\n`);
    process.exit(2);
  }
  let parar = false;
  const salir = () => {
    decir("parada pedida: salgo");
    process.exit(0);
  };
  process.on("SIGTERM", salir);
  process.on("SIGINT", salir);

  let cursor = leerCursor(cfg.cursor);
  if (cursor === null) {
    cursor = await cursorInicial(cfg);
    guardarCursor(cfg.cursor, cursor);
    decir(`cursor inicial ${cursor} (no se reenvía la historia)`);
  }
  decir(`arranque · cuenta ${CUENTA} · bandeja ${BANDEJA} · cursor ${cursor} · cada ${cfg.intervalo} ms`);
  while (!parar) {
    try {
      const r = await vuelta(cfg, cursor);
      if (r.cursor !== cursor) {
        cursor = r.cursor;
        guardarCursor(cfg.cursor, cursor);
      }
    } catch (e) {
      decir(`vuelta fallida: ${mensajeSeguro(e)}`);
    }
    if (cfg.unaVuelta) parar = true;
    else await new Promise((r) => setTimeout(r, cfg.intervalo));
  }
}

/** Solo los mensajes propios (rutas con ids enmascarados y códigos) o el código del error; nunca un cuerpo. */
export function mensajeSeguro(e) {
  if (e instanceof Error && /^(chatwoot|ruta) /.test(e.message)) return e.message;
  const codigo = e?.cause?.code ?? e?.code ?? e?.name ?? "error";
  return String(codigo).replace(/[^A-Za-z0-9_]/g, "").slice(0, 40) || "error";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    process.stderr.write(`puente-prueba: error al arrancar: ${mensajeSeguro(e)}\n`);
    process.exit(3);
  });
}
