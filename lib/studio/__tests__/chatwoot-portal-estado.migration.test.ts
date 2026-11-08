// @vitest-environment node
/**
 * SDD-0586 (10.5, PR 1c-2) · La migración 0521 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0521_chatwoot_portal_estado.test.sql` aplica la 0519, la 0520 y la
 * 0521 REALES sobre la 0006, la 0106 (con su RLS y sus grants), la 0337, la 0503 y la 0504 reales,
 * llama sus funciones como el servidor de Studio (service_role) y escribe como alguien del equipo
 * (authenticated) directo, como lo haría PostgREST. PGlite lo corre con los `.sql` inlineados: lo
 * que se prueba es el texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0521 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0521 coherente con un defecto y tiene que caer en la aserción que lo
 * nombra. Los críticos: el estado desde el espejo y solo si cambia; la conciliación sin ventana para
 * los no resueltos y con la marca que no vuelve; la guarda invoker, en los dos sentidos del canal, y
 * con el flag para los salientes y el estado.
 * APLICADA (2026-11-08, con el OK nominal de Sam, en prueba a las 15:01:02Z y en producción a las
 * 15:01:54Z): la 0521 salió de las esperas de migrations-baseline.json y quedó sellada en
 * migrations.lock.json. La cabecera «NO APLICADA» se conserva porque el ledger guarda el texto exacto.
 * La última prueba lo fija.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const NOMBRE = "0521_chatwoot_portal_estado";
const CONTRACT = resolve(ROOT, `supabase/tests/${NOMBRE}.test.sql`);
const MIGRACION = `${NOMBRE}.sql`;
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE = read(resolve(ROOT, "supabase/migrations", MIGRACION));
const BASELINE = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
  cutoff: number;
  pendingBelowCutoff: Record<string, string>;
};
const DECLARATIONS = JSON.parse(read(resolve(ROOT, "supabase/pending-migration-symbol-declarations.json"))) as {
  degradations: { migration: string }[];
};
const LOCK = JSON.parse(read(resolve(ROOT, "supabase/migrations.lock.json"))) as {
  selladas: Record<string, { md5?: string; bytes?: number; ledger?: { fecha: string; forma: string } }>;
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

async function contract(replace: Record<string, string> = {}) {
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(inline(CONTRACT, replace));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0521"));
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

describe("SDD-0586 · 0521 el estado, la conciliación y la guarda del portal (PGlite)", () => {
  it("el contrato pasa entero con la 0521", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0521 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("CONTROL ROJO: sin la 0521 el estado no existe y el contrato cae", async () => {
    const run = await contract({ [MIGRACION]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/existe chatwoot_portal_estado_hilo/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    // ── El estado (E10-D39) ──
    ["el estado con el flag apagado", "  ) then\n    resultado := 'apagado';", "  ) and false then\n    resultado := 'apagado';", /TEST 0521: con el flag apagado: apagado/],
    ["snoozed se traduce como abierto", "    when 'snoozed'  then 'pendiente'", "    when 'snoozed'  then 'abierto'", /TEST 0521: snoozed pasa a pendiente/],
    ["escribe aunque sea igual", "  if v_actual = v_nuevo then\n    resultado := 'igual';", "  if false then\n    resultado := 'igual';", /TEST 0521: solo si cambia: igual/],
    ["cambia un hilo archivado", "  if v_archivado is not null then\n    resultado := 'archivado';", "  if false then\n    resultado := 'archivado';", /TEST 0521: a un hilo archivado no lo cambia/],
    [
      "el estado no mira el canal",
      "  where c.id = v_hilo and c.tenant_id = p_tenant_id and c.channel = 'portal'\n  for no key update;",
      "  where c.id = v_hilo and c.tenant_id = p_tenant_id\n  for no key update;",
      /TEST 0521: un vínculo a un hilo de correo no se toca/,
    ],
    // ── La conciliación (E10-D40.5) ──
    ["los abiertos con ventana", "      c.status <> 'resuelto'\n      or", "      false\n      or", /TEST 0521: un hilo abierto entra sin ventana/],
    ["los resueltos sin ventana", "      c.status <> 'resuelto'\n      or", "      true\n      or", /TEST 0521: un resuelto sin actividad en 7 días no entra/],
    ["concilia un hilo archivado", "   and c.channel = 'portal' and c.deleted_at is null\n", "   and c.channel = 'portal'\n", /TEST 0521: un hilo archivado no entra/],
    ["el orden al revés", "  order by hl.conciliado_at asc nulls first, hl.conversation_id", "  order by hl.conciliado_at desc nulls last, hl.conversation_id", /TEST 0521: el tope corta, y primero va el nunca conciliado/],
    ["la marca vuelve hacia atrás", "        else greatest(coalesce(hl.conciliado_hasta, p_hasta), p_hasta)", "        else p_hasta", /TEST 0521: la marca nunca vuelve hacia atrás/],
    [
      "la marca de otro tenant",
      "  where hl.tenant_id = p_tenant_id and hl.conversation_id = p_conversation_id;",
      "  where hl.conversation_id = p_conversation_id;",
      /TEST 0521: otro tenant no mueve la marca/,
    ],
    // ── La guarda ──
    ["la guarda con current_setting('role')", "  if current_user <> 'authenticated' then", "  if current_setting('role') <> 'authenticated' then", /TEST 0521: una función security definer, llamada por authenticated, pasa la guarda/],
    ["el canal en un solo sentido", "(old.channel = 'portal' or new.channel = 'portal') then", "old.channel = 'portal' then", /TEST 0521: un hilo de correo no se vuelve del portal/],
    ["el canal solo con el flag", "(old.channel = 'portal' or new.channel = 'portal') then", "(old.channel = 'portal' or new.channel = 'portal') and public.chatwoot_portal_flag(old.tenant_id) then", /TEST 0521: el canal sigue trabado con el flag apagado/],
    ["el equipo crea un hilo del portal", "      if new.channel = 'portal' then", "      if false then", /TEST 0521: el equipo no crea un hilo del portal/],
    ["el estado trabado sin el flag", "\n       and public.chatwoot_portal_flag(old.tenant_id) then", " then", /TEST 0521: con el flag apagado el equipo cambia el estado/],
    ["el saliente trabado sin el flag", "     and public.chatwoot_portal_flag(new.tenant_id) then", "     then", /TEST 0521: con el flag apagado el equipo responde/],
    ["el mismo estado cuenta como cambio", "new.status is distinct from old.status", "true", /TEST 0521: poner el mismo estado no es un cambio/],
    ["no traba el saliente", "    raise exception 'Este hilo del portal se responde desde la Bandeja de Chatwoot.' using errcode = '42501';", "    null;", /TEST 0521: el equipo no escribe directo un saliente/],
    ["el flag sin comparar el tenant", "    and p_tenant_id = public.get_user_tenant_id()\n", "", /TEST 0521: el flag de otro tenant da false/],
    // ── Acceso (el postflight) ──
    [
      "el estado para authenticated",
      "revoke all on function public.chatwoot_portal_estado_hilo(uuid, bigint) from public, anon, authenticated;",
      "revoke all on function public.chatwoot_portal_estado_hilo(uuid, bigint) from public, anon;\ngrant execute on function public.chatwoot_portal_estado_hilo(uuid, bigint) to authenticated;",
      /0521: public\.chatwoot_portal_estado_hilo\(uuid, bigint\) tiene que ser solo de service_role/,
    ],
    [
      "sin el trigger de los mensajes",
      "create trigger chatwoot_portal_guarda_mensaje\n  before insert on public.conversation_messages\n  for each row execute function public.chatwoot_portal_guarda();\n",
      "",
      /0521: faltan los dos triggers de la guarda/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [MIGRACION]: once(FILE, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  /** La guarda vuelta security definer: el postflight la frena, y sin él la frena el contrato. */
  const MUTANTES_DOBLES: [string, [string, string][], RegExp][] = [
    [
      "la guarda security definer (y el postflight que la frena)",
      [
        ["language plpgsql\nsecurity invoker", "language plpgsql\nsecurity definer"],
        ["      and not p.prosecdef\n      and p.proconfig @> array['search_path=\"\"']\n  ) then\n    raise exception '0521: chatwoot_portal_guarda", "      and p.proconfig @> array['search_path=\"\"']\n  ) then\n    raise exception '0521: chatwoot_portal_guarda"],
      ],
      /TEST 0521: el equipo no cambia directo el estado de un hilo del portal/,
    ],
    [
      "la guarda security definer, con el postflight",
      [["language plpgsql\nsecurity invoker", "language plpgsql\nsecurity definer"]],
      /0521: chatwoot_portal_guarda tiene que ser security invoker/,
    ],
  ];

  for (const [nombre, cambios, espera] of MUTANTES_DOBLES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const mutada = cambios.reduce((texto, [from, to]) => once(texto, from, to), FILE);
      const run = await contract({ [MIGRACION]: mutada });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si el estado ya existe", async () => {
    const run = await contract({ [MIGRACION]: `${FILE}\n${FILE}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0521: el estado y la guarda del portal ya existen/);
  }, SLOW);

  it("PREFLIGHT: sin la vuelta de la 0520 aborta sin crear nada", async () => {
    const run = await contract({
      [`${NOMBRE}.test.sql`]: read(CONTRACT)
        .split(`\\ir ../migrations/${MIGRACION}`)
        .join(
          `drop function public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint);\n\\ir ../migrations/${MIGRACION}`,
        ),
    });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0521 requiere 0519/);
  }, SLOW);

  it("aplicada en producción el 2026-11-08: ya no es una espera y quedó sellada con el md5 del ledger", () => {
    expect(BASELINE.pendingBelowCutoff[NOMBRE]).toBeUndefined();
    // Por encima del corte: el control del ledger la vigila por su nombre exacto y el candado guarda su
    // identidad (igual que la 0519 y la 0520).
    expect(Number(NOMBRE.slice(0, 4))).toBeGreaterThan(BASELINE.cutoff);
    expect(DECLARATIONS.degradations.some((d) => d.migration === NOMBRE)).toBe(false);
    expect(LOCK.selladas[NOMBRE]).toMatchObject({
      md5: "9613db9ca81059c4f6b308a0d84cb6e5",
      bytes: 18458,
      ledger: { fecha: "2026-11-08", forma: "exacta" },
    });
    // La cabecera no se toca: cambiarla cambiaría el md5 que ya está en el ledger.
    expect(FILE).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
