import { describe, it, expect } from "vitest";
import { aplicarChina, semillaChina, normalizarChina } from "../china";
import { aplicarFactura, semillaFacturacion, normalizarFacturacion } from "../facturacion";
import { readFileSync } from "node:fs";

describe("misma carga hasta Venezuela", () => {
  it("reanuda JSON de #811 y #812 sin perder conceptos, estados ni historial", () => {
    const financiera = aplicarFactura(JSON.parse(readFileSync("lib/studio/practica/__tests__/fixtures/fase-2-facturacion.json", "utf8")), {accion:"guardar",codigo:"PRA-PRE-001",lineas:[{concepto:"Edición previa de fase 2",cantidad:1,centavos:12345}]});
    const operativa = JSON.parse(readFileSync("lib/studio/practica/__tests__/fixtures/fase-3-china.json", "utf8"));
    financiera.facturas[0].lineas[0].concepto = "Concepto ya corregido";
    financiera.facturas[1].estado = "pagada"; financiera.facturas[1].pagado = 30000;
    const antes = structuredClone(financiera);
    const normal = normalizarFacturacion(financiera);
    expect(normal.facturas[0].cliente).toBe("DTD-PRA-001");
    expect(normal.facturas[0].cliente).toBe(normalizarChina(operativa).cargas[0].cliente);
    for (let i=0;i<2;i++) {
      const {cliente, ...conservada} = normal.facturas[i];
      expect(cliente).toBeDefined(); expect(conservada).toEqual(antes.facturas[i]);
    }
    expect(normal.eventos).toEqual(antes.eventos);
    expect(normal.eventos).toHaveLength(1);
    expect(financiera).toEqual(antes);
    expect(normalizarFacturacion(normal)).toEqual(normal);
  });
  it("normaliza copia mixta y alias conocido sin reasignar otras cargas", () => {
    const anterior = JSON.parse(readFileSync("lib/studio/practica/__tests__/fixtures/fase-3-china.json", "utf8"));
    // Alias señalado en revisión; el JSON de 8b2dabd ya usa DTD-PRA-001.
    anterior.cargas[0].cliente = "Aurora";
    anterior.cargas[0].estado = "consolidada"; anterior.cargas[0].consolidado = "PRA-CON-001";
    const normal = normalizarChina(anterior);
    expect(normal.cargas[0]).toMatchObject({cliente:"DTD-PRA-001",estado:"consolidada",preorden:"PRA-PRE-001"});
    expect(normal.cargas.slice(1)).toEqual(anterior.cargas.slice(1));
    expect(normal.eventos).toEqual(anterior.eventos);
    const mixta = normalizarFacturacion(semillaFacturacion());
    expect(mixta.facturas[0].cliente).toBe(normal.cargas[0].cliente);
    anterior.cargas[0].cliente = "Otra identidad";
    expect(normalizarChina(anterior).cargas[0].cliente).toBe("Otra identidad");
    anterior.cargas[0].cliente = "Aurora"; anterior.cargas[0].envio = "PRA-EMB-004";
    expect(normalizarChina(anterior).cargas[0].cliente).toBe("Aurora");
  });
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
