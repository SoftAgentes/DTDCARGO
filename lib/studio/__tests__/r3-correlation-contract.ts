/**
 * SDD-0534 · Envoltorio compartido de las migraciones 0483–0489 corridas de
 * verdad sobre PostgreSQL embebido (PGlite).
 *
 * Cada migración corrige una RPC del lote R3 (0317–0324 salvo 0322, que ya
 * corrigió la 0482 de la SDD-0532): el correlation_id que le pasa al writer
 * AUD-01 se pasaba de 128 con la referencia de su pantalla y la acción se
 * revertía siempre con 22023. Su contrato `supabase/tests/04NN_*.test.sql`
 * monta el writer real (`_audit-writer-real.sql`: 0267 y 0294) y la fixture
 * del contrato 03NN sin su writer simulado; PGlite lo corre con los `.sql`
 * inlineados, así que se prueba el texto que el runbook aplicará.
 *
 * Por migración:
 * - CONTROL ROJO: sin la 04NN el contrato cae con «audit: correlation_id
 *   inválido» en la referencia de la pantalla. Es la reproducción del defecto.
 * - MUTANTES coherentes (con el md5 de su propio cuerpo en el postflight): la
 *   referencia cruda vuelve a pasarse de 128; sha256 también cuando el prefijo
 *   es largo, y si cabe cae en el valor; truncar, hashear sin el id o hashear
 *   todo cambian el valor; el md5 en payload.request_ref pierde la referencia;
 *   sin comentario cae en el catálogo.
 * - PREFLIGHT/POSTFLIGHT: un cuerpo vivo distinto del de 03NN, una RPC sin
 *   DEFINER o sin search_path, un owner o un EXECUTE distintos, y una 04NN que
 *   llegó alterada abortan sin cambiar nada; una deriva sólo de espacios pasa.
 * - TEXTO: el cuerpo de 04NN es el de 03NN salvo el correlation_id, las
 *   huellas son las de esos cuerpos, la fixture y los grants son los del
 *   contrato 03NN, el writer no es simulado y la referencia es la de la
 *   pantalla.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

export type CorrelationCase = {
  /** Migración nueva, p. ej. "0483". */
  n: string;
  /** Migración que crea la RPC, p. ej. "0317". */
  src: string;
  /** Basename sin `.sql` de la migración nueva. */
  file: string;
  /** Basename con `.sql` de la migración 03NN. */
  srcFile: string;
  /** Nombre de la RPC sin esquema. */
  name: string;
  /** Tipos de la firma separados por coma, sin espacios. */
  sig: string;
  /** Prefijo del correlation_id, igual al de la referencia de la pantalla. */
  prefix: string;
  /** Parámetro del id en la RPC. */
  idParam: string;
  /** Pantalla que arma la referencia, relativa a la raíz. */
  screenFile: string;
  /** La plantilla de la referencia, tal cual aparece en la pantalla. */
  screenTemplate: string;
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SLOW = 180_000;
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const md5 = (text: string) => createHash("md5").update(text).digest("hex");

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

