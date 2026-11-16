// @vitest-environment node
/**
 * SDD-0637 fase 2 · La migración 0550 (registro de Faro) corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0550_faro_registro.test.sql` arma lo mínimo de la tenencia y aplica la
 * 0550 REAL dos veces. PGlite lo corre con los `.sql` inlineados: lo que se prueba es el texto que se
 * aplicará.
 *
 * CONTROL ROJO: sin 0550 el contrato cae en «A: falta asistente_alerta». El runner exige ese mensaje.
 * MUTANTES: cada uno es una 0550 con UN defecto y tiene que caer con el mensaje que lo nombra.
 * DESARME: 0550 → desarme → 0550 deja todo como al principio.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { pgliteLimpio } from "@/vitest/pglite-limpio";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0550_faro_registro.test.sql");
const M0550 = "0550_faro_registro.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0550 = read(resolve(ROOT, "supabase/migrations", M0550));
const DESARME = read(resolve(ROOT, "supabase/desarmes/0550_desarme.sql"));
const SLOW = 180_000;

/** psql → SQL plano: quita \set e inlinea \ir. `replace` sustituye un archivo por el final de su ruta. */
function inline(file: string, replace: Record<string, string> = {}): string {
  const out: string[] = [];
  const source = (path: string) => {
    const key = Object.keys(replace).find((name) => path.replace(/\\/g, "/").endsWith(name));
    return key !== undefined ? replace[key] : readFileSync(path, "utf8");
  };
  function run(path: string) {
    for (const line of source(path).split(/\r?\n/)) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) {
        out.push(line);
      } else if (meta[1] === "ir") {
        run(resolve(dirname(path), meta[2].trim()));
      } else if (meta[1] !== "set") {
        throw new Error("metaorden psql no soportada: \\" + meta[1]);
      }
    }
  }
  run(file);
  return out.join("\n");
}

async function contract(replace: Record<string, string> = {}) {
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(inline(CONTRACT, replace));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0550"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** Un único cambio sobre un texto; falla si lo que se cambia no aparece una sola vez. */
function once(text: string, from: string, to: string): string {
  expect(text.split(from), `«${from.slice(0, 60)}…» debe aparecer una sola vez`).toHaveLength(2);
  return text.split(from).join(to);
}

const MUTANTES: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "el trigger deja editar",
    sql: () => once(FILE_0550, "  if tg_op = 'UPDATE' then\n", "  if false then\n"),
    cae: "TEST 0550: C: el dueño editó una conversación con la bandera de purga encendida",
  },
  {
    nombre: "el trigger deja borrar sin la bandera",
    sql: () =>
      once(
        FILE_0550,
        "if coalesce(pg_catalog.current_setting('asistente.purga', true), '') <> 'on' then",
        "if false then",
      ),
    cae: "TEST 0550: C: el dueño borró conversaciones sin la purga",
  },
  {
    nombre: "service_role puede borrar",
    sql: () =>
      once(
        FILE_0550,
        "'grant select, insert on table public.%I to service_role'",
        "'grant select, insert, delete on table public.%I to service_role'",
      ),
    cae: "TEST 0550: B: service_role tiene DELETE sobre asistente_",
  },
  {
    nombre: "el tope deja pasar una de más (<=)",
    sql: () => once(FILE_0550, "where c.consumido < p_tope", "where c.consumido <= p_tope"),
    cae: "TEST 0550: D: el tope por hora dio",
  },
  {
    nombre: "el gasto cuenta meses anteriores",
    sql: () =>
      once(
        FILE_0550,
        "     and l.iniciada_at >= pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'UTC') at time zone 'UTC';",
        "     and true;",
      ),
    cae: "TEST 0550: E: el gasto del mes de T1 dio",
  },
  {
    nombre: "las alertas se borran a los 180 días",
    sql: () =>
      once(
        FILE_0550,
        "   where tipo in ('feedback', 'rectificacion', 'fallo') and creado_at < v_ahora - interval '180 days';",
        "   where tipo in ('feedback', 'rectificacion', 'fallo', 'alerta') and creado_at < v_ahora - interval '180 days';",
      ),
    cae: "TEST 0550: F: la purga cuenta exactamente lo vencido",
  },
  {
    nombre: "las llamadas duran 12 meses",
    sql: () => once(FILE_0550, "interval '13 months'", "interval '11 months'"),
    cae: "TEST 0550: F: la purga cuenta exactamente lo vencido",
  },
  {
    nombre: "la bandera de purga queda encendida",
    sql: () =>
      once(
        FILE_0550,
        "  insert into public.asistente_purgas (motivo, conteos) values ('plazo', v_conteos);\n\n  perform pg_catalog.set_config('asistente.purga', 'off', true);\n",
        "  insert into public.asistente_purgas (motivo, conteos) values ('plazo', v_conteos);\n\n",
      ),
    cae: "TEST 0550: F: la bandera de purga quedó encendida",
  },
  {
    nombre: "la purga a pedido se lleva las alertas",
    sql: () =>
      once(
        FILE_0550,
        "     and e.tipo in ('feedback', 'rectificacion', 'fallo')\n",
        "     and true\n",
      ),
    cae: "TEST 0550: G: la purga a pedido dio",
  },
  {
    nombre: "la lista no filtra por tenant",
    sql: () => once(FILE_0550, "     where c.tenant_id = v_tenant\n       and (p_antes", "     where true\n       and (p_antes"),
    cae: "TEST 0550: H: el admin de T1 ve 3 conversaciones",
  },
  {
    nombre: "abrir no exige administrador",
    sql: () =>
      once(
        FILE_0550,
        "if v_tenant is null or v_lector is null or not public.is_tenant_admin() then",
        "if v_tenant is null or v_lector is null then",
      ),
    cae: "TEST 0550: H: una contadora abrió una conversación",
  },
  {
    nombre: "abrir no deja rastro",
    sql: () =>
      once(
        FILE_0550,
        "  insert into public.asistente_lecturas (tenant_id, lector_id, conversacion_id)\n  values (v_tenant, v_lector, p_conversacion);\n",
        "",
      ),
    cae: "TEST 0550: H: abrir la conversación no quedó registrado una vez",
  },
  {
    nombre: "el revoke de una función olvida a anon",
    sql: () =>
      once(
        FILE_0550,
        "revoke all on function public.asistente_purgar_vencidos() from public, anon, authenticated;",
        "revoke all on function public.asistente_purgar_vencidos() from public, authenticated;",
      ),
    cae: "TEST 0550: I: anon ejecuta public.asistente_purgar_vencidos()",
  },
  {
    nombre: "el revoke de las tablas olvida a service_role",
    sql: () =>
      once(
        FILE_0550,
        "'revoke all on table public.%I from public, anon, authenticated, service_role'",
        "'revoke all on table public.%I from public, anon, authenticated'",
      ),
    cae: "TEST 0550: B: service_role tiene UPDATE sobre asistente_",
  },
  {
    nombre: "la purga a pedido no exige un admin del tenant",
    sql: () =>
      once(
        FILE_0550,
        "                    and ut.role = 'admin' and ut.disabled_at is null) then",
        "                    and ut.role = 'admin' and ut.disabled_at is null) and false then",
      ),
    cae: "TEST 0550: G: un actor que no es admin pidió una purga",
  },
  {
    nombre: "la purga a pedido cruza de tenant",
    sql: () =>
      once(
        FILE_0550,
        "   where dc.tenant_id = p_tenant\n     and dc.usuario_id = p_usuario;",
        "   where true\n     and dc.usuario_id = p_usuario;",
      ),
    cae: "TEST 0550: G: la purga a pedido de una persona en dos tenants dio",
  },
  {
    nombre: "la purga a pedido deja los eventos a su nombre",
    sql: () => once(FILE_0550, "     and (e.usuario_id = p_usuario\n          or ", "     and (false\n          or "),
    cae: "TEST 0550: G: la purga a pedido dio",
  },
  {
    nombre: "la purga a pedido deja las cuotas",
    sql: () =>
      once(
        FILE_0550,
        "delete from public.asistente_cuotas q where q.tenant_id = p_tenant and q.usuario_id = p_usuario;",
        "delete from public.asistente_cuotas q where false;",
      ),
    cae: "TEST 0550: G: la purga a pedido dio",
  },
  {
    nombre: "authenticated ejecuta la purga",
    sql: () =>
      once(
        FILE_0550,
        "grant execute on function public.asistente_purgar_vencidos() to service_role;",
        "grant execute on function public.asistente_purgar_vencidos() to service_role, authenticated;",
      ),
    cae: "TEST 0550: I: authenticated ejecuta public.asistente_purgar_vencidos()",
  },
];

