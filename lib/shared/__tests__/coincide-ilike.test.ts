// @vitest-environment node
/** La imitación de `ILIKE` de los dobles tiene que decir lo mismo que Postgres. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { coincideIlike } from "./coincide-ilike";

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
});

afterAll(async () => {
  await db.close();
});

const CASOS: Array<[string, string]> = [
  ["a.b@x.com", "a.b@x.com"],
  ["A.B@X.COM", "a.b@x.com"],
  ["a.b@x.com", "a_b@x.com"],
  ["a-b@x.com", "a_b@x.com"],
  ["a.b@x.com", "a\\_b@x.com"],
  ["a_b@x.com", "a\\_b@x.com"],
  ["a.b@x.com", "%@x.com"],
  ["a.b@y.com", "%@x.com"],
  ["a%b@x.com", "a\\%b@x.com"],
  ["axb@x.com", "a\\%b@x.com"],
  ["a\\b@x.com", "a\\\\b@x.com"],
  ["a+b@x.com", "a+b@x.com"],
  ["ab@x.com", "a+b@x.com"],
  ["a.b@x.com", "a?b@x.com"],
];

describe("coincideIlike, contra Postgres", () => {
  it.each(CASOS)("%s ilike %s", async (texto, patron) => {
    const { rows } = await db.query<{ ok: boolean }>("select $1 ilike $2 as ok", [texto, patron]);
    expect(coincideIlike(texto, patron)).toBe(rows[0].ok);
  });

  it("`*` funciona como `%`, igual que en PostgREST", () => {
    expect(coincideIlike("a.b@x.com", "*@x.com")).toBe(true);
    expect(coincideIlike("a.b@y.com", "*@x.com")).toBe(false);
  });
});
