// @vitest-environment node
/**
 * SDD-0675 · La migración 0565 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0565_bandeja_concedible_por_persona.test.sql`
 * monta lo mismo que el de la 0538, aplica la 0357, la 0538 y la 0565 REALES y
 * concede, mide y revoca un extra de `bandeja` como lo hará Usuarios.
 *
 * CONTROL ROJO: sin 0565 cae en la primera aserción.
 * MUTANTES: cada uno es una 0565 coherente con un defecto y cae en la aserción
 * que lo nombra.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0565_bandeja_concedible_por_persona.test.sql");
const M0565 = "0565_bandeja_concedible_por_persona.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0565 = read(resolve(ROOT, "supabase/migrations", M0565));
/** El desarme sin su begin/commit: se ensaya dentro de la transacción del contrato. */
const DESARME = read(resolve(ROOT, "supabase/desarmes/0565_desarme.sql"))
  .split("\n")
  .filter((line) => !/^(begin|commit);$/.test(line.trim()))
  .join("\n");
const BASELINE = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
  pendingBelowCutoff: Record<string, string>;
};
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

async function contract(replace: Record<string, string> = {}, ajustar: (sql: string) => string = (sql) => sql) {
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(ajustar(inline(CONTRACT, replace)));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0565"));
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

describe("SDD-0675 · 0565 la Bandeja se concede por persona (PGlite)", () => {
  it("el contrato pasa entero con la 0565", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0565 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("CONTROL ROJO: sin la 0565 bandeja no es concedible y el contrato cae", async () => {
    const run = await contract({ [M0565]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST 0565: 1: la 0565 deja conceder bandeja/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    [
      "abre un módulo no cubierto",
      "    'bandeja'\n  ]::text[])\n$$;",
      "    'bandeja', 'cn'\n  ]::text[])\n$$;",
      // Desde la revisión de la #686 lo para el postflight (módulos de más); la aserción 4 del contrato queda de segunda red.
      /0565: la lista de módulos concedibles no quedó como se esperaba/,
    ],
    [
      "pierde un módulo de la 0538",
      "'rates', 'suppliers',\n    'bandeja'",
      "'rates',\n    'bandeja'",
      /0565: la lista de módulos concedibles no quedó como se esperaba/,
    ],
    [
      "suma un módulo de más que no es admin ni users",
      "    'bandeja'\n  ]::text[])\n$$;",
      "    'bandeja', 'tesoreria'\n  ]::text[])\n$$;",
      /0565: la lista de módulos concedibles no quedó como se esperaba/,
    ],
    [
      "le quita EXECUTE a service_role",
      "comment on function public.studio_module_is_grantable(text) is",
      "revoke execute on function public.studio_module_is_grantable(text) from service_role;\ncomment on function public.studio_module_is_grantable(text) is",
      /0565: los privilegios de studio_module_is_grantable cambiaron/,
    ],
    [
      "abre admin",
      "    'bandeja'\n  ]::text[])\n$$;",
      "    'bandeja', 'admin'\n  ]::text[])\n$$;",
      /0565: la lista de módulos concedibles no quedó como se esperaba/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0565]: once(FILE_0565, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si bandeja ya es concedible", async () => {
    const run = await contract({ [M0565]: `${FILE_0565}\n${FILE_0565}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0565: bandeja ya es concedible/);
  }, SLOW);

  it("PREFLIGHT: si la lista vigente tiene un módulo de más, aborta", async () => {
    const run = await contract({
      [M0565]: `create or replace function public.studio_module_is_grantable(p_module_id text) returns boolean
language sql immutable security invoker set search_path = '' as $f$
  select p_module_id = any (array['kommo', 'clients', 'quotes', 'sales-orders', 'purchase-orders',
    'conversaciones', 'rates', 'suppliers', 'tesoreria']::text[])
$f$;
${FILE_0565}`,
    });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0565: studio_module_is_grantable no tiene la lista de la 0538/);
  }, SLOW);

  it("PREFLIGHT: si a la lista vigente le falta un módulo de la 0538, aborta", async () => {
    const run = await contract({
      [M0565]: `create or replace function public.studio_module_is_grantable(p_module_id text) returns boolean
language sql immutable security invoker set search_path = '' as $f$
  select p_module_id = any (array['kommo', 'clients', 'quotes', 'sales-orders', 'purchase-orders',
    'conversaciones', 'suppliers']::text[])
$f$;
${FILE_0565}`,
    });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0565: studio_module_is_grantable no tiene la lista de la 0538/);
  }, SLOW);

  it("DESARME: sin accesos de bandeja devuelve la lista de la 0538", async () => {
    const run = await contract({}, (sql) => {
      const fin = sql.lastIndexOf("rollback;");
      return `${sql.slice(0, fin)}
${DESARME}
do $d$
begin
  if public.studio_module_is_grantable('bandeja') then raise exception 'D1: bandeja sigue concedible'; end if;
  if exists (
    select 1
    from unnest(array['kommo', 'clients', 'quotes', 'sales-orders', 'purchase-orders', 'conversaciones', 'rates', 'suppliers']) as m(id)
    where not public.studio_module_is_grantable(m.id)
  ) then
    raise exception 'D2: se perdió un módulo de la 0538';
  end if;
end;
$d$;
select 'DESARME OK' as resultado;
rollback;`;
    });
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/TEST 0565 GREEN/);
  }, SLOW);

  it("DESARME: con un acceso de bandeja vigente aborta y no toca la función", async () => {
    const run = await contract({}, (sql) => {
      // Justo antes de que el contrato revoque el acceso (aserción 6).
      const marca = sql.indexOf("select public.studio_revoke_user_module_grant");
      const corte = sql.lastIndexOf("select pg_temp.como", marca);
      return `${sql.slice(0, corte)}\n${DESARME}\nrollback;`;
    });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/desarme 0565: quedan accesos adicionales de bandeja/);
  }, SLOW);

  it("DESARME: va entre begin y commit para que los set local tengan efecto", () => {
    const crudo = read(resolve(ROOT, "supabase/desarmes/0565_desarme.sql"));
    const lineas = crudo.split("\n").map((l) => l.trim());
    const begin = lineas.indexOf("begin;");
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(lineas.findIndex((l) => l.startsWith("set local"))).toBeGreaterThan(begin);
    expect(lineas.filter((l) => l.length > 0).at(-1)).toBe("commit;");
  });

  it("PREFLIGHT: sin la 0538 aborta sin crear nada", async () => {
    const run = await contract({ "0538_studio_user_module_grants.sql": "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0565 requiere la 0538/);
  }, SLOW);

  // Aplicada en producción el 2026-11-19 a las 17:55:31Z, con el OK de Sam «OK, aplica 0566, 0565 y 0562».
  // Sale de las esperas y queda sellada con el md5 del ledger. La cabecera «NO APLICADA» se conserva
  // (runbook de migraciones, §6): el ledger guarda el texto exacto y la identidad se prueba por md5.
  it("la 0565 está aplicada: fuera de las esperas y sellada con el md5 del ledger", () => {
    const LOCK = JSON.parse(read(resolve(ROOT, "supabase/migrations.lock.json"))) as {
      selladas: Record<string, { md5: string; bytes: number }>;
    };
    expect(BASELINE.pendingBelowCutoff["0565_bandeja_concedible_por_persona"]).toBeUndefined();
    expect(LOCK.selladas["0565_bandeja_concedible_por_persona"]).toMatchObject({
      md5: "479cefea6117e822a7bcd896902f6bdf",
      bytes: 5486,
    });
    expect(FILE_0565).toMatch(/NO APLICADA EN NINGÚN ENTORNO/);
  });
});
