// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pgliteLimpio } from "@/vitest/pglite-limpio";

const bootstrap = readFileSync(resolve("infra/ops/staging/practica-personal.sql"), "utf8");
const identificar = "set dtd.destino = 'practica-personal-nueva'";

describe("Almacén exclusivo de la práctica", () => {
  it.each(["sin marca", "con tabla", "con esquema"])("rechaza un destino %s antes de crear objetos", async (caso) => {
    const db = await pgliteLimpio();
    try {
      if (caso !== "sin marca") await db.exec(identificar);
      if (caso === "con tabla") await db.exec("create table public.testigo (id int)");
      if (caso === "con esquema") await db.exec("create schema otro");
      await expect(db.exec(bootstrap)).rejects.toThrow(/nueva y vacía/);
      await db.exec("rollback");
      expect((await db.query("select to_regnamespace('practica_privada') as esquema")).rows).toEqual([{ esquema: null }]);
    } finally { await db.close(); }
  });

  it("restringe las funciones y tablas, comprueba la instancia y caduca los pases y sesiones", async () => {
    const db = await pgliteLimpio();
    try {
      await db.exec(identificar);
      await db.exec(bootstrap);
      const { rows: [{ instancia }] } = await db.query<{ instancia: string }>("select instancia from practica_privada.destino");
      const propietario = "b".repeat(64);
      const referencia = "R".repeat(96);
      const pase = "c".repeat(64);
      const sesion = "d".repeat(64);
      await db.exec("create role visitante nologin; set role visitante");
      await expect(db.query("select public.practica_sesion($1,$2)", [instancia, sesion])).rejects.toThrow(/permission denied/);
      await db.exec("reset role; set role practica_personal_web");
      await expect(db.query("select * from practica_privada.espacios")).rejects.toThrow(/permission denied/);
      await expect(db.query("select public.practica_reservar($1,$2,$3,$4)", ["00000000-0000-4000-8000-000000000000", pase, propietario, referencia])).rejects.toThrow(/Destino/);
      await db.query("select public.practica_reservar($1,$2,$3,$4)", [instancia, pase, propietario, referencia]);
      await db.exec("reset role; update practica_privada.pases set vence = now() - interval '1 second'; set role practica_personal_web");
      expect((await db.query("select public.practica_canjear($1,$2,$3) as ok", [instancia, pase, sesion])).rows).toEqual([{ ok: false }]);
      await db.query("select public.practica_reservar($1,$2,$3,$4)", [instancia, pase, propietario, referencia]);
      expect((await db.query("select public.practica_canjear($1,$2,$3) as ok", [instancia, pase, sesion])).rows).toEqual([{ ok: true }]);
      await db.exec("reset role; update practica_privada.sesiones set vence = now() - interval '1 second'; set role practica_personal_web");
      expect((await db.query("select public.practica_sesion($1,$2) as vista", [instancia, sesion])).rows).toEqual([{ vista: null }]);
    } finally { await db.close(); }
  });
});
