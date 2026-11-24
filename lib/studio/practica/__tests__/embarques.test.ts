import { describe, it, expect } from "vitest";
import { aplicarChina, semillaChina } from "../china";
import { aplicarFactura, semillaFacturacion } from "../facturacion";

describe("misma carga hasta Venezuela", () => {
  it("conserva cajas, cliente, preorden e historial y no duplica recepción", () => {
    let d = semillaChina();
    const origen = structuredClone(d.cargas[0]);
    for (const accion of ["consolidar", "embarcar", "aduana", "recibir_ve"] as const) d = aplicarChina(d, {accion,envio:origen.envio});
    expect(d.cargas[0]).toMatchObject({envio:origen.envio,cajas:origen.cajas,cliente:origen.cliente,preorden:origen.preorden,estado:"recibida_ve"});
    expect(aplicarChina(d,{accion:"recibir_ve",envio:origen.envio})).toEqual(d);
    expect(d.eventos).toHaveLength(4);
    expect(d.cargas[3]).toEqual(semillaChina().cargas[3]);
  });
  it("impide saltar a Venezuela", () => {
    expect(() => aplicarChina(semillaChina(), {accion:"recibir_ve",envio:"PRA-EMB-001"})).toThrow();
  });
  it("emite solo la preorden elegida, conserva tres conceptos y reintenta sin duplicar", () => {
    const lineas = [{concepto:"CBM",cantidad:1,centavos:20000},{concepto:"Sobrepeso",cantidad:1,centavos:5000},{concepto:"Tercer artículo",cantidad:1,centavos:5000}];
    const inicial = semillaFacturacion();
    const editada = aplicarFactura(inicial,{accion:"guardar",codigo:"PRA-PRE-001",lineas});
    const emitida = aplicarFactura(editada,{accion:"emitir",codigo:"PRA-PRE-001"});
    expect(emitida.facturas[0]).toMatchObject({codigo:"PRA-PRE-001",cliente:"DTD-PRA-001",estado:"emitida",lineas});
    expect(emitida.facturas[1]).toEqual(inicial.facturas[1]);
    expect(() => aplicarFactura(emitida,{accion:"emitir",codigo:"PRA-PRE-001"})).toThrow();
    expect(emitida.facturas).toHaveLength(2);
    expect(() => aplicarFactura(emitida,{accion:"guardar",codigo:"PRA-PRE-001",lineas})).toThrow();
    const pagada = aplicarFactura(emitida,{accion:"pagar",codigo:"PRA-PRE-001"});
    expect(() => aplicarFactura(pagada,{accion:"anular",codigo:"PRA-PRE-001",motivo:"Correcci?n ficticia"})).toThrow();
  });
});
