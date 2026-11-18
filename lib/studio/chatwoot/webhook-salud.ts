import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { ChatwootConfig } from "./config";
import type { AlertaSalud, SaludBandeja } from "./agentes-salud";
import { obtenerTokenAgente } from "./platform-api";
import { listarWebhooksCuenta, type WebhookCuenta } from "./router-api";

/**
 * La salud del webhook de cuenta (SDD-0586, paso 10.5, PR 1b: el riesgo del webhook).
 *
 * Todo lo que llega de Chatwoot a Studio, la Bandeja de E2 y la vuelta del portal, entra por el
 * webhook de cuenta. Chatwoot 4.19.1 no lo reintenta y no lo entrega a un host sin IP pública
 * («has no public ip addresses», su protección contra SSRF; medido en la PoC de la 1a, run
 * 42415834528). Si falta, nada avisa: el portal se queda sin respuestas en silencio. Por eso la
 * salud lo mira:
 *
 *   - `webhook_falta`: ningún webhook de cuenta apunta a `/api/chatwoot/webhook`;
 *   - `webhook_sin_mensajes`: el que apunta no tiene `message_created`;
 *   - `webhook_sin_ip_publica`: su host no resuelve a ninguna IP pública;
 *   - `webhook_no_medido`: no se pudo leer la lista (sin usuario de servicio, sin su token o
 *     Chatwoot no contestó). Un vigilante que no mide también avisa.
 *
 * La lista la lee el usuario de servicio de E1, que es administrador de la cuenta: su token se
 * pide por la Platform API, no se guarda y no sale de aquí. De cada webhook solo se mira la URL y
 * sus eventos; el `secret` no se lee.
 */

export const RUTA_WEBHOOK = "/api/chatwoot/webhook";

export type AlertaWebhook = Extract<
  AlertaSalud,
  "webhook_falta" | "webhook_sin_mensajes" | "webhook_sin_ip_publica" | "webhook_no_medido"
>;

/** Redes que la protección contra SSRF de Chatwoot (gema `ssrf_filter`) no deja usar. */
const PRIVADAS_V4: readonly [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function v4(ip: string): number | null {
  const partes = ip.split(".");
  if (partes.length !== 4) return null;
  let n = 0;
  for (const p of partes) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n;
}

function enRedV4(ip: number, base: string, bits: number): boolean {
  const b = v4(base);
  if (b === null) return false;
  const tam = 2 ** (32 - bits);
  return Math.floor(ip / tam) === Math.floor(b / tam);
}

/** Los 8 grupos de 16 bits de una IPv6, o null. Acepta `::` y una IPv4 al final. */
function v6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  const cola: number[] = [];
  const m = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (m) {
    const n = v4(m[2]);
    if (n === null) return null;
    cola.push(Math.floor(n / 65536), n % 65536);
    s = m[1].endsWith("::") ? m[1] : m[1].slice(0, -1);
  }
  const [izq, der, ...resto] = s.split("::");
  if (resto.length > 0) return null;
  const grupos = (t: string) => (t === "" ? [] : t.split(":").map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN)));
  const a = grupos(izq);
  const b = der === undefined ? [] : grupos(der);
  const faltan = 8 - a.length - b.length - cola.length;
  if ([...a, ...b].some(Number.isNaN) || faltan < 0 || (der === undefined && faltan !== 0)) return null;
  return [...a, ...Array<number>(der === undefined ? 0 : faltan).fill(0), ...b, ...cola];
}

