// @vitest-environment node
/**
 * SDD-0505 · La migración 0472 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0472_kommo_functions_base_url.test.sql` corre en
 * `verify` con Docker (postgres:17 con el stub de Vault, o supabase/postgres con
 * el Vault real), pero el CI de calidad no tiene Docker. PGlite corre ese MISMO
 * contrato con el `.sql` real de la migración inlineado: lo que se prueba es el
 * texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0472 (las funciones como las dejaron 0084/0136) el contrato
 * cae en la aserción de la base nueva, no antes: sin el secreto se comportan
 * igual. MUTANTES: sin cada regla, el contrato cae en la aserción de esa regla.
 *
 * LÍNEA A LÍNEA: 0472 promete copiar los cuerpos de 0084 (11-43) y 0136
 * (150-182) verbatim salvo `v_base`; y el contrato promete que su ANTES es la
 * copia exacta de esos mismos bloques. Las dos promesas se miden contra los
 * archivos, no contra la memoria de quien las escribió.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0472_kommo_functions_base_url.test.sql");
const M0472 = "0472_kommo_functions_base_url.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0472 = read(resolve(ROOT, "supabase/migrations", M0472));
const FILE_0084 = read(resolve(ROOT, "supabase/migrations/0084_kommo_cron_sync.sql"));
const FILE_0136 = read(resolve(ROOT, "supabase/migrations/0136_kommo_writeback_outbox.sql"));
const FILE_CONTRACT = read(CONTRACT);
const BASELINE = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
  pendingBelowCutoff: Record<string, string>;
};
const SLOW = 120_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes del contrato: \set, \if :{?v} / :v,
 * \else, \endif e \ir. `replace` sustituye el texto de una migración (mutante).
 */
