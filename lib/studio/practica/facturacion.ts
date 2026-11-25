// Contrato compartido de ejercicios: revisión CAS y semilla exclusiva del receptor.
export type LineaPractica = { concepto: string; cantidad: number; centavos: number };
export type FacturaPractica = { codigo: string; embarque: string; estado: "borrador" | "emitida" | "pagada" | "anulada"; lineas: LineaPractica[]; pagado: number; recibo?: string };
export type FacturacionPractica = { semilla: "facturacion-1"; generacion: number; facturas: FacturaPractica[]; eventos: { id: string; accion: string; codigo: string; motivo?: string; fecha: string; antes: FacturaPractica[]; despues: FacturaPractica[]; fuente: "practica-personal" }[] };
export type ComandoFactura = { accion: "guardar" | "emitir" | "anular" | "pagar" | "reiniciar"; codigo: string; lineas?: LineaPractica[]; motivo?: string };
export const totalPractica = (lineas: LineaPractica[]) => lineas.reduce((s, l) => s + l.cantidad * l.centavos, 0);
export function erroresLineaPractica(l: LineaPractica) {
  return {
    concepto: typeof l?.concepto !== "string" || !l.concepto.trim() || l.concepto.length > 100 ? "Escribe un concepto de 1 a 100 caracteres." : "",
    cantidad: !Number.isSafeInteger(l?.cantidad) || l.cantidad < 1 || l.cantidad > 10000 ? "Usa una cantidad entera entre 1 y 10000." : "",
    centavos: !Number.isSafeInteger(l?.centavos) || l.centavos < 1 || l.centavos > 100000000 ? "Usa un precio positivo con hasta dos decimales, máximo USD 1000000." : "",
  };
}
export function semillaFacturacion(generacion = 1): FacturacionPractica {
  return { semilla: "facturacion-1", generacion, facturas: [
    { codigo: "PRA-PRE-001", embarque: "PRA-EMB-001", estado: "borrador", lineas: [{ concepto: "Carga propuesta", cantidad: 1, centavos: 30000 }], pagado: 0 },
    { codigo: "PRA-FAC-002", embarque: "PRA-EMB-002", estado: "emitida", lineas: [{ concepto: "Carga por CBM", cantidad: 1, centavos: 25000 }, { concepto: "Sobrepeso", cantidad: 1, centavos: 5000 }], pagado: 0 },
  ], eventos: [] };
}
export function aplicarFactura(actual: FacturacionPractica, comando: ComandoFactura): FacturacionPractica {
  const siguiente = structuredClone(actual);
  if (comando.accion === "reiniciar") {
    const nueva = semillaFacturacion(actual.generacion + 1);
    nueva.eventos = [...actual.eventos, { id: crypto.randomUUID(), accion: "reiniciar", codigo: "espacio", fecha: new Date().toISOString(), antes: structuredClone(actual.facturas), despues: structuredClone(nueva.facturas), fuente: "practica-personal" }];
    return nueva;
  }
  const f = siguiente.facturas.find(f => f.codigo === comando.codigo);
  if (!f) throw new Error("Documento inexistente.");
  switch (comando.accion) {
    case "guardar": {
      if (f.estado !== "borrador") throw new Error("Solo se editan borradores.");
      const ls = comando.lineas;
      if (!Array.isArray(ls) || !ls.length || ls.length > 20 || ls.some(l => Object.values(erroresLineaPractica(l)).some(Boolean)) || !Number.isSafeInteger(totalPractica(ls)) || totalPractica(ls) > 100000000) throw new Error("Revisa conceptos, cantidades e importes positivos con hasta dos decimales.");
      f.lineas = ls.map(l => ({ concepto: l.concepto.trim(), cantidad: l.cantidad, centavos: l.centavos }));
      break;
    }
    case "emitir":
      if (f.estado !== "borrador") throw new Error("Solo se emiten borradores.");
      f.estado = "emitida"; break;
    case "anular":
      if (f.estado !== "emitida" || f.pagado > 0) throw new Error("Para anular debe estar emitida y sin cobros vivos; revierte primero los cobros en Cobranzas.");
      if (typeof comando.motivo !== "string" || comando.motivo.trim().length < 4 || comando.motivo.length > 500) throw new Error("Escribe un motivo entre 4 y 500 caracteres.");
      f.estado = "anulada"; break;
    case "pagar":
      if (f.estado !== "emitida" || f.pagado) throw new Error("El pago ya existe o la factura no está emitida.");
      f.pagado = totalPractica(f.lineas); f.estado = "pagada"; f.recibo = `PRA-REC-${actual.generacion}-${f.codigo}`; break;
    default: throw new Error("Operación desconocida.");
  }
  siguiente.eventos.push({ id: crypto.randomUUID(), accion: comando.accion, codigo: f.codigo, motivo: comando.accion === "anular" ? comando.motivo?.trim() : undefined, fecha: new Date().toISOString(), antes: structuredClone(actual.facturas.filter(v => v.codigo === f.codigo)), despues: [structuredClone(f)], fuente: "practica-personal" });
  return siguiente;
}