describe("0550 · registro de Faro (PGlite)", () => {
  it(
    "el contrato pasa con la 0550 real",
    async () => {
      const r = await contract();
      expect(r.error).toBeNull();
      expect(r.green).toMatch(/^TEST 0550 OK/);
    },
    SLOW,
  );

  it(
    "control rojo: sin la 0550 cae donde debe",
    async () => {
      const r = await contract({ [M0550]: "" });
      expect(r.error).toContain("TEST 0550: A: falta asistente_alerta");
    },
    SLOW,
  );

  for (const m of MUTANTES) {
    it(
      `mutante: ${m.nombre}`,
      async () => {
        const r = await contract({ [M0550]: m.sql() });
        expect(r.green, "el mutante pasó el contrato").toBeUndefined();
        expect(r.error).toContain(m.cae);
      },
      SLOW,
    );
  }

  it(
    "desarme: 0550 → desarme → 0550 queda como al principio",
    async () => {
      const db = await pgliteLimpio();
      try {
        // El armado del contrato: todo lo que va antes de su primer \ir de la 0550, sin el begin.
        const fixture = read(CONTRACT)
          .split("\\ir ../migrations/0550_faro_registro.sql")[0]
          .replace(/^\\set .*$/gm, "");
        expect(fixture).not.toMatch(/^\\/m);
        const base = fixture.replace(/^begin;$/m, "");
        await db.exec(base);
        await db.exec(FILE_0550);
        const antes = await db.query<{ n: number }>(
          "select count(*)::int as n from pg_class where relname like 'asistente\\_%' and relkind = 'r'",
        );
        expect(antes.rows[0].n).toBe(7);
        await db.exec(DESARME);
        const fuera = await db.query<{ n: number }>(
          "select (select count(*) from pg_class where relname like 'asistente\\_%' and relkind = 'r')" +
            " + (select count(*) from pg_proc where proname like 'asistente\\_%') as n",
        );
        expect(Number(fuera.rows[0].n)).toBe(0);
        await db.exec(FILE_0550);
        const despues = await db.query<{ n: number }>(
          "select count(*)::int as n from pg_class where relname like 'asistente\\_%' and relkind = 'r'",
        );
        expect(despues.rows[0].n).toBe(7);
      } finally {
        await db.close();
      }
    },
    SLOW,
  );
});
