// @vitest-environment node
/**
 * SDD-0583 · puerta 7 de 4.9 (SDD-0582): la consulta del cupo y de las fallas de WhatsApp,
 * corrida de verdad en PostgreSQL embebido.
 *
 * `infra/chatwoot/vigilar-whatsapp.sql` es el MISMO archivo que vigilar.sh pasa por stdin a psql
 * en el contenedor de postgres. Aquí corre en PGlite sobre las dos tablas que lee, con las
 * columnas de db/schema.rb de Chatwoot 4.19.1 (`created_at` es timestamp sin zona, en UTC), y
 * datos inventados. Sin Chatwoot y sin Docker. La parte de bash (umbrales, motivos, CSV) la
 * prueba infra/ops/tests/prueba-vigilar-chatwoot.sh.
 *
 * El reloj se fija con un `public.now()` delante de pg_catalog en el search_path, así que cada
 * escenario es determinista: el reloj A (2026-11-06 18:00 UTC, mitad de mes) y el reloj B
 * (2026-12-01 02:00 UTC, cuando en Caracas todavía es 30 de noviembre). Cada reloj corre con la
 * sesión en UTC, en America/Caracas (UTC−4) y en Asia/Shanghai (UTC+8): el resultado no puede
 * depender de la zona de la sesión.
 *
 * Cada mutante reproduce una definición equivocada (notas privadas, entrantes, otra ventana,
 * otra zona, otra bandeja, inner join…) y tiene que cambiar al menos un resultado.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SQL = readFileSync(resolve(ROOT, "infra/chatwoot/vigilar-whatsapp.sql"), "utf8").replace(/\r\n/g, "\n");

const ESQUEMA = `
create table inboxes (
  id serial primary key, channel_id integer not null, account_id integer not null, name varchar not null,
  created_at timestamp not null default now(), updated_at timestamp not null default now(), channel_type varchar);
create table messages (
  id serial primary key, content text, account_id integer not null, inbox_id integer not null,
  conversation_id integer not null, message_type integer not null, created_at timestamp not null,
  updated_at timestamp not null, private boolean not null default false, status integer default 0);
create function sembrar(bandeja int, cuantos int, tipo int, privado boolean, estado int, cuando timestamp)
returns void language sql as $$
  insert into messages (account_id, inbox_id, conversation_id, message_type, private, status, created_at, updated_at, content)
  select 1, bandeja, 1, tipo, privado, estado, cuando, cuando, 'texto inventado' from generate_series(1, cuantos)
$$;
-- message_type: 0 incoming, 1 outgoing, 2 activity, 3 template · status: 0 sent, 1 delivered, 2 read, 3 failed
insert into inboxes (id, channel_id, account_id, name, channel_type) values
  (1, 1, 1, 'cupo', 'Channel::Whatsapp'), (2, 2, 1, 'bajo el cupo', 'Channel::Whatsapp'),
  (3, 1, 1, 'api', 'Channel::Api'), (4, 3, 1, 'solo mensajes viejos', 'Channel::Whatsapp'),
  (5, 4, 1, 'sin mensajes', 'Channel::Whatsapp'), (6, 5, 1, 'fallas', 'Channel::Whatsapp'),
  (7, 6, 1, 'cambio de mes', 'Channel::Whatsapp');
select sembrar(1, 800, 1, false, 1, '2026-11-01 00:00:01');  -- 800 salientes del mes
select sembrar(1, 5, 1, true, 0, '2026-11-02 10:00');        -- notas privadas: outgoing, no cuentan
select sembrar(1, 7, 0, false, 0, '2026-11-02 10:00');       -- entrantes
select sembrar(1, 3, 2, false, 0, '2026-11-02 10:00');       -- actividad
select sembrar(1, 4, 3, false, 0, '2026-11-02 10:00');       -- tipo template de Chatwoot
select sembrar(1, 6, 1, false, 1, '2026-10-31 23:59:59');    -- salientes del mes anterior
select sembrar(2, 799, 1, false, 2, '2026-11-03 12:00');     -- 799 salientes
select sembrar(3, 900, 1, false, 3, '2026-11-03 12:00');     -- otra clase de bandeja
select sembrar(4, 10, 1, false, 3, '2026-09-01 12:00');      -- fallas de hace meses
select sembrar(6, 1, 1, false, 3, '2026-11-05 19:00');       -- falla a 23 h del reloj A
select sembrar(6, 1, 1, false, 3, '2026-11-05 17:00');       -- falla a 25 h del reloj A
select sembrar(6, 1, 1, false, 1, '2026-11-06 17:00');       -- entregado hace 1 h
select sembrar(6, 1, 1, false, 2, '2026-11-06 17:30');       -- leído
select sembrar(7, 1, 1, false, 3, '2026-11-30 23:00');       -- falla a 3 h del reloj B, del mes anterior en UTC
select sembrar(7, 1, 1, false, 1, '2026-12-01 01:00');       -- saliente del mes del reloj B en UTC
`;

const RELOJES = { A: "2026-11-06 18:00:00+00", B: "2026-12-01 02:00:00+00" };
const ZONAS = ["UTC", "America/Caracas", "Asia/Shanghai"];
// «id|salientes_mes|fallas_24h», como lo imprime psql -At -F '|'. En el reloj A las filas de la
// bandeja 7 están en el futuro y cuentan: la consulta no tiene tope superior.
const ESPERADO = {
  A: ["1|800|0", "2|799|0", "4|0|0", "5|0|0", "6|4|1", "7|2|1"],
  B: ["1|0|0", "2|0|0", "4|0|0", "5|0|0", "6|0|0", "7|1|1"],
};

let db;
beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
  await db.exec(ESQUEMA);
}, 60_000);
afterAll(async () => {
  await db?.close();
});

/** Corre `sql` con el reloj y la zona dados → filas «id|salientes|fallas» y nombres de columna. */
async function correr(sql, reloj, zona) {
  await db.exec(`
    set TimeZone = '${zona}';
    create or replace function public.now() returns timestamptz language sql stable as $$ select '${reloj}'::timestamptz $$;
    set search_path = public, pg_catalog;`);
  const resultados = await db.exec(sql);
  const consultas = resultados.filter((r) => r.fields.length > 0);
  if (consultas.length !== 1) throw new Error(`esperaba una sola consulta con columnas, hubo ${consultas.length}`);
  const [r] = consultas;
  return { columnas: r.fields.map((f) => f.name), filas: r.rows.map((x) => r.fields.map((f) => String(x[f.name])).join("|")) };
}

