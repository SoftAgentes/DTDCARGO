// Fase D del ensayo local (SDD-0583): claves y tokens SINTÉTICOS de «Cloudflare Access».
//   node firmar-jwt-prueba.mjs <carpeta> <team> <aud> <correo>
// Escribe <carpeta>/cdn-cgi/access/certs (las JWK públicas, como las publica Cloudflare) y
// <carpeta>/tokens.env con un token por caso. Nada de esto sirve fuera de la prueba.
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [carpeta, team, aud, correo] = process.argv.slice(2);
if (!carpeta || !team || !aud || !correo) { console.error("uso: firmar-jwt-prueba.mjs <carpeta> <team> <aud> <correo>"); process.exit(2); }

function par(kid) {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" } };
}
const propia = par("kid-prueba-1"), ajena = par("kid-prueba-1"); // ajena: mismo kid, otra clave
const ahora = Math.floor(Date.now() / 1000);
function firmar(carga, clave = propia) {
  const h = Buffer.from(JSON.stringify({ alg: "RS256", kid: clave.kid, typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify(carga)).toString("base64url");
  return `${h}.${p}.${sign("RSA-SHA256", Buffer.from(`${h}.${p}`), clave.privateKey).toString("base64url")}`;
}
const base = { aud: [aud], iss: team, email: correo, iat: ahora - 5, nbf: ahora - 5, exp: ahora + 3600, type: "app" };

mkdirSync(join(carpeta, "cdn-cgi", "access"), { recursive: true });
writeFileSync(join(carpeta, "cdn-cgi", "access", "certs"), JSON.stringify({ keys: [propia.jwk], public_cert: {}, public_certs: [] }));
const tokens = {
  VALIDO: firmar(base),
  AUD_MALA: firmar({ ...base, aud: ["otra-aplicacion"] }),
  ISS_MALO: firmar({ ...base, iss: "https://otro-equipo.cloudflareaccess.com" }),
  VENCIDO: firmar({ ...base, iat: ahora - 7200, nbf: ahora - 7200, exp: ahora - 3600 }),
  FIRMA_AJENA: firmar(base, ajena),
  CORREO_AJENO: firmar({ ...base, email: "intruso.sintetico@example.test" }),
};
writeFileSync(join(carpeta, "tokens.env"), Object.entries(tokens).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
console.log("tokens:", Object.keys(tokens).join(" "));
