// @vitest-environment node
/**
 * SDD-0532 · La migración 0482 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato de 0322 simula el writer AUD-01 y usa referencias cortas, así que
 * no vio que «Autorizar» falla siempre: la pantalla manda una referencia de 109
 * caracteres, la 0322 arma con ella un correlation_id de 174 y el writer real
 * (0294 → 0267) admite 128. El contrato
 * `supabase/tests/0482_naviera_autorizar_correlation_id.test.sql` monta el
 * writer de verdad (0267 y 0294 reales) y PGlite lo corre con los `.sql`
 * inlineados: lo que se prueba es el texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0482 el contrato cae con «audit: correlation_id inválido»
 * en la referencia de la pantalla. Es la reproducción del defecto.
 * MUTANTES: cada uno es una 0482 coherente (con el md5 de su propio cuerpo en
 * el postflight) y cae donde rompe: la referencia cruda y el sha256 vuelven a
 * pasarse de 128; truncar, hashear sin el id o hashear todo cambian el valor.
 * PREFLIGHT/POSTFLIGHT: un cuerpo vivo distinto del de 0322, una RPC sin
 * DEFINER o sin search_path, un owner o un EXECUTE distintos, y una 0482 que
 * llegó alterada abortan sin cambiar nada.
 * TEXTO: el cuerpo de 0482 es el de 0322 salvo el correlation_id, los md5 del
 * preflight y del postflight son los de esos cuerpos, la fixture Naviera es la
 * del contrato 0322 y la referencia del contrato es la de la pantalla.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0482_naviera_autorizar_correlation_id.test.sql");
const M0482 = "0482_naviera_autorizar_correlation_id.sql";
const M0322 = "0322_naviera_consolidation_authorization_governance.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0482 = read(resolve(ROOT, "supabase/migrations", M0482));
const FILE_0322 = read(resolve(ROOT, "supabase/migrations", M0322));
const FILE_CONTRACT = read(CONTRACT);
const FILE_CONTRACT_0322 = read(
  resolve(ROOT, "supabase/tests/0322_naviera_consolidation_authorization_governance.test.sql"),
);
const FILE_CLIENT = read(resolve(ROOT, "app/studio/(app)/naviera/_components/NavieraClient.tsx"));
const BASELINE = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
  pendingBelowCutoff: Record<string, string>;
};
const SLOW = 180_000;
const GREEN = "TEST 0482 GREEN: 26 aserciones";
const SIGNATURE = "public.authorize_consolidation_governed(uuid,text,text)";

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
  const db = new PGlite();
  try {
    const results = await db.exec(inline(CONTRACT, replace));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0482"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** Un único cambio sobre un texto; falla si lo que se cambia no aparece una sola vez. */
function once(text: string, from: string, to: string): string {
  expect(text.split(from), `«${from.slice(0, 50)}…» debe aparecer una sola vez`).toHaveLength(2);
  return text.replace(from, () => to);
}

/** El cuerpo (prosrc) de la RPC en un archivo: lo que hay entre `as $function$` y `$function$;`. */
function body(text: string, head: string): string {
  const start = text.indexOf(head);
  expect(start, `${head} en el texto`).toBeGreaterThanOrEqual(0);
  const from = text.indexOf("as $function$", start) + "as $function$".length;
  return text.slice(from, text.indexOf("$function$;", from));
}
const HEAD_0322 = "create function public.authorize_consolidation_governed(";
const HEAD_0482 = "create or replace function public.authorize_consolidation_governed(";
const md5 = (text: string) => createHash("md5").update(text).digest("hex");
const MD5_0482 = md5(body(FILE_0482, HEAD_0482));

/** 0482 con un cambio, y el postflight con el md5 del cuerpo que resulta. */
function mutant(from: string, to: string): string {
  const text = once(FILE_0482, from, to);
  return text.split(MD5_0482).join(md5(body(text, HEAD_0482)));
}

const CORRELATION_0322 =
  "  v_correlation := pg_catalog.concat(\n"
  + "    'consolidation-authorization:', p_consolidation_id::text, ':', v_request_ref\n"
  + "  );\n";
const CORRELATION_0482 =
  "  -- SDD-0532: el writer AUD-01 admite 128 caracteres de correlation_id. Con\n"
  + "  -- el md5 de la referencia mide siempre 97; la referencia completa queda en\n"
  + "  -- payload.request_ref.\n"
  + "  v_correlation := pg_catalog.concat(\n"
  + "    'consolidation-authorization:', p_consolidation_id::text, ':',\n"
  + "    pg_catalog.md5(v_request_ref)\n"
  + "  );\n";
const HASH_LINE = "    pg_catalog.md5(v_request_ref)\n  );\n";