async function todos(sql) {
  const salida = {};
  for (const [nombre, reloj] of Object.entries(RELOJES)) {
    for (const zona of ZONAS) salida[`${nombre} · ${zona}`] = await correr(sql, reloj, zona);
  }
  return salida;
}

/** Sin comentarios: lo que de verdad ejecuta psql. */
const sinComentarios = (s) => s.replace(/--[^\n]*/g, "");

describe("SDD-0583 · vigilar-whatsapp.sql en PGlite", () => {
  it("devuelve id, salientes_mes y fallas_24h, en ese orden (vigilar.sh las lee por posición)", async () => {
    const { columnas } = await correr(SQL, RELOJES.A, "UTC");
    expect(columnas).toEqual(["id", "salientes_mes", "fallas_24h"]);
  });

  it.each(Object.keys(RELOJES).flatMap((r) => ZONAS.map((z) => [r, z])))(
    "reloj %s con la sesión en %s: los conteos esperados",
    async (reloj, zona) => {
      const { filas } = await correr(SQL, RELOJES[reloj], zona);
      expect(filas).toEqual(ESPERADO[reloj]);
    },
  );

  it("las reglas de la especificación, en el reloj A", async () => {
    const filas = Object.fromEntries((await correr(SQL, RELOJES.A, "UTC")).filas.map((f) => [f.split("|")[0], f]));
    expect(filas["1"]).toBe("1|800|0"); // 800 salientes del mes; notas privadas, entrantes y el mes anterior no cuentan
    expect(filas["2"]).toBe("2|799|0");
    expect(filas["3"]).toBeUndefined(); // solo bandejas de WhatsApp
    expect(filas["4"]).toBe("4|0|0"); // una bandeja sin mensajes recientes sale igual, con ceros
    expect(filas["5"]).toBe("5|0|0");
    expect(filas["6"]).toBe("6|4|1"); // la falla de hace 23 h cuenta; la de hace 25 h, no
  });

  it("es de solo lectura, con tope de tiempo, y no escribe", () => {
    const s = sinComentarios(SQL).trim();
    expect(s.startsWith("begin transaction read only;")).toBe(true);
    expect(s.endsWith("commit;")).toBe(true);
    expect(s).toMatch(/^set local statement_timeout = '15s';$/m);
    expect(s).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate|grant|copy|merge|call)\b/i);
  });

  it("no lee contenido, teléfonos ni nombres: solo ids y conteos", () => {
    const s = sinComentarios(SQL);
    expect(s).not.toMatch(/\b(content|phone|name|email|source_id|contact)/i);
  });

  const MUTANTES = [
    ["cuenta las notas privadas", "and not m.private", ""],
    ["cuenta los entrantes", "m.message_type = 1 and", "m.message_type in (0, 1) and"],
    ["cuenta actividad y el tipo template", "m.message_type = 1 and", "m.message_type >= 1 and"],
    ["fallas con delivered", "m.status = 3", "m.status in (1, 3)"],
    ["fallas sin ventana de 24 h", /\n\s+and m\.created_at >= \(now\(\) at time zone 'UTC'\) - interval '24 hours'\) as fallas_24h/, ") as fallas_24h"],
    ["ventana de 48 h", "interval '24 hours') as fallas_24h", "interval '48 hours') as fallas_24h"],
    ["el mes en la zona de la sesión", "date_trunc('month', now() at time zone 'UTC')) as salientes_mes", "date_trunc('month', now())) as salientes_mes"],
    ["las 24 h en la zona de la sesión (la consulta de la especificación)", "(now() at time zone 'UTC') - interval '24 hours') as fallas_24h", "now() - interval '24 hours') as fallas_24h"],
    ["salientes sin el filtro del mes", /\n\s+and m\.created_at >= date_trunc\('month', now\(\) at time zone 'UTC'\)\) as salientes_mes/, ") as salientes_mes"],
    ["todas las clases de bandeja", "where i.channel_type = 'Channel::Whatsapp'\n", ""],
    ["inner join: se pierden las bandejas sin mensajes recientes", "left join messages m", "join messages m"],
    ["el join lee solo desde el inicio del mes", /least\(date_trunc\('month', now\(\) at time zone 'UTC'\),\s+\(now\(\) at time zone 'UTC'\) - interval '24 hours'\)/, "date_trunc('month', now() at time zone 'UTC')"],
    ["columnas en otro orden", /select i\.id,\n(\s+count\(m\.id\) filter \(where m\.message_type[^\n]*\n[^\n]*salientes_mes),\n(\s+count\(m\.id\) filter \(where m\.status[^\n]*\n[^\n]*fallas_24h)\n/, "select i.id,\n$2,\n$1\n"],
  ];

  it.each(MUTANTES)("mutante «%s»: cambia algún resultado", async (_nombre, de, a) => {
    const veces = typeof de === "string" ? SQL.split(de).length - 1 : (SQL.match(new RegExp(de.source, "g")) ?? []).length;
    expect(veces, "el texto del mutante tiene que aparecer una sola vez").toBe(1);
    const mutada = SQL.replace(de, a);
    expect(mutada).not.toBe(SQL);
    const obtenido = await todos(mutada);
    const igual = Object.entries(obtenido).every(([clave, r]) => {
      const reloj = clave.split(" · ")[0];
      return JSON.stringify(r.columnas) === JSON.stringify(["id", "salientes_mes", "fallas_24h"])
        && JSON.stringify(r.filas) === JSON.stringify(ESPERADO[reloj]);
    });
    expect(igual, "el mutante da los mismos resultados que la consulta").toBe(false);
  });
});