export function describeCorrelationMigration(c: CorrelationCase) {
  const contractPath = resolve(ROOT, "supabase/tests", `${c.file}.test.sql`);
  const NEW = `${c.file}.sql`;
  const FILE_NEW = read(resolve(ROOT, "supabase/migrations", NEW));
  const FILE_SRC = read(resolve(ROOT, "supabase/migrations", c.srcFile));
  const FILE_CONTRACT = read(contractPath);
  const FILE_CONTRACT_SRC = read(resolve(ROOT, "supabase/tests", c.srcFile.replace(/\.sql$/, ".test.sql")));
  const FILE_SCREEN = read(resolve(ROOT, c.screenFile));
  const BASELINE = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
    pendingBelowCutoff: Record<string, string>;
  };

  const SIGNATURE = `public.${c.name}(${c.sig})`;
  const HEAD_SRC = `create function public.${c.name}(`;
  const HEAD_NEW = `create or replace function public.${c.name}(`;
  const MD5_NEW = md5(body(FILE_NEW, HEAD_NEW));
  const GREEN = `TEST ${c.n} GREEN: 26 aserciones`;

  // Largos: prefijo con dos puntos + uuid + ':' + (referencia | md5 | sha256).
  const P = c.prefix.length + 1;
  const REF_LEN = P + 36 + 1 + 36;
  const CORR_SRC_LEN = P + 36 + 1 + REF_LEN;
  const MD5_LEN = P + 36 + 1 + 32;
  const SHA256_LEN = P + 36 + 1 + 64;

  const CORRELATION_SRC =
    "  v_correlation := pg_catalog.concat(\n"
    + `    '${c.prefix}:', ${c.idParam}::text, ':', v_request_ref\n`
    + "  );\n";
  const CORRELATION_NEW =
    "  -- SDD-0534: el writer AUD-01 admite 128 caracteres de correlation_id. Con\n"
    + `  -- el md5 de la referencia mide siempre ${MD5_LEN}; la referencia completa queda en\n`
    + "  -- payload.request_ref.\n"
    + "  v_correlation := pg_catalog.concat(\n"
    + `    '${c.prefix}:', ${c.idParam}::text, ':',\n`
    + "    pg_catalog.md5(v_request_ref)\n"
    + "  );\n";
  const HASH_LINE = "    pg_catalog.md5(v_request_ref)\n  );\n";

  /** 04NN con un cambio, y el postflight con el md5 del cuerpo que resulta. */
  function mutant(from: string, to: string): string {
    const text = once(FILE_NEW, from, to);
    return text.split(MD5_NEW).join(md5(body(text, HEAD_NEW)));
  }

  async function contract(replace: Record<string, string> = {}) {
    const db = new PGlite();
    try {
      const results = await db.exec(inline(contractPath, replace));
      const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
      const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith(`TEST ${c.n}`));
      return { error: null as string | null, green };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), green: undefined };
    } finally {
      await db.close();
    }
  }

  describe(`SDD-0534 · ${c.n} correlation_id de ${c.name} (texto)`, () => {
    it(`el cuerpo de ${c.n} es el de ${c.src} salvo el correlation_id`, () => {
      const back = once(body(FILE_NEW, HEAD_NEW), CORRELATION_NEW, CORRELATION_SRC);
      expect(back).toBe(body(FILE_SRC, HEAD_SRC));
    });

    it(`el preflight exige el cuerpo de ${c.src} y el postflight el de ${c.n}`, () => {
      const bodySrc = body(FILE_SRC, HEAD_SRC);
      expect(FILE_NEW).toContain(`v_md5 <> '${md5(bodySrc)}'`);
      expect(FILE_NEW).toContain(`v_md5_normalized <> '${md5(bodySrc.replace(/\s/g, ""))}'`);
      expect(FILE_NEW).toContain(`= '${MD5_NEW}'`);
    });

    it(`el contrato usa el writer real y la fixture y los grants del contrato ${c.src}`, () => {
      expect(FILE_CONTRACT).toContain("\n\\ir _audit-writer-real.sql\n");
      expect(FILE_CONTRACT).not.toMatch(/create (or replace )?function public\.append_audit_event/);
      const start = FILE_CONTRACT.indexOf("\n\\ir _audit-writer-real.sql\n");
      const end = FILE_CONTRACT.indexOf(`\\ir ../migrations/${c.srcFile}`);
      expect(end).toBeGreaterThan(start);
      const statements = FILE_CONTRACT.slice(start, end)
        .split(/^(?=create )/m)
        .slice(1)
        .map((statement) => statement.split("\n\n")[0].trimEnd());
      expect(statements.length).toBeGreaterThan(0);
      for (const statement of statements) expect(FILE_CONTRACT_SRC).toContain(statement);
      const grants = FILE_CONTRACT.match(/^grant [^;]*;/gm) ?? [];
      expect(grants.length).toBeGreaterThan(0);
      for (const grant of grants) expect(FILE_CONTRACT_SRC).toContain(grant);
    });

    it(`la referencia del contrato es la que arma la pantalla, y mide ${REF_LEN}`, () => {
      expect(FILE_SCREEN).toContain(c.screenTemplate);
      expect(FILE_CONTRACT).toContain(`'${c.prefix}:' || v_id::text || ':' || gen_random_uuid()::text`);
      const ref = `${c.prefix}:${crypto.randomUUID()}:${crypto.randomUUID()}`;
      expect(ref).toHaveLength(REF_LEN);
      expect(`${c.prefix}:${crypto.randomUUID()}:${ref}`).toHaveLength(CORR_SRC_LEN);
      expect(CORR_SRC_LEN).toBeGreaterThan(128);
      expect(MD5_LEN).toBeLessThanOrEqual(128);
    });

    it(`fija lock_timeout y statement_timeout como ${c.src}`, () => {
      expect(FILE_NEW).toContain("set lock_timeout = '5s';\nset statement_timeout = '30s';\n");
    });

    it("aplicada al servidor propio el 2026-10-15 con el OK nominal de Sam: ya no es una espera", () => {
      expect(BASELINE.pendingBelowCutoff[c.file]).toBeUndefined();
    });
  });

  describe(`SDD-0534 · ${c.n} correlation_id de ${c.name} (PGlite)`, () => {
    it(`el contrato pasa con ${c.n} y el writer real`, async () => {
      const result = await contract();
      expect(result.error).toBeNull();
      expect(result.green).toBe(GREEN);
    }, SLOW);

    it(`control rojo: sin ${c.n} la referencia de la pantalla cae en el writer AUD-01`, async () => {
      const result = await contract({ [NEW]: "" });
      expect(result.error).toBe("audit: correlation_id inválido");
    }, SLOW);

    const PANTALLA = `TEST ${c.n}: pantalla: correlation_id = prefijo, id y md5 de la referencia`;
    const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
      {
        name: `con la referencia cruda, como ${c.src}`,
        from: HASH_LINE,
        to: "    v_request_ref\n  );\n",
        fails: "audit: correlation_id inválido",
      },
      {
        name: `con sha256 en vez de md5 (${SHA256_LEN} caracteres)`,
        from: HASH_LINE,
        to: "    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_request_ref, 'UTF8')), 'hex')\n  );\n",
        fails: SHA256_LEN > 128 ? "audit: correlation_id inválido" : PANTALLA,
      },
      {
        name: "truncando la referencia cruda a 128",
        from: "  v_correlation := pg_catalog.concat(\n"
          + `    '${c.prefix}:', ${c.idParam}::text, ':',\n`
          + "    pg_catalog.md5(v_request_ref)\n  );\n",
        to: "  v_correlation := pg_catalog.left(pg_catalog.concat(\n"
          + `    '${c.prefix}:', ${c.idParam}::text, ':',\n`
          + "    v_request_ref\n  ), 128);\n",
        fails: PANTALLA,
      },
      {
        name: "sin el id de la entidad",
        from: `    '${c.prefix}:', ${c.idParam}::text, ':',\n    pg_catalog.md5`,
        to: `    '${c.prefix}:',\n    pg_catalog.md5`,
        fails: PANTALLA,
      },
      {
        name: "con el md5 de todo el correlation_id",
        from: "  v_correlation := pg_catalog.concat(\n"
          + `    '${c.prefix}:', ${c.idParam}::text, ':',\n`
          + "    pg_catalog.md5(v_request_ref)\n  );\n",
        to: "  v_correlation := pg_catalog.md5(pg_catalog.concat(\n"
          + `    '${c.prefix}:', ${c.idParam}::text, ':',\n`
          + "    v_request_ref\n  ));\n",
        fails: PANTALLA,
      },
      {
        name: "con el md5 también en payload.request_ref",
        from: "      'request_ref', v_request_ref,\n",
        to: "      'request_ref', pg_catalog.md5(v_request_ref),\n",
        fails: `TEST ${c.n}: pantalla: payload.request_ref conserva la referencia completa`,
      },
      {
        name: "sin el comentario de la SDD-0534",
        from: ` SDD-0534: correlation_id con md5 de la referencia, ${MD5_LEN} caracteres.'`,
        to: "'",
        fails: `TEST ${c.n}: el comentario de la RPC nombra la SDD-0534`,
      },
    ];
    for (const m of MUTANTS) {
      it(`mutante ${m.name}: muere donde debe`, async () => {
        const result = await contract({ [NEW]: mutant(m.from, m.to) });
        expect(result.error).toBe(m.fails);
      }, SLOW);
    }

    /** 03NN con un cambio en su cuerpo, o con sentencias agregadas al final: la producción con deriva. */
    const drift = {
      body: (from: string, to: string) => {
        const b = body(FILE_SRC, HEAD_SRC);
        return FILE_SRC.replace(b, () => once(b, from, to));
      },
      after: (sql: string) => FILE_SRC + "\n" + sql + "\n",
    };

    it(`preflight: si la RPC viva tiene otro cuerpo, ${c.n} aborta`, async () => {
      const result = await contract({
        [c.srcFile]: drift.body("  v_correlation text;\n", "  v_correlation text;\n  -- deriva\n"),
      });
      expect(result.error).toMatch(new RegExp(
        `^${c.n} abortado: ${c.name} tiene otro cuerpo \\(md5 [0-9a-f]{32}, sin espacios [0-9a-f]{32}\\); revisar antes de aplicar$`,
      ));
    }, SLOW);

    it("preflight: un cuerpo que sólo difiere en espacios se acepta", async () => {
      const result = await contract({
        [c.srcFile]: drift.body("  v_correlation text;\n", "  v_correlation   text;\n\n"),
      });
      expect(result.error).toBeNull();
      expect(result.green).toBe(GREEN);
    }, SLOW);

    const PREFLIGHT_SEGURIDAD =
      `${c.n} abortado: ${c.name} falta o no es SECURITY DEFINER con search_path vacío`;
    for (const [name, sql] of [
      ["sin SECURITY DEFINER", `alter function ${SIGNATURE} security invoker;`],
      ["sin el search_path sellado", `alter function ${SIGNATURE} reset search_path;`],
    ]) {
      it(`preflight: ${name}, ${c.n} aborta`, async () => {
        const result = await contract({ [c.srcFile]: drift.after(sql) });
        expect(result.error).toBe(PREFLIGHT_SEGURIDAD);
      }, SLOW);
    }

    const POSTFLIGHT_ACL = `${c.n}: postflight — EXECUTE de ${c.name} no es sólo de authenticated`;
    for (const [name, sql] of [
      ["con EXECUTE para anon", `grant execute on function ${SIGNATURE} to anon;`],
      ["con EXECUTE para service_role", `grant execute on function ${SIGNATURE} to service_role;`],
      ["sin EXECUTE para authenticated", `revoke execute on function ${SIGNATURE} from authenticated;`],
    ]) {
      it(`postflight: ${name}, ${c.n} aborta`, async () => {
        const result = await contract({ [c.srcFile]: drift.after(sql) });
        expect(result.error).toBe(POSTFLIGHT_ACL);
      }, SLOW);
    }

    // Producción con otro owner, o una 04NN que llegó alterada (un cuerpo que no
    // es el revisado, o sin la seguridad de la cabecera): el postflight aborta.
    const POSTFLIGHT_CUERPO =
      `${c.n}: postflight — ${c.name} no quedó con el cuerpo, DEFINER, search_path u owner de ${c.n}`;
    it(`postflight: con otro owner, ${c.n} aborta`, async () => {
      const result = await contract({
        [c.srcFile]: drift.after(`create role dtd_${c.n}_otro nologin;\nalter function ${SIGNATURE} owner to dtd_${c.n}_otro;`),
      });
      expect(result.error).toBe(POSTFLIGHT_CUERPO);
    }, SLOW);

    const SECURITY = "language plpgsql\nsecurity definer\nset search_path = ''\nas $function$";
    for (const [name, from, to] of [
      ["con un cuerpo que no es el revisado", "  v_correlation text;\n", "  v_correlation text;\n  -- alterado\n"],
      ["sin SECURITY DEFINER", SECURITY, SECURITY.replace("security definer\n", "")],
      ["sin el search_path sellado", SECURITY, SECURITY.replace("set search_path = ''\n", "")],
    ]) {
      it(`postflight: una ${c.n} ${name} aborta`, async () => {
        const result = await contract({ [NEW]: once(FILE_NEW, from, to) });
        expect(result.error).toBe(POSTFLIGHT_CUERPO);
      }, SLOW);
    }
  });
}
