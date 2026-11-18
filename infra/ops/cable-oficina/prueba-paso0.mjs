#!/usr/bin/env node
// infra/ops/cable-oficina/prueba-paso0.mjs — Paso 0 del cable (SDD-0626 §3.0 y §9).
//
// El ERP (VPS DTD) llama al runtime de la oficina (agente `soporte-chatwoot`) por
// el túnel y comprueba que responde sin correr el modelo (GET /v1/models, 0 tokens):
//
//   a) 3 × GET <URL>/v1/models con la llave: cada una 200, en ≤ 10 s, y la lista
//      trae el perfil `soporte-chatwoot`;
//   b) 1 × la misma llamada sin llave: tiene que dar 401;
//   c) si el túnel está caído, lo dice con un mensaje claro;
//   d) imprime tiempos y PASA o FALLA por llamada. Nunca imprime la llave.
//
// Lee del entorno OFICINA_RUNTIME_URL y OFICINA_RUNTIME_TOKEN (convención de secretos:
// /srv/dtd-cargo/.env, 0600; ver docs/runbooks/oficina-cable.md). Sin dependencias:
// corre con el Node de la imagen del ERP, dentro del contenedor `web`, como su usuario:
//
//   docker exec -i --env-file <(grep -E '^OFICINA_RUNTIME_(URL|TOKEN)=' /srv/dtd-cargo/.env) \
//     dtd-cargo-web-1 node --input-type=module - < /srv/ops/cable-oficina/prueba-paso0.mjs
//
// Opcionales (las usan las pruebas): CABLE_PRUEBA_TOPE_MS (10000), CABLE_PRUEBA_PERFIL
// (soporte-chatwoot), CABLE_PRUEBA_LLAMADAS (3).
//
// Códigos: 0 todo PASA · 1 alguna llamada FALLA · 2 configuración inválida ·
//          3 el túnel está caído (nada responde en la dirección del túnel).

import { hostname, userInfo } from "node:os";

const ENV = process.env;
const TOPE_MS = entero(ENV.CABLE_PRUEBA_TOPE_MS, 10_000);
const PERFIL = (ENV.CABLE_PRUEBA_PERFIL || "soporte-chatwoot").trim();
const LLAMADAS = entero(ENV.CABLE_PRUEBA_LLAMADAS, 3);
const LLAVE = (ENV.OFICINA_RUNTIME_TOKEN ?? "").trim();
const URL_CRUDA = (ENV.OFICINA_RUNTIME_URL ?? "").trim();

// Errores de conexión que significan «nada escucha o la conexión se cayó»: el túnel
// (oficina-cable-tunel) está caído o reconectando. Tarda ~16 s en volver tras un corte.
// ssh -L acepta la conexión local y la cierra si no logra abrir el canal hasta la
// oficina: eso llega como ECONNRESET (Windows) o UND_ERR_SOCKET (Linux).
const SIN_TUNEL = new Set(["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH"]);
const CORTADA = new Set(["ECONNRESET", "EPIPE", "UND_ERR_SOCKET", "UND_ERR_CLOSED"]);

