#!/usr/bin/env node
/**
 * SDD-0510 · Reproducción local del selector vacío de «Generar Bill of Lading».
 *
 * Levanta un Postgres y un PostgREST EFÍMEROS en Docker (nunca producción),
 * crea el enum `shipment_status` copiándolo TAL CUAL de
 * `supabase/migrations/0002_shipments.sql`, siembra cuatro embarques de prueba
 * y corre con la supabase-js real del repo dos cadenas:
 *
 *   A · la de main:    .not("status", "in", "(entregado,cancelado)")
 *   B · la corregida:  .not("status", "in", "(delivered,cancelled)")
 *                      .is("deleted_at", null)
 *
 * Esperado: A devuelve error 22P02 y `data: null` (el modal lo convierte en
 * «No hay embarques activos»); B devuelve sólo el embarque vivo y abierto.
 * Sale 0 si las dos cosas se cumplen y 1 si no.
 *
 * Requisitos: Docker con `postgres:17` y `postgrest/postgrest:v16.1` ya
 * descargadas (`--pull never`: no baja nada). La base vive en una red
 * `--internal`; PostgREST se publica sólo en 127.0.0.1. Las contraseñas y el
 * secreto del JWT son aleatorios por corrida y no se imprimen. Todo se borra
 * al final, también si algo falla.
 *
 * Uso, desde la raíz del repo:
 *   node docs/specs/0510-generar-bl-envios-enum/evidencia/reproducir-postgrest.mjs
 */

import { spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const MIGRACIONES = join(RAIZ, "supabase/migrations");
const IMG_DB = "postgres:17";
const IMG_REST = "postgrest/postgrest:v16.1";

const sufijo = randomBytes(3).toString("hex");
const RED = `dtd0510-int-${sufijo}`;
const DB = `dtd0510-db-${sufijo}`;
const REST = `dtd0510-rest-${sufijo}`;

function docker(args, opts = {}) {
  const r = spawnSync("docker", args, { encoding: "utf8", ...opts });
  if (r.error) throw r.error;
  return r;
}

function dockerOk(args, opts) {
  const r = docker(args, opts);
  if (r.status !== 0) {
    throw new Error(`docker ${args[0]} salió ${r.status}: ${r.stderr.trim()}`);
  }
  return r.stdout.trim();
}

const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** El `create type shipment_status as enum (...)` de la 0002, sin comentarios. */
function enumDeLa0002() {
  const sql = readFileSync(join(MIGRACIONES, "0002_shipments.sql"), "utf8");
  const m = sql.match(/create type shipment_status as enum \(([\s\S]*?)\);/);
  if (!m) throw new Error("no encontré el enum shipment_status en la 0002");
  const etiquetas = [...m[1].replace(/--.*$/gm, "").matchAll(/'([^']+)'/g)].map((x) => x[1]);
  return { ddl: `create type shipment_status as enum (${etiquetas.map((e) => `'${e}'`).join(", ")});`, etiquetas };
}

/** Migraciones que alteran el enum después de la 0002 (se espera ninguna). */
function alteracionesDelEnum() {
  return readdirSync(MIGRACIONES)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => /alter\s+type\s+(public\.)?shipment_status\b/i.test(readFileSync(join(MIGRACIONES, f), "utf8")));
}

function b64url(x) {
  return Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");
}