function inline(file: string, vars: Record<string, string>, replace: Record<string, string> = {}): string {
  const state = { ...vars };
  const out: string[] = [];
  const readSql = (path: string) => {
    const key = Object.keys(replace).find((name) => path.endsWith(name));
    return key ? replace[key] : readFileSync(path, "utf8");
  };
  function run(path: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of readSql(path).split(/\r?\n/)) {
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

async function contract(options: { applyFix?: boolean; migration?: string } = {}) {
  const sql = inline(CONTRACT, { apply_fix: String(options.applyFix ?? true) },
    options.migration ? { [M0472]: options.migration } : {});
  const db = new PGlite();
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0472 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** Un único cambio sobre un texto; falla si lo que se cambia no aparece una sola vez. */
function once(text: string, from: string, to: string): string {
  expect(text.split(from), `«${from.slice(0, 40)}…» debe aparecer una sola vez`).toHaveLength(2);
  return text.replace(from, to);
}

/** 0472 con un único cambio. */
function mutant(from: string, to: string): string {
  return once(FILE_0472, from, to);
}

/** El bloque `create or replace function public.<name>() … $$;` de un archivo. */
function block(text: string, name: string): string {
  const head = `create or replace function public.${name}()`;
  const start = text.indexOf(head);
  expect(start, `${name} en el texto`).toBeGreaterThanOrEqual(0);
  const end = text.indexOf("\n$$;", start);
  expect(end, `cierre $$; de ${name}`).toBeGreaterThan(start);
  return text.slice(start, end + "\n$$;".length);
}

const CLOUD = "https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1";
const DECLARE_0472 = "  v_key    text;\n  v_base   text;\n  v_req_id bigint;\n";
const DECLARE_ORIGINAL = "  v_key    text;\n  v_req_id bigint;\n";
function vBase(origin: "0084" | "0136"): string {
  return "  -- Base de la URL: el secreto functions_base_url si existe (servidor propio);\n"
    + `  -- si no, la URL de Cloud de ${origin}. rtrim evita \`//\` con un secreto con barra.\n`
    + "  v_base := rtrim(coalesce(\n"
    + "    (select decrypted_secret from vault.decrypted_secrets where name = 'functions_base_url' limit 1),\n"
    + `    '${CLOUD}'), '/');\n\n`;
}

/** El cuerpo de 0472 sin sus tres adiciones: tiene que ser el de 0084/0136. */
function sinAdiciones(name: string, origin: "0084" | "0136", path: string): string {
  let text = once(block(FILE_0472, name), DECLARE_0472, DECLARE_ORIGINAL);
  text = once(text, vBase(origin), "");
  return once(text, `url     := v_base || '${path}',`, `url     := '${CLOUD}${path}',`);
}

describe("SDD-0505 · 0472 base de la URL de las Edge Functions desde el Vault (texto)", () => {
  it("kommo_run_sync es 0084:11-43 más v_base, y nada más", () => {
    expect(sinAdiciones("kommo_run_sync", "0084", "/kommo-sync")).toBe(block(FILE_0084, "kommo_run_sync"));
  });

  it("kommo_run_writeback_drain es 0136:150-182 más v_base, y nada más", () => {
    expect(sinAdiciones("kommo_run_writeback_drain", "0136", "/kommo-writeback"))
      .toBe(block(FILE_0136, "kommo_run_writeback_drain"));
  });

  it("el ANTES del contrato es la copia exacta de 0084 y 0136", () => {
    expect(block(FILE_CONTRACT, "kommo_run_sync")).toBe(block(FILE_0084, "kommo_run_sync"));
    expect(block(FILE_CONTRACT, "kommo_run_writeback_drain")).toBe(block(FILE_0136, "kommo_run_writeback_drain"));
  });

  it("no toca el agendado de pg_cron", () => {
    // La cabecera sí nombra cron.schedule para explicar que NO se repite; se
    // mide el código, no los comentarios.
    const code = FILE_0472.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
    expect(code).not.toMatch(/cron\.(schedule|unschedule)/);
  });

  it("está declarada como espera con lo que el operador tiene que leer", () => {
    const entry = BASELINE.pendingBelowCutoff["0472_kommo_functions_base_url"];
    expect(entry).toBeTypeOf("string");
    expect(FILE_0472).toContain("Declarada como espera en\n--    supabase/migrations-baseline.json › pendingBelowCutoff");
    for (const text of ["MIGRATE-FIRST", "functions_base_url", "http://functions:9000", "FUSIONAR LA PR NO AUTORIZA"]) {
      expect(entry).toContain(text);
    }
  });
});

describe("SDD-0505 · 0472 base de la URL de las Edge Functions desde el Vault (PGlite)", () => {
  it("el contrato pasa con 0472", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0472 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: con las funciones de 0084/0136 falla en la base nueva, no antes", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0472: con functions_base_url en Vault, kommo_run_sync llama a la base nueva");
  }, SLOW);

  const SYNC_TAIL = "\n\n  select net.http_post(\n    url     := v_base || '/kommo-sync',";
  const DRAIN_TAIL = "\n\n  select net.http_post(\n    url     := v_base || '/kommo-writeback',";
  const LOOKUP = "    (select decrypted_secret from vault.decrypted_secrets where name = 'functions_base_url' limit 1),\n";
  const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "sin rtrim en kommo_run_sync",
      from: `  v_base := rtrim(coalesce(\n${LOOKUP}    '${CLOUD}'), '/');${SYNC_TAIL}`,
      to: `  v_base := coalesce(\n${LOOKUP}    '${CLOUD}');${SYNC_TAIL}`,
      fails: "TEST 0472: un secreto con barra final no produce doble barra en kommo_run_sync",
    },
    {
      name: "que lee otro nombre de secreto en kommo_run_sync",
      from: `${LOOKUP}    '${CLOUD}'), '/');${SYNC_TAIL}`,
      to: `${LOOKUP.replace("'functions_base_url'", "'functions_base_urls'")}    '${CLOUD}'), '/');${SYNC_TAIL}`,
      fails: "TEST 0472: con functions_base_url en Vault, kommo_run_sync llama a la base nueva",
    },
    {
      name: "con la ruta del writeback en kommo_run_sync",
      from: "url     := v_base || '/kommo-sync',",
      to: "url     := v_base || '/kommo-writeback',",
      fails: "TEST 0472: sin functions_base_url en Vault, kommo_run_sync llama a la URL de Cloud de 0084",
    },
    {
      name: "con el coalesce invertido en kommo_run_writeback_drain",
      from: `  v_base := rtrim(coalesce(\n${LOOKUP}    '${CLOUD}'), '/');${DRAIN_TAIL}`,
      to: `  v_base := rtrim(coalesce(\n    '${CLOUD}',\n${LOOKUP.replace("),\n", ")), '/');\n")}${DRAIN_TAIL}`,
      fails: "TEST 0472: con functions_base_url en Vault, kommo_run_writeback_drain llama a la base nueva",
    },
    {
      name: "con otra URL de Cloud de respaldo en kommo_run_writeback_drain",
      from: `    '${CLOUD}'), '/');${DRAIN_TAIL}`,
      to: `    '${CLOUD.replace("/v1", "/v2")}'), '/');${DRAIN_TAIL}`,
      fails: "TEST 0472: sin functions_base_url en Vault, kommo_run_writeback_drain llama a la URL de Cloud de 0136",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({ migration: mutant(m.from, m.to) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }
});