/** ¿Chatwoot entregaría a esta IP? Una IP que no se entiende cuenta como no pública. */
export function esIpPublica(ip: string): boolean {
  if (isIP(ip) === 4) {
    const n = v4(ip);
    if (n === null || n === 0xffffffff) return false;
    return !PRIVADAS_V4.some(([base, bits]) => enRedV4(n, base, bits));
  }
  const g = v6(ip);
  if (!g) return false;
  // Una IPv4 dentro de IPv6 (::ffff:a.b.c.d) se mira como IPv4.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return esIpPublica(`${Math.floor(g[6] / 256)}.${g[6] % 256}.${Math.floor(g[7] / 256)}.${g[7] % 256}`);
  }
  if (g.every((x) => x === 0)) return false; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return false; // ::1
  const [a, b] = g;
  if ((a & 0xfe00) === 0xfc00) return false; // fc00::/7
  if ((a & 0xffc0) === 0xfe80) return false; // fe80::/10
  if ((a & 0xff00) === 0xff00) return false; // ff00::/8
  if (a === 0x2001 && b === 0x0db8) return false; // 2001:db8::/32
  if (a === 0x2001 && b === 0) return false; // 2001::/32
  if (a === 0x2001 && (b & 0xfff0) === 0x0010) return false; // 2001:10::/28
  if (a === 0x2002) return false; // 2002::/16
  if (a === 0x0064 && b === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return false; // 64:ff9b::/96
  if (a === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return false; // 100::/64
  return true;
}

export type Resolver = (host: string) => Promise<string[]>;

const TIEMPO_DNS_MS = 5_000;

/** Las IP de un host, con un tope de tiempo. Lo que no resuelve da una lista vacía. */
export const resolverDns: Resolver = async (host) => {
  if (isIP(host)) return [host];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const r = await Promise.race([
      lookup(host, { all: true, verbatim: true }),
      new Promise<never>((_, rechazar) => {
        timer = setTimeout(() => rechazar(new Error("dns")), TIEMPO_DNS_MS);
      }),
    ]);
    return r.map((d) => d.address);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
};

/** Pura, salvo la resolución: qué le falta al webhook de cuenta de Studio. */
export async function evaluarWebhooks(webhooks: readonly WebhookCuenta[], resolver: Resolver): Promise<AlertaWebhook[]> {
  const nuestros: { webhook: WebhookCuenta; host: string }[] = [];
  for (const w of webhooks) {
    if (w.deBandeja) continue;
    let url: URL;
    try {
      url = new URL(w.url);
    } catch {
      continue;
    }
    if (url.pathname.replace(/\/+$/, "") === RUTA_WEBHOOK) nuestros.push({ webhook: w, host: url.hostname.replace(/^\[|\]$/g, "") });
  }
  if (nuestros.length === 0) return ["webhook_falta"];
  const conMensajes = nuestros.filter((n) => n.webhook.eventos.includes("message_created"));
  if (conMensajes.length === 0) return ["webhook_sin_mensajes"];
  for (const n of conMensajes) {
    if ((await resolver(n.host)).some(esIpPublica)) return [];
  }
  return ["webhook_sin_ip_publica"];
}

/**
 * Suma las alertas del webhook a la salud. Si Chatwoot ya no responde, «no se pudo revisar el
 * webhook» es la misma causa y no se repite.
 */
export function sumarAlertasWebhook(salud: SaludBandeja, alertas: readonly AlertaWebhook[]): void {
  for (const a of alertas) {
    if (a === "webhook_no_medido" && salud.alertas.includes("chatwoot_no_responde")) continue;
    if (!salud.alertas.includes(a)) salud.alertas.push(a);
  }
}

/** Lee los webhooks como el usuario de servicio y los evalúa. Nunca lanza. */
export async function revisarWebhookCuenta(
  cfg: ChatwootConfig,
  servicioId: number | null,
  resolver: Resolver = resolverDns,
): Promise<AlertaWebhook[]> {
  if (servicioId === null) return ["webhook_no_medido"];
  try {
    const token = await obtenerTokenAgente(servicioId, cfg);
    if (!token.ok) return ["webhook_no_medido"];
    const lista = await listarWebhooksCuenta({ origin: cfg.origin, accountId: cfg.accountId, token: token.data });
    if (!lista.ok) return ["webhook_no_medido"];
    return await evaluarWebhooks(lista.data, resolver);
  } catch {
    return ["webhook_no_medido"];
  }
}
