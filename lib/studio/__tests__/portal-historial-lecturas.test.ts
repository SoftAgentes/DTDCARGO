// @vitest-environment node
/**
 * SDD-0586 §10.5.10 · Las dos lecturas de solo lectura del runbook de las puertas, sobre el esquema real.
 *
 * `infra/ops/portal-historial/conteo-portal.sql` (paso 4.2) es el bloque literal de la spec 0586 que el DG
 * corrió el 2026-11-07, con md5 a5da12512b23b4662678e6eb5926c632, y no se toca. `cola-y-flag.sql` (paso 4.3)
 * comprueba las cuatro condiciones juntas e imprime una línea HECHO con el veredicto.
 *
 * El esquema y los datos salen del preámbulo del contrato de la 0524: las migraciones reales (0006, 0106,
 * 0337, 0503, 0504, 0519, 0520, 0523, 0508 y 0524) y su fixture. Va sin su `begin;`, porque cada guion abre
 * y cierra su propia transacción de solo lectura. `entity_audit_log` (de la 0267) va mínima. `:'tenant'` se
 * sustituye por el uuid, porque PGlite no tiene variables de psql.
 *
 * CONTROL ROJO: sin el guion no sale ninguna línea HECHO. MUTANTES: cada condición del veredicto, el
 * filtro del tenant y, en el conteo, el filtro del tenant.
 *
 * SIEMBRA (pedido del DG en la revisión de la #475): el fixture no tiene flag, auditoría ni corte de T1. Sin
 * eso, quitar el tenant del flag, de la auditoría o del corte, o quitar `->>'key'` o `->>'enabled'`, no
 * cambia nada. La siembra pone en T1 un flag encendido, un encendido auditado y un corte, y en T2 un
 * apagado auditado y un encendido de otra clave. Nada de eso cuenta para T2. Cada mutante de la siembra
 * corre dos veces: sin la siembra sobrevive (el rojo previo) y con ella cae.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRATO_0524 = resolve(ROOT, "supabase/tests/0524_chatwoot_portal_puerta4.test.sql");
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const CONTEO = read(resolve(ROOT, "infra/ops/portal-historial/conteo-portal.sql"));
const COLA = read(resolve(ROOT, "infra/ops/portal-historial/cola-y-flag.sql"));
const SLOW = 180_000;

/** El preámbulo del contrato de la 0524 hasta la 0524 aplicada, sin su `begin;`, con los \ir inlineados. */
function preambulo(): string {
  const texto = read(CONTRATO_0524);
  const fin = "\\ir ../migrations/0524_chatwoot_portal_puerta4.sql\n";
  const corte = texto.indexOf(fin);
  if (corte < 0) throw new Error("el contrato de la 0524 cambió: falta el \\ir de la 0524");
  const parte = texto.slice(0, corte + fin.length).replace(/^begin;\n/m, "");
  const out: string[] = [];
  const run = (base: string, contenido: string) => {
    for (const line of contenido.split("\n")) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) out.push(line);
      else if (meta[1] === "ir") {
        const dest = resolve(dirname(base), meta[2].trim());
        run(dest, read(dest));
      } else if (meta[1] !== "set") throw new Error("metaorden psql no soportada: \\" + meta[1]);
    }
  };
  run(CONTRATO_0524, parte);
  return out.join("\n");
}
const PRE = preambulo();
const AUDITORIA = "create table public.entity_audit_log (tenant_id uuid, entity_type text, event_type text, after_data jsonb);";

/** Un guion de psql → SQL plano: quita \set y sustituye :'tenant'. */
function plano(guion: string, tenant: string): string {
  return guion
    .split("\n")
    .filter((l) => !/^\\set\b/.test(l))
    .join("\n")
    .split(":'tenant'")
    .join(`'${tenant}'`);
}

/** Corre el preámbulo, lo que prepara el caso y el guion; devuelve las filas de todas sus consultas. */
async function correr(guion: string, tenantLabel: string, preparar = "") {
  const db = await pgliteLimpio();
  try {
    await db.exec(PRE + "\n" + AUDITORIA);
    if (preparar) await db.exec(preparar);
    const tenant = String((await db.query<{ t: string }>(`select pg_temp.id('${tenantLabel}')::text as t`)).rows[0].t);
    const res = await db.exec(plano(guion, tenant));
    return res.flatMap((r) => r.rows as Record<string, unknown>[]);
  } finally {
    await db.close();
  }
}
const hecho = (filas: Record<string, unknown>[]) =>
  filas.map((f) => Object.values(f).map(String)).flat().filter((v) => v.startsWith("HECHO"));