describe("SDD-0532 · 0482 correlation_id de la autorización Naviera (texto)", () => {
  it("el cuerpo de 0482 es el de 0322 salvo el correlation_id", () => {
    const back = once(body(FILE_0482, HEAD_0482), CORRELATION_0482, CORRELATION_0322);
    expect(back).toBe(body(FILE_0322, HEAD_0322));
  });

  it("el preflight exige el cuerpo de 0322 y el postflight el de 0482", () => {
    const b0322 = body(FILE_0322, HEAD_0322);
    expect(FILE_0482).toContain(`v_md5 <> '${md5(b0322)}'`);
    expect(FILE_0482).toContain(`v_md5_normalized <> '${md5(b0322.replace(/\s/g, ""))}'`);
    expect(FILE_0482).toContain(`= '${MD5_0482}'`);
  });

  it("la fixture Naviera del contrato es la del contrato 0322", () => {
    const slice = (text: string, from: string, to: string) => {
      const start = text.indexOf(from);
      expect(start, from).toBeGreaterThanOrEqual(0);
      return text.slice(start, text.indexOf(to, start));
    };
    for (const [from, to] of [
      ["create table public.user_tenants", ");\n"],
      ["create table public.consolidations", ");\n"],
      ["create function public.next_consolidation_ref", "end $$;"],
    ]) {
      expect(slice(FILE_CONTRACT, from, to)).toBe(slice(FILE_CONTRACT_0322, from, to));
    }
  });

  it("la referencia del contrato es la que arma la pantalla, y mide 109", () => {
    expect(FILE_CLIENT).toContain("`naviera-consolidation-authorization:${c.id}:${crypto.randomUUID()}`");
    expect(FILE_CONTRACT).toContain(
      "'naviera-consolidation-authorization:' || v_id::text || ':' || gen_random_uuid()::text",
    );
    const ref = `naviera-consolidation-authorization:${crypto.randomUUID()}:${crypto.randomUUID()}`;
    expect(ref).toHaveLength(109);
    expect(`consolidation-authorization:${crypto.randomUUID()}:${ref}`).toHaveLength(174);
  });

  it("fija lock_timeout y statement_timeout como 0322", () => {
    expect(FILE_0482).toContain("set lock_timeout = '5s';\nset statement_timeout = '30s';\n");
  });

  it("es una espera declarada hasta que Sam la autorice por nombre", () => {
    const entry = BASELINE.pendingBelowCutoff["0482_naviera_autorizar_correlation_id"];
    expect(entry).toBeDefined();
    for (const text of ["SDD-0532", "OK nominal de Sam", "aplicar-migraciones-prod.md"]) {
      expect(entry).toContain(text);
    }
  });
});

