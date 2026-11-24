// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { aplicarFactura, semillaFacturacion, totalPractica } from "../facturacion";

describe("Facturación sintética", () => {
  it("desglosa, agrega un tercer artículo, emite y cobra solo una vez", () => {
    let d = semillaFacturacion();
    const lineas = [{ concepto: "Carga por CBM", cantidad: 1, centavos: 25000 }, { concepto: "Sobrepeso", cantidad: 1, centavos: 5000 }];
    expect(totalPractica(lineas)).toBe(30000);
    lineas.push({ concepto: "Artículo elegido", cantidad: 2, centavos: 125 });
    d = aplicarFactura(d, { accion: "guardar", codigo: "PRA-PRE-001", lineas });
    expect(totalPractica(d.facturas[0].lineas)).toBe(30250);
    d = aplicarFactura(d, { accion: "emitir", codigo: "PRA-PRE-001" });
    expect(() => aplicarFactura(d, { accion: "guardar", codigo: "PRA-PRE-001", lineas })).toThrow(/borradores/);
    d = aplicarFactura(d, { accion: "pagar", codigo: "PRA-PRE-001" });
    expect(d.facturas[0].pagado).toBe(30250);
    expect(d.facturas[0].estado).toBe("pagada");
    expect(() => aplicarFactura(d, { accion: "pagar", codigo: "PRA-PRE-001" })).toThrow(/ya existe/);
    expect(() => aplicarFactura(d, { accion: "anular", codigo: "PRA-PRE-001", motivo: "Error ficticio" })).toThrow(/cobros vivos/);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 100000001])("rechaza importe %s", centavos => {
    expect(() => aplicarFactura(semillaFacturacion(), { accion: "guardar", codigo: "PRA-PRE-001", lineas: [{ concepto: "Prueba", cantidad: 1, centavos }] })).toThrow(/importes/);
  });
  it("anula con motivo conservando el original y reinicia sin perder historia", () => {
    const d = aplicarFactura(semillaFacturacion(), { accion: "anular", codigo: "PRA-FAC-002", motivo: "Corrección ficticia" });
    expect(d.facturas[1].estado).toBe("anulada");
    expect(d.facturas[1].lineas).toHaveLength(2);
    expect(d.eventos[0]).toMatchObject({ antes:[{estado:"emitida"}], despues:[{estado:"anulada"}], fuente:"practica-personal", motivo:"Corrección ficticia" });
    const nuevo = aplicarFactura(d, { accion: "reiniciar", codigo: "espacio" });
    expect(nuevo.generacion).toBe(2);
    expect(nuevo.eventos).toHaveLength(2);
    expect(nuevo.facturas[1].estado).toBe("emitida");
  });
  it("persiste dos cuentas aisladas y rechaza escrituras y reinicios con revisión antigua", async () => {
    const db = await pgliteLimpio();
    try {
      await db.exec("set dtd.destino='practica-personal-nueva'");
      await db.exec(readFileSync("infra/ops/staging/practica-personal.sql", "utf8"));
      await db.exec(readFileSync("infra/ops/staging/practica-facturacion.sql", "utf8"));
      const { rows: [{ instancia }] } = await db.query<{ instancia: string }>("select instancia from practica_privada.destino");
      for (const x of ["a", "b"]) {
        await db.query("select public.practica_reservar($1,$2,$3,$4)", [instancia, x.repeat(64), x.repeat(64), "R".repeat(96)]);
        await db.query("select public.practica_canjear($1,$2,$3)", [instancia, x.repeat(64), x.repeat(64)]);
      }
      await db.exec("set role practica_personal_web");
      const rpc = async (s: string, revision: number | null = null, documento: unknown = null) => (await db.query<{ valor: { revision: number; documento: ReturnType<typeof semillaFacturacion> } | null }>("select public.practica_facturacion($1,$2,$3,$4::jsonb) as valor", [instancia, s.repeat(64), revision, documento ? JSON.stringify(documento) : null])).rows[0].valor;
      await rpc("a", -1, semillaFacturacion()); await rpc("b", -1, semillaFacturacion());
      const reiniciado = aplicarFactura(semillaFacturacion(), { accion: "reiniciar", codigo: "espacio" });
      expect((await rpc("a", 0, reiniciado))?.revision).toBe(1);
      expect(await rpc("a", 0, reiniciado)).toBeNull();
      expect((await rpc("a"))?.documento.generacion).toBe(2);
      expect((await rpc("b"))?.documento.generacion).toBe(1);
      await expect(rpc("c")).rejects.toThrow(/Sesión vencida/);
      await expect(db.query("select * from practica_privada.documentos")).rejects.toThrow(/permission denied/);
    } finally { await db.close(); }
  });
});