function entero(valor, porDefecto) {
  const n = Number.parseInt(String(valor ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

/** Ningún texto que sale por pantalla puede llevar la llave, ni por accidente. */
function sinLlave(texto) {
  const s = String(texto);
  return LLAVE.length >= 4 ? s.split(LLAVE).join("[llave oculta]") : s;
}

function decir(linea = "") {
  process.stdout.write(`${sinLlave(linea)}\n`);
}

function base(cruda) {
  let u;
  try {
    u = new URL(cruda);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || u.search || u.hash) return null;
  return u.origin + u.pathname.replace(/\/+$/, "");
}

/** Clasifica un fallo de fetch: { tunel: bool, motivo }. */
function motivoDeFallo(err) {
  if (err?.name === "TimeoutError" || err?.name === "AbortError") {
    return { tunel: false, motivo: `sin respuesta en ${TOPE_MS} ms (firewall que descarta, oficina colgada o túnel a medias)` };
  }
  const codigo = err?.cause?.code ?? err?.code ?? "";
  if (SIN_TUNEL.has(codigo)) {
    return {
      tunel: true,
      motivo: `${codigo}: nada responde en la dirección del túnel. El túnel oficina-cable-tunel está caído o reconectando (vuelve en ~16 s tras un corte)`,
    };
  }
  if (CORTADA.has(codigo)) {
    return {
      tunel: true,
      motivo: `${codigo}: el túnel aceptó la conexión y la cerró sin respuesta. La oficina no contestó por el túnel (sesión SSH reconectando o gateway soporte-chatwoot caído)`,
    };
  }
  const causa = err?.cause?.message ? ` (${err.cause.message})` : "";
  return { tunel: false, motivo: `${err?.name ?? "Error"}${codigo ? ` ${codigo}` : ""}: ${err?.message ?? "fallo de red"}${causa}` };
}

async function llamar(destino, conLlave) {
  const cabeceras = { accept: "application/json" };
  if (conLlave) cabeceras.authorization = `Bearer ${LLAVE}`;
  const t0 = performance.now();
  try {
    const r = await fetch(`${destino}/v1/models`, {
      headers: cabeceras,
      signal: AbortSignal.timeout(TOPE_MS),
      redirect: "manual",
    });
    // El cuerpo se lee dentro del mismo tope; nunca se imprime.
    const cuerpo = await r.text();
    return { ms: Math.round(performance.now() - t0), status: r.status, cuerpo };
  } catch (err) {
    return { ms: Math.round(performance.now() - t0), error: motivoDeFallo(err) };
  }
}

function perfilesDe(cuerpo) {
  try {
    const json = JSON.parse(cuerpo);
    return Array.isArray(json?.data) ? json.data.map((m) => m?.id).filter((id) => typeof id === "string") : null;
  } catch {
    return null;
  }
}

const destino = base(URL_CRUDA);
decir(`Paso 0 del cable (SDD-0626) · ${new Date().toISOString()}`);
if (!destino) {
  decir("FALLA · OFICINA_RUNTIME_URL falta o no es una URL http(s) sin usuario, query ni fragmento.");
  process.exit(2);
}
if (!LLAVE) {
  decir("FALLA · OFICINA_RUNTIME_TOKEN falta o está vacía.");
  process.exit(2);
}
let quien = "desconocido";
try {
  const u = userInfo();
  quien = `uid=${u.uid} usuario=${u.username}`;
} catch {
  // sin entrada en /etc/passwd: se deja «desconocido».
}
decir(`Contexto: ${quien} · host=${hostname()} · node ${process.version}`);
decir(`Destino: ${destino} · perfil esperado: ${PERFIL} · tope ${TOPE_MS} ms por llamada`);
decir("Llave: presente (no se muestra)");
decir("");

let pasan = 0;
let total = 0;
let tunelCaido = null;

for (let i = 1; i <= LLAMADAS; i++) {
  total++;
  const r = await llamar(destino, true);
  const etiqueta = `[${i}/${LLAMADAS}] GET /v1/models con llave`;
  if (r.error) {
    if (r.error.tunel) tunelCaido ??= r.error.motivo;
    decir(`${etiqueta} → sin respuesta · ${r.ms} ms · FALLA · ${r.error.motivo}`);
    continue;
  }
  const perfiles = perfilesDe(r.cuerpo);
  const tienePerfil = perfiles?.includes(PERFIL) ?? false;
  const ok = r.status === 200 && tienePerfil && r.ms <= TOPE_MS;
  const detalle =
    r.status !== 200
      ? `se esperaba 200`
      : perfiles === null
        ? "la respuesta no es una lista de modelos en JSON"
        : tienePerfil
          ? `${PERFIL} presente`
          : `${PERFIL} NO está en la lista (${perfiles.length} perfiles)`;
  if (ok) pasan++;
  decir(`${etiqueta} → ${r.status} · ${r.ms} ms · ${detalle} · ${ok ? "PASA" : "FALLA"}`);
}

total++;
{
  const r = await llamar(destino, false);
  const etiqueta = "[sin llave] GET /v1/models sin llave";
  if (r.error) {
    if (r.error.tunel) tunelCaido ??= r.error.motivo;
    decir(`${etiqueta} → sin respuesta · ${r.ms} ms · FALLA · ${r.error.motivo}`);
  } else {
    const ok = r.status === 401;
    if (ok) pasan++;
    decir(`${etiqueta} → ${r.status} · ${r.ms} ms · ${ok ? "rechazada · PASA" : "se esperaba 401 · FALLA"}`);
  }
}

decir("");
if (tunelCaido) {
  decir(`TÚNEL CAÍDO · ${tunelCaido}.`);
  decir("Revisa en el host: systemctl status oficina-cable-tunel (y el runbook docs/runbooks/oficina-cable.md).");
}
decir(`RESULTADO: ${pasan === total ? "PASA" : "FALLA"} (${pasan} de ${total})`);
process.exit(pasan === total ? 0 : tunelCaido ? 3 : 1);