describe("SDD-0532 · 0482 correlation_id de la autorización Naviera (PGlite)", () => {
  it("el contrato pasa con 0482 y el writer real", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toBe(GREEN);
  }, SLOW);

  it("control rojo: sin 0482 la referencia de la pantalla cae en el writer AUD-01", async () => {
    const result = await contract({ [M0482]: "" });
    expect(result.error).toBe("audit: correlation_id inválido");
  }, SLOW);

  const PANTALLA = "TEST 0482: pantalla: correlation_id = prefijo, id y md5 de la referencia";
  const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "con la referencia cruda, como 0322",
      from: HASH_LINE,
      to: "    v_request_ref\n  );\n",
      fails: "audit: correlation_id inválido",
    },
    {
      name: "con sha256 en vez de md5 (129 caracteres)",
      from: HASH_LINE,
      to: "    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_request_ref, 'UTF8')), 'hex')\n  );\n",
      fails: "audit: correlation_id inválido",
    },
    {
      name: "truncando la referencia cruda a 128",
      from: "  v_correlation := pg_catalog.concat(\n"
        + "    'consolidation-authorization:', p_consolidation_id::text, ':',\n"
        + "    pg_catalog.md5(v_request_ref)\n  );\n",
      to: "  v_correlation := pg_catalog.left(pg_catalog.concat(\n"
        + "    'consolidation-authorization:', p_consolidation_id::text, ':',\n"
        + "    v_request_ref\n  ), 128);\n",
      fails: PANTALLA,
    },
    {
      name: "sin el id de la solicitud",
      from: "    'consolidation-authorization:', p_consolidation_id::text, ':',\n    pg_catalog.md5",
      to: "    'consolidation-authorization:',\n    pg_catalog.md5",
      fails: PANTALLA,
    },
    {
      name: "con el md5 de todo el correlation_id",
      from: "  v_correlation := pg_catalog.concat(\n"
        + "    'consolidation-authorization:', p_consolidation_id::text, ':',\n"
        + "    pg_catalog.md5(v_request_ref)\n  );\n",
      to: "  v_correlation := pg_catalog.md5(pg_catalog.concat(\n"
        + "    'consolidation-authorization:', p_consolidation_id::text, ':',\n"
        + "    v_request_ref\n  ));\n",
      fails: PANTALLA,
    },
    {
      name: "con el md5 también en payload.request_ref",
      from: "      'request_ref', v_request_ref,\n",
      to: "      'request_ref', pg_catalog.md5(v_request_ref),\n",
      fails: "TEST 0482: pantalla: payload.request_ref conserva la referencia completa",
    },
    {
      name: "sin el comentario de la SDD-0532",
      from: " SDD-0532: correlation_id con md5 de la referencia, 97 caracteres.'",
      to: "'",
      fails: "TEST 0482: el comentario de la RPC nombra la SDD-0532",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({ [M0482]: mutant(m.from, m.to) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }

  /** 0322 con un cambio en su cuerpo, o con sentencias agregadas al final: la producción con deriva. */
  const drift = {
    body: (from: string, to: string) => {
      const b = body(FILE_0322, HEAD_0322);
      return FILE_0322.replace(b, () => once(b, from, to));
    },
    after: (sql: string) => FILE_0322 + "\n" + sql + "\n",
  };

  it("preflight: si la RPC viva tiene otro cuerpo, 0482 aborta", async () => {
    const result = await contract({
      [M0322]: drift.body("  v_correlation text;\n", "  v_correlation text;\n  -- deriva\n"),
    });
    expect(result.error).toMatch(
      /^0482 abortado: authorize_consolidation_governed tiene otro cuerpo \(md5 [0-9a-f]{32}, sin espacios [0-9a-f]{32}\); revisar antes de aplicar$/,
    );
  }, SLOW);

  it("preflight: un cuerpo que sólo difiere en espacios se acepta", async () => {
    const result = await contract({
      [M0322]: drift.body("  v_correlation text;\n", "  v_correlation   text;\n\n"),
    });
    expect(result.error).toBeNull();
    expect(result.green).toBe(GREEN);
  }, SLOW);

  const PREFLIGHT_SEGURIDAD =
    "0482 abortado: authorize_consolidation_governed falta o no es SECURITY DEFINER con search_path vacío";
  for (const [name, sql] of [
    ["sin SECURITY DEFINER", `alter function ${SIGNATURE} security invoker;`],
    ["sin el search_path sellado", `alter function ${SIGNATURE} reset search_path;`],
  ]) {
    it(`preflight: ${name}, 0482 aborta`, async () => {
      const result = await contract({ [M0322]: drift.after(sql) });
      expect(result.error).toBe(PREFLIGHT_SEGURIDAD);
    }, SLOW);
  }

  const POSTFLIGHT_ACL = "0482: postflight — EXECUTE de authorize_consolidation_governed no es sólo de authenticated";
  for (const [name, sql] of [
    ["con EXECUTE para anon", `grant execute on function ${SIGNATURE} to anon;`],
    ["con EXECUTE para service_role", `grant execute on function ${SIGNATURE} to service_role;`],
    ["sin EXECUTE para authenticated", `revoke execute on function ${SIGNATURE} from authenticated;`],
  ]) {
    it(`postflight: ${name}, 0482 aborta`, async () => {
      const result = await contract({ [M0322]: drift.after(sql) });
      expect(result.error).toBe(POSTFLIGHT_ACL);
    }, SLOW);
  }

  // Producción con otro owner, o una 0482 que llegó alterada (un cuerpo que no
  // es el revisado, o sin la seguridad de la cabecera): el postflight aborta.
  const POSTFLIGHT_CUERPO =
    "0482: postflight — authorize_consolidation_governed no quedó con el cuerpo, DEFINER, search_path u owner de 0482";
  it("postflight: con otro owner, 0482 aborta", async () => {
    const result = await contract({
      [M0322]: drift.after(`create role dtd_0482_otro nologin;\nalter function ${SIGNATURE} owner to dtd_0482_otro;`),
    });
    expect(result.error).toBe(POSTFLIGHT_CUERPO);
  }, SLOW);

  const SECURITY = "returns jsonb\nlanguage plpgsql\nsecurity definer\nset search_path = ''\nas $function$";
  for (const [name, from, to] of [
    ["con un cuerpo que no es el revisado", "  v_correlation text;\n", "  v_correlation text;\n  -- alterado\n"],
    ["sin SECURITY DEFINER", SECURITY, SECURITY.replace("security definer\n", "")],
    ["sin el search_path sellado", SECURITY, SECURITY.replace("set search_path = ''\n", "")],
  ]) {
    it(`postflight: una 0482 ${name} aborta`, async () => {
      const result = await contract({ [M0482]: once(FILE_0482, from, to) });
      expect(result.error).toBe(POSTFLIGHT_CUERPO);
    }, SLOW);
  }
});
