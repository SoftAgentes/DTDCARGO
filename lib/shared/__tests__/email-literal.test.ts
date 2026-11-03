// @vitest-environment node
/**
 * El patrón se prueba contra Postgres de verdad, no contra una imitación de `ILIKE`:
 * si el escape no sirviera, un cliente con `_` en el correo dejaría de poder entrar.
 *
 * PGlite no cubre la capa de PostgREST, la que convierte `*` en `%`. Eso lo cubre el
 * doble de `app/entrar/__tests__/entrar-no-promete-envio.test.tsx`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { emailIlikePattern, sameEmail } from "../email-literal";

let db: PGlite;

/** ¿Este correo guardado coincide con lo que la persona escribió? */
async function coincide(guardado: string, escrito: string): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>("select $1 ilike $2 as ok", [
    guardado,
    emailIlikePattern(escrito),
  ]);
  return rows[0].ok;
}

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
});

afterAll(async () => {
  await db.close();
});

describe("emailIlikePattern, en Postgres", () => {
  it.each([
    ["juan.perez@x.com", "juan_perez@x.com"],
    ["juan.perez@x.com", "juan%@x.com"],
    ["juan.perez@x.com", "%@x.com"],
    ["juan-perez@x.com", "juan_perez@x.com"],
    ["juan.perez@x.com", "juan\\.perez@x.com"],
  ])("%s NO coincide con lo escrito %s", async (guardado, escrito) => {
    expect(await coincide(guardado, escrito)).toBe(false);
  });

  it.each([
    ["juan.perez@x.com", "juan.perez@x.com"],
    ["juan_perez@x.com", "juan_perez@x.com"],
    ["Juan_Perez@X.COM", "juan_perez@x.com"],
    ["juan_perez@x.com", "JUAN_PEREZ@X.COM"],
    ["juan+dtd@x.com", "juan+dtd@x.com"],
    ["a%b@x.com", "a%b@x.com"],
    ["a\\b@x.com", "a\\b@x.com"],
  ])("%s coincide con lo escrito %s", async (guardado, escrito) => {
    expect(await coincide(guardado, escrito)).toBe(true);
  });
});

describe("sameEmail", () => {
  it("compara sin mayúsculas ni espacios en los extremos", () => {
    expect(sameEmail(" Juan_Perez@X.com ", "juan_perez@x.com")).toBe(true);
  });

  it("no acepta un parecido", () => {
    expect(sameEmail("juan.perez@x.com", "juan_perez@x.com")).toBe(false);
    expect(sameEmail("juan.perez@x.com", "juan*@x.com")).toBe(false);
  });

  it("un correo guardado vacío no coincide con nada", () => {
    expect(sameEmail(null, "juan@x.com")).toBe(false);
    expect(sameEmail(undefined, "juan@x.com")).toBe(false);
    expect(sameEmail("", "juan@x.com")).toBe(false);
  });
});
