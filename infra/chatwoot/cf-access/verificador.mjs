// infra/chatwoot/cf-access/verificador.mjs — verifica el JWT de Cloudflare Access para
// /super_admin de Chatwoot (SDD-0583, alternativa a Tailscale en la puerta P3).
//
// Por qué hace falta: el VPS acepta 80/443 de CUALQUIER IP de Cloudflare
// (cloudflare-origin-firewall), también de otras cuentas de Cloudflare. Que la petición
// venga «por Cloudflare» no prueba que pasó por Access. Lo único que lo prueba es la
// cabecera Cf-Access-Jwt-Assertion firmada por el team domain de DTD, con la AUD de la app.
//
// Traefik lo llama como forwardAuth (labels en compose.yml) antes de abrir /super_admin:
//   GET /verificar  → 200 si el JWT es válido; 403 si no (o si algo falla: cierra).
//   GET /salud      → 200 (healthcheck; no verifica nada).
// Sin dependencias: node:crypto verifica RS256 con las JWK que publica Cloudflare en
// <team>/cdn-cgi/access/certs.
//
// Entorno:
//   CF_ACCESS_TEAM_DOMAIN  https://<equipo>.cloudflareaccess.com (también es el `iss`)
//   CF_ACCESS_AUD          la «Application Audience (AUD) Tag» de la app de Access
//   CF_ACCESS_EMAILS       (opcional) correos admitidos, separados por coma: segunda red
//                          además de la política de Access
//   PORT                   8080
//   CF_ACCESS_PERMITIR_HTTP=1  solo para la prueba local (JWKS por http)
// El log dice «permitido» o «denegado: <razón>», nunca el token ni el correo.

import { createPublicKey, verify } from "node:crypto";
import { createServer } from "node:http";

const HOLGURA_S = 60;

export function decodificar(token) {
  const partes = String(token ?? "").split(".");
  if (partes.length !== 3) throw new Error("formato");
  const json = (b) => JSON.parse(Buffer.from(b, "base64url").toString("utf8"));
  return { cabecera: json(partes[0]), carga: json(partes[1]), firmado: `${partes[0]}.${partes[1]}`, firma: Buffer.from(partes[2], "base64url") };
}

// Devuelve { ok: true, email } o { ok: false, razon }. `jwks` es { keys: [...] }.
export function verificarToken(token, { jwks, aud, iss, emails = [], ahora = Date.now() / 1000 }) {
  let t;
  try { t = decodificar(token); } catch { return { ok: false, razon: "token ilegible" }; }
  const { cabecera, carga } = t;
  if (cabecera.alg !== "RS256") return { ok: false, razon: "algoritmo no admitido" };
  const jwk = (jwks?.keys ?? []).find((k) => k.kid === cabecera.kid && k.kty === "RSA");
  if (!jwk) return { ok: false, razon: "kid desconocido" };
  let clave;
  try { clave = createPublicKey({ key: jwk, format: "jwk" }); } catch { return { ok: false, razon: "jwk inválida" }; }
  if (!verify("RSA-SHA256", Buffer.from(t.firmado), clave, t.firma)) return { ok: false, razon: "firma inválida" };
  const auds = Array.isArray(carga.aud) ? carga.aud : [carga.aud];
  if (!auds.includes(aud)) return { ok: false, razon: "aud distinta" };
  if (carga.iss !== iss) return { ok: false, razon: "iss distinto" };
  if (typeof carga.exp !== "number" || carga.exp < ahora - HOLGURA_S) return { ok: false, razon: "vencido" };
  if (typeof carga.nbf === "number" && carga.nbf > ahora + HOLGURA_S) return { ok: false, razon: "todavía no vale" };
  if (typeof carga.iat === "number" && carga.iat > ahora + HOLGURA_S) return { ok: false, razon: "emitido en el futuro" };
  const correo = String(carga.email ?? "").toLowerCase();
  if (emails.length > 0 && !emails.includes(correo)) return { ok: false, razon: "correo no admitido" };
  return { ok: true, email: correo };
}

// Caché de las claves públicas: 10 min, y una recarga por kid desconocido como máximo cada 30 s
// (Cloudflare rota las claves; un kid nuevo no debe dejar a Sam afuera ni permitir un martilleo).
export function crearCacheJwks(url, { obtener = fetch, ttlMs = 600_000, minRecargaMs = 30_000 } = {}) {
  let jwks = null, cargadoEn = 0;
  async function cargar() {
    const r = await obtener(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`certs ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j.keys)) throw new Error("certs sin keys");
    jwks = j; cargadoEn = Date.now();
  }
  return async function claves(kidBuscado) {
    const viejo = Date.now() - cargadoEn;
    if (!jwks || viejo > ttlMs) await cargar();
    else if (kidBuscado && !jwks.keys.some((k) => k.kid === kidBuscado) && viejo >= minRecargaMs) await cargar();
    return jwks;
  };
}

export function configDesdeEntorno(env = process.env) {
  const equipo = String(env.CF_ACCESS_TEAM_DOMAIN ?? "").replace(/\/+$/, "");
  const aud = String(env.CF_ACCESS_AUD ?? "").trim();
  if (!equipo || !aud) throw new Error("faltan CF_ACCESS_TEAM_DOMAIN o CF_ACCESS_AUD");
  if (!equipo.startsWith("https://") && env.CF_ACCESS_PERMITIR_HTTP !== "1") throw new Error("CF_ACCESS_TEAM_DOMAIN debe ser https");
  const emails = String(env.CF_ACCESS_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return { equipo, aud, emails, puerto: Number(env.PORT ?? 8080) };
}

export function crearServidor({ equipo, aud, emails, claves, log = console.log }) {
  return createServer(async (req, res) => {
    const ruta = (req.url ?? "").split("?")[0];
    if (ruta === "/salud") { res.writeHead(200).end("ok"); return; }
    if (ruta !== "/verificar") { res.writeHead(404).end(); return; }
    const token = req.headers["cf-access-jwt-assertion"];
    let r;
    if (!token) r = { ok: false, razon: "sin cabecera" };
    else {
      try {
        const { cabecera } = decodificar(token);
        r = verificarToken(token, { jwks: await claves(cabecera.kid), aud, iss: equipo, emails });
      } catch (e) {
        r = { ok: false, razon: e.message === "formato" ? "token ilegible" : "no se pudieron leer las claves" };
      }
    }
    log(r.ok ? "permitido" : `denegado: ${r.razon}`);
    res.writeHead(r.ok ? 200 : 403, { "content-type": "text/plain" }).end(r.ok ? "ok" : "acceso denegado");
  });
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("verificador.mjs")) {
  const cfg = configDesdeEntorno();
  const claves = crearCacheJwks(`${cfg.equipo}/cdn-cgi/access/certs`);
  crearServidor({ ...cfg, claves }).listen(cfg.puerto, () => console.log(`verificador de Access escuchando en :${cfg.puerto}`));
}
