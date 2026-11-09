// @vitest-environment node
/**
 * SDD-0586 (10.5, PR 1b) · La migración 0520 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0520_chatwoot_portal_vuelta.test.sql` aplica la 0519 y la 0520
 * REALES sobre la 0006, la 0106, la 0337, la 0503 y la 0504 reales, y llama sus funciones como
 * el servidor de Studio (service_role) y como el admin del tenant (authenticated). PGlite lo
 * corre con los `.sql` inlineados: lo que se prueba es el texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0520 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0520 coherente con un defecto y tiene que caer en la aserción que
 * lo nombra. Los críticos de E10-D37: una sola vez, nada en un hilo archivado y nada fuera del
 * tenant; de §10.5.20: solo el admin, solo los atascados y verificando.
 * APLICADA (2026-11-08, con el OK nominal de Sam, en prueba y en producción): la 0520 salió de
 * las esperas de migrations-baseline.json y quedó sellada en migrations.lock.json. La cabecera
 * «NO APLICADA» se conserva porque el ledger guarda el texto exacto. La última prueba lo fija.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const NOMBRE = "0520_chatwoot_portal_vuelta";
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0520"));
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

describe("SDD-0586 · 0520 la vuelta de Chatwoot al portal y destrabar (PGlite)", () => {
  it("el contrato pasa entero con la 0520", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0520 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("CONTROL ROJO: sin la 0520 la respuesta no existe y el contrato cae", async () => {
    const run = await contract({ [MIGRACION]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/chatwoot_portal_respuesta/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    // ── Críticos (E10-D37) ──
    [
      // Sin el on conflict, el reintento choca con el índice único: el evento quedaría fallido para siempre.
      "el reintento choca en vez de dar duplicado",
      "  on conflict (tenant_id, external_msg_id) where external_msg_id is not null do nothing\n",
      "",
      /conversation_messages_external_idx/,
    ],
    [
      "el duplicado da el cliente (el push sale dos veces)",
      "  returning id into v_id;\n  if v_id is null then\n    resultado := 'duplicado';",
      "  returning id into v_id;\n  cliente_id := v_cliente;\n  if v_id is null then\n    resultado := 'duplicado';",
      /TEST 0520: el duplicado no da cliente: el push sale una sola vez/,
    ],
    [
      "le escribe a un hilo archivado",
      "  if v_archivado is not null then\n    resultado := 'archivado';\n    return next;\n    return;\n  end if;\n",
      "",
      /TEST 0520: a un hilo archivado no le escribe/,
    ],
    [
      "le escribe a una ficha borrada",
      "    where cl.id = v_cliente and cl.tenant_id = p_tenant_id and cl.deleted_at is null\n",
      "    where cl.id = v_cliente and cl.tenant_id = p_tenant_id\n",
      /TEST 0520: a una ficha borrada no le escribe/,
    ],
    [
      "sin el flag",
      "  if not exists (\n    select 1 from public.feature_flags f\n    where f.tenant_id = p_tenant_id and f.key = 'chatwoot_portal' and f.enabled\n  ) then\n    resultado := 'apagado';\n    return next;\n    return;\n  end if;\n",
      "",
      /TEST 0520: con el flag apagado no se escribe/,
    ],
    [
      "otro canal",
      "  where c.id = v_hilo and c.tenant_id = p_tenant_id and c.channel = 'portal'\n  for no key update;",
      "  where c.id = v_hilo and c.tenant_id = p_tenant_id\n  for no key update;",
      /TEST 0520: solo hilos del portal/,
    ],
    [
      "entra sin texto",
      "  if p_cuerpo is null or pg_catalog.btrim(p_cuerpo) = '' then",
      "  if p_cuerpo is null then",
      /TEST 0520: sin texto no escribe/,
    ],
    // ── El hilo y la hora ──
    [
      "no deja el unread_count en 0",
      "      unread_count    = 0\n",
      "      unread_count    = c.unread_count\n",
      /TEST 0520: el unread_count del hilo queda en 0/,
    ],
    [
      "una tardía retrocede el hilo",
      "  set last_message_at = greatest(coalesce(c.last_message_at, v_cuando), v_cuando),",
      "  set last_message_at = v_cuando,",
      /TEST 0520: la tardía no retrocede last_message_at/,
    ],
    [
      "la hora de Studio, no la de Chatwoot",
      "  v_cuando := least(coalesce(p_enviado_at, pg_catalog.now()), pg_catalog.now());",
      "  v_cuando := pg_catalog.now();",
      /TEST 0520: con la hora de Chatwoot/,
    ],
    [
      "una hora en el futuro pasa",
      "  v_cuando := least(coalesce(p_enviado_at, pg_catalog.now()), pg_catalog.now());",
      "  v_cuando := coalesce(p_enviado_at, pg_catalog.now());",
      /TEST 0520: una hora en el futuro queda en ahora/,
    ],
    [
      "entrante en vez de saliente",
      "    p_tenant_id, v_hilo, 'out', v_nombre,",
      "    p_tenant_id, v_hilo, 'in', v_nombre,",
      /TEST 0520: la respuesta es saliente/,
    ],
    // ── El autor ──
    [
      "el vínculo de otro tenant firma",
      "    where l.tenant_id = p_tenant_id and l.chatwoot_user_id = p_chatwoot_user_id;",
      "    where l.chatwoot_user_id = p_chatwoot_user_id;",
      /TEST 0520: el vínculo de otro tenant no firma/,
    ],
    [
      "sin «Agente DTD»",
      "      v_nombre := coalesce(v_nombre, 'Agente DTD');",
      "      v_nombre := v_nombre;",
      /TEST 0520: un vinculado sin perfil firma «Agente DTD»/,
    ],
    // Hallazgo de la revisión independiente de la #434: sin estos casos, quitar btrim y nullif no caía.
    [
      "sin btrim: los bordes del nombre quedan",
      "      select nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ', p.first_name, p.last_name)), '') into v_nombre",
      "      select nullif(pg_catalog.concat_ws(' ', p.first_name, p.last_name), '') into v_nombre",
      /TEST 0520: con su nombre recortado en los bordes/,
    ],
    [
      "sin nullif: un nombre vacío firma ''",
      "      select nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ', p.first_name, p.last_name)), '') into v_nombre",
      "      select pg_catalog.btrim(pg_catalog.concat_ws(' ', p.first_name, p.last_name)) into v_nombre",
      /TEST 0520: un vinculado con el nombre vacío firma «Agente DTD»/,
    ],
    [
      "sin btrim ni nullif",
      "      select nullif(pg_catalog.btrim(pg_catalog.concat_ws(' ', p.first_name, p.last_name)), '') into v_nombre",
      "      select pg_catalog.concat_ws(' ', p.first_name, p.last_name) into v_nombre",
      /TEST 0520: con su nombre recortado en los bordes/,
    ],
    // ── Destrabar (§10.5.20) ──
    [
      "destraba cualquiera",
      "  if not coalesce(public.is_tenant_admin(), false) then",
      "  if false then",
      /TEST 0520: un comercial no destraba/,
    ],
    [
      "destraba lo que no está atascado",
      "  where s.tenant_id = v_tenant and s.estado = 'atascado';",
      "  where s.tenant_id = v_tenant and s.estado <> 'enviando';",
      /TEST 0520: el admin destraba los dos atascados de su tenant/,
    ],
    [
      "destraba sin verificar",
      "  set estado = 'pendiente', proximo_at = pg_catalog.now(), verificar = true,",
      "  set estado = 'pendiente', proximo_at = pg_catalog.now(), verificar = s.verificar,",
      /TEST 0520: verificando: si había llegado, no se duplica/,
    ],
    [
      "destraba sin plazo nuevo",
      "      created_at = pg_catalog.now(), updated_at = pg_catalog.now()\n  where s.tenant_id = v_tenant",
      "      updated_at = pg_catalog.now()\n  where s.tenant_id = v_tenant",
      /TEST 0520: con un plazo nuevo de 24 h/,
    ],
    // ── Acceso ──
    [
      "la respuesta abierta a authenticated",
      "grant execute on function public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint) to service_role;",
      "grant execute on function public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint) to service_role, authenticated;",
      /0520: chatwoot_portal_respuesta tiene que ser solo de service_role/,
    ],
    [
      "destrabar abierto a anon",
      "revoke all on function public.chatwoot_portal_destrabar() from public, anon;",
      "revoke all on function public.chatwoot_portal_destrabar() from public;\ngrant execute on function public.chatwoot_portal_destrabar() to anon;",
      /0520: public\.chatwoot_portal_destrabar\(\) no puede ser de anon/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [MIGRACION]: once(FILE, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  /**
   * Defensa doble: el tenant se filtra en el vínculo y en el hilo; destrabar toma el tenant de la
   * sesión. El defecto real, y su mutante, rompe todos los lugares a la vez.
   */
  const MUTANTES_DOBLES: [string, [string, string][], RegExp][] = [
    [
      "la respuesta entra al hilo de otro tenant",
      [
        [
          "  where hl.tenant_id = p_tenant_id and hl.chatwoot_conversation_id = p_chatwoot_conversation_id;",
          "  where hl.chatwoot_conversation_id = p_chatwoot_conversation_id;",
        ],
        [
          "  where c.id = v_hilo and c.tenant_id = p_tenant_id and c.channel = 'portal'",
          "  where c.id = v_hilo and c.channel = 'portal'",
        ],
        [
          "    where cl.id = v_cliente and cl.tenant_id = p_tenant_id and cl.deleted_at is null\n",
          "    where cl.id = v_cliente and cl.deleted_at is null\n",
        ],
      ],
      /TEST 0520: el vínculo de otro tenant no entra/,
    ],
    [
      "destrabar toca otro tenant",
      [["  where s.tenant_id = v_tenant and s.estado = 'atascado';", "  where s.estado = 'atascado';"]],
      /TEST 0520: el admin destraba los dos atascados de su tenant/,
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

  it("REAPLICAR: el preflight aborta si la vuelta ya existe", async () => {
    const run = await contract({ [MIGRACION]: `${FILE}\n${FILE}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0520: la vuelta del portal ya existe/);
  }, SLOW);

  it("PREFLIGHT: sin la cola de la 0519 aborta sin crear nada", async () => {
    // El fixture usa las tablas de la 0519: se le quita la función que la 0520 exige, justo antes.
    // split/join y no replace: en el reemplazo de String.replace, «$$» vale «$».
    const run = await contract({
      [`${NOMBRE}.test.sql`]: read(CONTRACT)
        .split(`\\ir ../migrations/${MIGRACION}`)
        .join(`drop function public.chatwoot_portal_tomar(uuid, integer, uuid);\n\\ir ../migrations/${MIGRACION}`),
    });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0520 requiere 0519/);
  }, SLOW);

  it("PREFLIGHT: un índice de external_msg_id distinto del de la 0106 aborta", async () => {
    const run = await contract({
      [`${NOMBRE}.test.sql`]: read(CONTRACT)
        .split(`\\ir ../migrations/${MIGRACION}`)
        .join(
          "drop index public.conversation_messages_external_idx;\n" +
            "create unique index conversation_messages_external_idx on public.conversation_messages (external_msg_id);\n" +
            `\\ir ../migrations/${MIGRACION}`,
        ),
    });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0520: índice único de external_msg_id ausente o distinto de 0106/);
  }, SLOW);

  it("aplicada en producción el 2026-11-08: ya no es una espera y quedó sellada con el md5 del ledger", () => {
    expect(BASELINE.pendingBelowCutoff[NOMBRE]).toBeUndefined();
    // Por encima del corte: no se da por reconciliada; el control del ledger la vigila por su nombre exacto y el
    // candado de abajo guarda su identidad (igual que la 0519).
    expect(Number(NOMBRE.slice(0, 4))).toBeGreaterThan(BASELINE.cutoff);
    expect(DECLARATIONS.degradations.some((d) => d.migration === NOMBRE)).toBe(false);
    expect(LOCK.selladas[NOMBRE]).toMatchObject({
      md5: "03bcee54616204644a6981d33ec7764c",
      bytes: 12500,
      ledger: { fecha: "2026-11-08", forma: "exacta" },
    });
    // La cabecera no se toca: cambiarla cambiaría el md5 que ya está en el ledger.
    expect(FILE).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
