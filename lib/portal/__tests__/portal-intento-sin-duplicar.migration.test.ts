// @vitest-environment node
/**
 * SDD-0599 · La migración 0512 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0512_portal_intento_sin_duplicar.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese MISMO
 * contrato, con los `.sql` reales de las migraciones inlineados: lo que se prueba es
 * el texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0512 no hay columna ni candado.
 *
 * MUTANTES: se corren sin el postflight de la propia migración, para que los tenga
 * que cazar el contrato y no el autochequeo.
 *
 * LÍMITE: PGlite tiene una sola conexión. Que dos intentos simultáneos no pasen lo da
 * el índice único, y `on conflict` en mensajes; aquí se prueba en serie.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0512_portal_intento_sin_duplicar.test.sql");
const M0512 = "0512_portal_intento_sin_duplicar.sql";
const FILE_0512 = readFileSync(resolve(ROOT, "supabase/migrations", M0512), "utf8");
const SLOW = 240_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/** psql → SQL plano con las metaórdenes del contrato: \set, \if, \else, \endif e \ir. */
function inline(file: string, vars: Record<string, string>, migration?: string): string {
  const state = { ...vars };
  const out: string[] = [];
  const read = (path: string) => (migration !== undefined && path.endsWith(M0512) ? migration : readFileSync(path, "utf8"));
  function run(path: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of read(path).split(/\r?\n/)) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) {
        if (active()) out.push(line);
        continue;
      }
      const [, command, rest] = meta;
      if (command === "if") {
        let taken = false;
        if (active()) {
          const defined = rest.match(/^:\{\?(\w+)\}$/);
          const text = defined ? String(defined[1] in state)
            : rest.trim().startsWith(":") ? String(state[rest.trim().slice(1)]) : rest.trim();
          if (!TRUE.test(text) && !FALSE.test(text)) throw new Error("\\if no booleano: " + rest);
          taken = TRUE.test(text);
        }
        stack.push({ active: taken, taken });
      } else if (command === "else") {
        const frame = stack[stack.length - 1];
        frame.active = !frame.taken;
      } else if (command === "endif") {
        stack.pop();
      } else if (!active()) {
        continue;
      } else if (command === "set") {
        const [name, value] = rest.trim().split(/\s+/);
        if (name !== "ON_ERROR_STOP") state[name] = value;
      } else if (command === "ir") {
        run(resolve(dirname(path), rest.trim()));
      } else {
        throw new Error("metaorden psql no soportada: \\" + command);
      }
    }
    if (stack.length > 0) throw new Error("\\if sin cerrar en " + path);
  }
  run(file);
  return out.join("\n");
}

async function contract(options: { applyFix?: boolean; drift?: boolean; migration?: string } = {}) {
  const sql = inline(
    CONTRACT,
    { apply_fix: String(options.applyFix ?? true), drift: String(options.drift ?? false) },
    options.migration,
  );
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0512 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/**
 * 0512 con esos cambios, sin su postflight. `veces` fija cuántas apariciones tiene que
 * encontrar, así una mutación que no calza falla en vez de pasar como superviviente.
 */
function mutant(cambios: [from: string, to: string, veces: number][]): string {
  let text = FILE_0512.slice(0, FILE_0512.indexOf("do $postflight$"));
  for (const [from, to, veces] of cambios) {
    const halladas = text.split(from).length - 1;
    if (halladas !== veces) throw new Error(`«${from}» aparece ${halladas} veces, no ${veces}`);
    text = text.split(from).join(to);
  }
  return text;
}

const CANDADO = "(tenant_id, client_markbox, client_request_id)";
const INSERTA_MENSAJE = `  if v_message_id is null then
    return pg_catalog.jsonb_build_object('conversation_id', v_conv_id, 'replayed', true);
  end if;
`;
const BUSCA_ANTES = `  select m.conversation_id into v_conv_id
  from public.conversation_messages m
  where m.tenant_id = v_tenant and m.external_msg_id = v_external;
  if v_conv_id is not null then
    return pg_catalog.jsonb_build_object('conversation_id', v_conv_id, 'replayed', true);
  end if;
`;

const MUTANTES: { name: string; cambios: [string, string, number][]; espera: RegExp }[] = [
  {
    name: "índices sin Shipping Mark",
    cambios: [[CANDADO, "(tenant_id, client_request_id)", 3]],
    espera: /Los tres índices|Mismo intento/,
  },
  {
    name: "índices sin ser únicos",
    cambios: [["create unique index if not exists", "create index if not exists", 3]],
    espera: /Los tres índices|Mismo intento/,
  },
  {
    name: "índices sin el where, y los NULL de siempre",
    cambios: [["\n  where client_request_id is not null;", ";", 3]],
    espera: /Los tres índices/,
  },
  {
    name: "el mensaje repetido igual suma un no leído",
    cambios: [[INSERTA_MENSAJE, "", 1], [BUSCA_ANTES, "", 1]],
    espera: /no suma un no leído|repetido/,
  },
  {
    name: "no busca antes: un hilo archivado abre uno vacío",
    cambios: [[BUSCA_ANTES, "", 1]],
    espera: /no abre un hilo nuevo/,
  },
  {
    name: "el identificador del mensaje no lleva al cliente",
    cambios: [["'portal:' || v_client_id::text || ':' || p_request_id::text", "'portal:' || p_request_id::text", 1]],
    espera: /identificador|otro cliente/,
  },
  {
    name: "acepta un mensaje sin identificador",
    cambios: [["raise exception 'Falta el identificador del intento' using errcode = '22023';", "null;", 1]],
    espera: /exige identificador/,
  },
  {
    name: "anon puede llamar la firma nueva",
    cambios: [["revoke execute on function public.portal_post_message(text, uuid) from public, anon;", "grant execute on function public.portal_post_message(text, uuid) to anon;", 1]],
    espera: /ACL niega anon/,
  },
];

describe("SDD-0599 · 0512 un reintento no duplica (PGlite)", () => {
  it("el contrato pasa con 0512", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toBe("TEST 0512 GREEN: 39 aserciones");
  }, SLOW);

  it("control rojo: sin 0512 no hay columna ni candado", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toMatch(/TEST 0512: Las tres tablas tienen client_request_id/);
  }, SLOW);

  for (const m of MUTANTES) {
    it(`mutante ${m.name}: lo caza el contrato`, async () => {
      const result = await contract({ migration: mutant(m.cambios) });
      expect(result.error).toMatch(/TEST 0512/);
      expect(result.error).toMatch(m.espera);
    }, SLOW);
  }

  it("el postflight de la propia migración también frena un índice sin Shipping Mark", async () => {
    const corte = FILE_0512.indexOf("do $postflight$");
    const copia = FILE_0512.slice(0, corte).split(CANDADO).join("(tenant_id, client_request_id)") + FILE_0512.slice(corte);
    const result = await contract({ migration: copia });
    expect(result.error).toMatch(/0512: índice de prealertas no quedó instalado/);
  }, SLOW);

  it("el preflight aborta si el índice de external_msg_id de 0106 ya no está", async () => {
    const result = await contract({ drift: true });
    expect(result.error).toMatch(/0512: índice único de external_msg_id/);
  }, SLOW);
});
