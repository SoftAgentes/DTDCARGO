#!/usr/bin/env node
/**
 * SDD-0608 · Registra el comando `/cliente` en el servidor de DTD Cargo.
 *
 * Discord no deja crear comandos desde el portal: se registran por su API. Este
 * script lo hace una vez (y otra si cambia la definición), con la aplicación
 * PROPIA del Studio, no con ALFRED.
 *
 * Uso (lo corre Sam o el Director, nunca el CI):
 *
 *   DISCORD_CONSULTA_APPLICATION_ID=… DISCORD_CONSULTA_CLIENT_SECRET=… \
 *     node scripts/discord/registrar-comando-cliente.mjs
 *
 *   node scripts/discord/registrar-comando-cliente.mjs --dry-run   # sólo muestra qué mandaría
 *
 * Pide un token de corta vida con la credencial de cliente (OAuth2
 * `client_credentials`, alcance `applications.commands.update`) y reemplaza
 * los comandos de ESTA aplicación en ESE servidor por el de
 * `lib/studio/discord/consulta/comando-cliente.json`. No toca comandos de otras
 * aplicaciones (ALFRED sigue igual). No imprime credenciales ni el token.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const COMANDO = JSON.parse(
  readFileSync(resolve(ROOT, "lib/studio/discord/consulta/comando-cliente.json"), "utf8"),
);
const GUILD_ID = "1534936818951262390";
const API = "https://discord.com/api/v10";
const SNOWFLAKE = /^[0-9]{17,20}$/;

function salir(mensaje, codigo = 1) {
  console.error(mensaje);
  process.exit(codigo);
}

const dryRun = process.argv.includes("--dry-run");
const appId = process.env.DISCORD_CONSULTA_APPLICATION_ID ?? "";
const destino = `${API}/applications/${appId || "<APPLICATION_ID>"}/guilds/${GUILD_ID}/commands`;

if (dryRun) {
  console.log(`PUT ${destino}`);
  console.log(JSON.stringify([COMANDO], null, 2));
  process.exit(0);
}

if (!SNOWFLAKE.test(appId)) salir("Falta DISCORD_CONSULTA_APPLICATION_ID (17 a 20 dígitos).");
const secreto = process.env.DISCORD_CONSULTA_CLIENT_SECRET ?? "";
if (!secreto) salir("Falta DISCORD_CONSULTA_CLIENT_SECRET.");

const tokenRes = await fetch(`${API}/oauth2/token`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: `Basic ${Buffer.from(`${appId}:${secreto}`).toString("base64")}`,
  },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    scope: "applications.commands.update",
  }),
});
if (!tokenRes.ok) salir(`Discord no entregó el token (HTTP ${tokenRes.status}). Revisa el ID y el secreto.`);
const { access_token: token } = await tokenRes.json();
if (!token) salir("Discord respondió sin token.");

const res = await fetch(destino, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify([COMANDO]),
});
if (!res.ok) {
  salir(
    `Discord rechazó el registro (HTTP ${res.status}). ` +
      "¿La aplicación está instalada en el servidor con el alcance applications.commands?",
  );
}
const creados = await res.json();
for (const c of creados) console.log(`Registrado: /${c.name} (id ${c.id}) en el servidor ${GUILD_ID}.`);