function once(text: string, from: string, to: string): string {
  expect(text.split(from), `«${from.slice(0, 60)}…» debe aparecer una sola vez`).toHaveLength(2);
  return text.split(from).join(to);
}

const OK = "HECHO salida=0 flag_encendido=0 encendidos_auditados=0 corte=nulo cola_y_flag=ok";
const SIEMBRA = `
do $$
declare n int;
begin
  update public.feature_flags set enabled = true where tenant_id = pg_temp.id('T1') and key = 'chatwoot_portal';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'la siembra no encendió el flag de T1 (% filas)', n; end if;
end $$;
insert into public.entity_audit_log values
  (pg_temp.id('T1'), 'feature_flag', 'feature_flag_changed', '{"key":"chatwoot_portal","enabled":true}'),
  (pg_temp.id('T2'), 'feature_flag', 'feature_flag_changed', '{"key":"chatwoot_portal","enabled":false}'),
  (pg_temp.id('T2'), 'feature_flag', 'feature_flag_changed', '{"key":"otra_clave","enabled":true}');
insert into public.chatwoot_portal_estado (tenant_id, corte) values (pg_temp.id('T1'), now())
  on conflict (tenant_id) do update set corte = excluded.corte;
`;
const T2 = (s: string) => s.split("@T2").join("pg_temp.id('T2')");
const CASOS: [string, string, RegExp][] = [
  ["una salida del tenant", T2("insert into public.chatwoot_portal_salida (message_id, tenant_id, conversation_id, estado) values (pg_temp.id('z1'), @T2, pg_temp.id('hZ'), 'cargado');"), /salida=1 .* cola_y_flag=NO$/],
  ["el flag encendido", T2("update public.feature_flags set enabled = true where tenant_id = @T2 and key = 'chatwoot_portal';"), /flag_encendido=1 .* cola_y_flag=NO$/],
  ["un encendido auditado", T2("insert into public.entity_audit_log values (@T2, 'feature_flag', 'feature_flag_changed', '{\"key\":\"chatwoot_portal\",\"enabled\":true}');"), /encendidos_auditados=1 .* cola_y_flag=NO$/],
  ["un corte fijado", T2("insert into public.chatwoot_portal_estado (tenant_id, corte) values (@T2, now());"), /corte=fijado cola_y_flag=NO$/],
];