function jwtAnon(secreto) {
  const cuerpo = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({
    role: "anon",
    iss: "dtd-sdd-0510-local",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}`;
  return `${cuerpo}.${createHmac("sha256", secreto).update(cuerpo).digest("base64url")}`;
}

function limpiar() {
  docker(["rm", "-f", REST, DB]);
  docker(["network", "rm", RED]);
}

async function main() {
  const { ddl, etiquetas } = enumDeLa0002();
  const alteraciones = alteracionesDelEnum();
  console.log(`enum shipment_status (0002): ${etiquetas.join(", ")}`);
  console.log(`migraciones que alteran el enum después: ${alteraciones.length ? alteraciones.join(", ") : "ninguna"}`);

  const pgPass = randomBytes(18).toString("hex");
  const authPass = randomBytes(18).toString("hex");
  const jwtSecret = randomBytes(32).toString("hex");

  dockerOk(["network", "create", "--internal", RED]);
  dockerOk(["run", "-d", "--pull", "never", "--name", DB, "--network", RED, "--network-alias", "db",
    "-e", `POSTGRES_PASSWORD=${pgPass}`, IMG_DB]);

  let lista = false;
  for (let i = 0; i < 60 && !lista; i++) {
    lista = docker(["exec", DB, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]).status === 0;
    if (!lista) dormir(1000);
  }
  if (!lista) throw new Error("Postgres no respondió en 60 s");

  const esquema = `
create role anon nologin;
create role authenticator login noinherit password '${authPass}';
grant anon to authenticator;
${ddl}
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  client_name text,
  destination text,
  status shipment_status not null default 'draft',
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
grant usage on schema public to anon;
grant select on public.shipments to anon;
insert into public.shipments (code, client_name, destination, status, deleted_at, created_at) values
  ('BL-VIVO',       'Cliente Prueba A', 'Valencia', 'in_transit', null,  '2026-10-04'),
  ('BL-ENTREGADO',  'Cliente Prueba B', 'Caracas',  'delivered',  null,  '2026-10-03'),
  ('BL-CANCELADO',  'Cliente Prueba C', 'Maracay',  'cancelled',  null,  '2026-10-02'),
  ('BL-ELIMINADO',  'Cliente Prueba D', 'Mérida',   'in_transit', now(), '2026-10-01');
`;
  dockerOk(["exec", "-i", DB, "psql", "-q", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], { input: esquema });

  dockerOk(["run", "-d", "--pull", "never", "--name", REST, "-p", "127.0.0.1::3000",
    "-e", `PGRST_DB_URI=postgres://authenticator:${authPass}@db:5432/postgres`,
    "-e", "PGRST_DB_SCHEMAS=public",
    "-e", "PGRST_DB_ANON_ROLE=anon",
    "-e", `PGRST_JWT_SECRET=${jwtSecret}`,
    IMG_REST]);
  dockerOk(["network", "connect", RED, REST]);
  const puerto = dockerOk(["port", REST, "3000/tcp"]).split("\n")[0].split(":").pop();
  const base = `http://127.0.0.1:${puerto}`;

  let arriba = false;
  for (let i = 0; i < 60 && !arriba; i++) {
    try {
      arriba = (await fetch(`${base}/shipments?limit=0`)).ok;
    } catch {
      arriba = false;
    }
    if (!arriba) dormir(1000);
  }
  if (!arriba) throw new Error("PostgREST no respondió en 60 s");

  // supabase-js agrega `/rest/v1`; PostgREST suelto sirve en la raíz.
  const sinPrefijo = (url, init) => fetch(String(url).replace(`${base}/rest/v1`, base), init);
  const supabase = createClient(base, jwtAnon(jwtSecret), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: sinPrefijo },
  });

  const columnas = "id, code, client_name, destination";
  const a = await supabase
    .from("shipments")
    .select(columnas)
    .not("status", "in", "(entregado,cancelado)")
    .order("created_at", { ascending: false })
    .limit(50);
  const b = await supabase
    .from("shipments")
    .select(columnas)
    .not("status", "in", "(delivered,cancelled)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const resumen = (r) => ({
    status: r.status,
    error: r.error ? { code: r.error.code, message: r.error.message } : null,
    codes: r.data ? r.data.map((x) => x.code) : null,
  });
  const ra = resumen(a);
  const rb = resumen(b);
  console.log(`A · main      (entregado,cancelado): ${JSON.stringify(ra)}`);
  console.log(`B · corregida (delivered,cancelled) + deleted_at: ${JSON.stringify(rb)}`);

  const confirmaA = ra.error?.code === "22P02" && ra.codes === null;
  const confirmaB = rb.error === null && JSON.stringify(rb.codes) === JSON.stringify(["BL-VIVO"]);
  console.log(`A reproduce el error del enum: ${confirmaA ? "SÍ" : "NO"}`);
  console.log(`B devuelve sólo el embarque vivo y abierto: ${confirmaB ? "SÍ" : "NO"}`);
  return confirmaA && confirmaB ? 0 : 1;
}

let salida = 1;
try {
  salida = await main();
} catch (e) {
  console.error(`FALLÓ la reproducción: ${e instanceof Error ? e.message : e}`);
  salida = 2;
} finally {
  limpiar();
}
process.exit(salida);