describe("SDD-0586 · las lecturas del runbook de las puertas (PGlite)", () => {
  it("conteo-portal.sql es el bloque literal que corrió el DG (md5 a5da1251…)", () => {
    expect(createHash("md5").update(readFileSync(resolve(ROOT, "infra/ops/portal-historial/conteo-portal.sql"))).digest("hex")).toBe(
      "a5da12512b23b4662678e6eb5926c632",
    );
  });

  it("conteo-portal.sql cuenta el chat del portal del tenant, sin texto ni ids", async () => {
    const filas = await correr(CONTEO, "T1");
    expect(filas[0]).toMatchObject({ hilos: 5, hilos_vivos: 4, hilos_archivados: 1, abiertos: 3, pendientes: 1, resueltos: 0, clientes: 4 });
    expect(filas[1]).toMatchObject({ mensajes: 8, del_cliente: 5, del_equipo: 3 });
    expect(JSON.stringify(filas)).not.toMatch(/SINT|Cliente/);
  }, SLOW);

  it("MUTANTE: el conteo sin el filtro del tenant cae", async () => {
    const filas = await correr(once(CONTEO, "where c.tenant_id = :'tenant' and c.channel = 'portal';\n\nselect", "where c.channel = 'portal';\n\nselect"), "T1");
    expect(filas[0]).not.toMatchObject({ hilos: 5 });
  }, SLOW);

  it("cola-y-flag.sql da ok en un tenant donde la cola nunca corrió", async () => {
    expect(hecho(await correr(COLA, "T2"))).toEqual([OK]);
  }, SLOW);

  it("cola-y-flag.sql sigue en ok para T2 con la siembra de T1 y los dos ruidos de T2", async () => {
    expect(hecho(await correr(COLA, "T2", SIEMBRA))).toEqual([OK]);
  }, SLOW);

  it("la siembra sí pone T1 en NO por las tres tablas", async () => {
    expect(hecho(await correr(COLA, "T1", SIEMBRA))[0]).toMatch(/flag_encendido=1 encendidos_auditados=1 corte=fijado cola_y_flag=NO$/);
  }, SLOW);

  it("cola-y-flag.sql da corte=nulo y ok con una fila de estado de T2 con corte nulo", async () => {
    const preparar = T2("insert into public.chatwoot_portal_estado (tenant_id, corte) values (@T2, null);");
    expect(hecho(await correr(COLA, "T2", preparar))).toEqual([OK]);
  }, SLOW);

  for (const [nombre, preparar, espera] of CASOS) {
    it(`cola-y-flag.sql da NO con ${nombre}`, async () => {
      const lineas = hecho(await correr(COLA, "T2", preparar));
      expect(lineas).toHaveLength(1);
      expect(lineas[0]).toMatch(espera);
    }, SLOW);
  }

  it("cola-y-flag.sql da NO en el tenant del fixture, donde la cola ya mandó un mensaje", async () => {
    expect(hecho(await correr(COLA, "T1"))[0]).toMatch(/salida=1 .* cola_y_flag=NO$/);
  }, SLOW);

  it("CONTROL ROJO: sin el guion no sale ninguna línea HECHO", async () => {
    expect(hecho(await correr("select 1 as x;", "T2"))).toEqual([]);
  }, SLOW);

  const MUTANTES: [string, string, string, number][] = [
    ["el veredicto no mira la salida", "when salida = 0 and flag_encendido = 0", "when flag_encendido = 0", 0],
    ["el veredicto no mira el flag", "salida = 0 and flag_encendido = 0 and encendidos_auditados = 0", "salida = 0 and encendidos_auditados = 0", 1],
    ["el veredicto no mira la auditoría", "flag_encendido = 0 and encendidos_auditados = 0 and not hay_corte", "flag_encendido = 0 and not hay_corte", 2],
    ["el veredicto no mira el corte", "encendidos_auditados = 0 and not hay_corte then 'ok'", "encendidos_auditados = 0 then 'ok'", 3],
  ];
  for (const [nombre, from, to, caso] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const [, preparar] = CASOS[caso];
      const lineas = hecho(await correr(once(COLA, from, to), "T2", preparar));
      expect(lineas[0]).toMatch(/cola_y_flag=ok$/);
    }, SLOW);
  }

  it("MUTANTE «la salida sin el filtro del tenant» cae", async () => {
    const lineas = hecho(await correr(once(COLA, "public.chatwoot_portal_salida s where s.tenant_id = :'tenant'::uuid", "public.chatwoot_portal_salida s where true"), "T2"));
    expect(lineas[0]).not.toBe(OK);
  }, SLOW);

  const MUTANTES_SIEMBRA: [string, string, string][] = [
    ["la auditoría sin ->>'enabled'", " and a.after_data ->> 'enabled' = 'true'", ""],
    ["la auditoría sin ->>'key'", "and a.after_data ->> 'key' = 'chatwoot_portal' and ", "and "],
    ["el flag sin el tenant", "f.tenant_id = :'tenant'::uuid and f.key", "f.key"],
    ["la auditoría sin el tenant", "a.tenant_id = :'tenant'::uuid and a.entity_type", "a.entity_type"],
    ["el corte sin el tenant", "e.tenant_id = :'tenant'::uuid and e.corte", "e.corte"],
  ];
  for (const [nombre, from, to] of MUTANTES_SIEMBRA) {
    it(`MUTANTE «${nombre}»: sobrevive sin la siembra y cae con ella`, async () => {
      const mutante = once(COLA, from, to);
      expect(hecho(await correr(mutante, "T2")), "rojo previo: con el fixture de antes sobrevive").toEqual([OK]);
      expect(hecho(await correr(mutante, "T2", SIEMBRA))[0]).toMatch(/cola_y_flag=NO$/);
    }, SLOW);
  }

  it("las dos lecturas son de solo lectura, sin DML ni DDL, y cola-y-flag.sql no imprime la hora del corte", () => {
    for (const guion of [COLA, CONTEO]) {
      expect(guion).toMatch(/^begin transaction read only;$/m);
      expect(guion).toMatch(/^rollback;$/m);
      expect(guion.replace(/^\s*--.*$/gm, "")).not.toMatch(/\b(insert|update|delete|merge|create|alter|drop|grant|revoke|truncate|copy)\b/i);
    }
    expect(COLA).not.toMatch(/\|\|\s*corte\b/);
  });
});
