// Documento operativo sintético; nunca contiene el detalle financiero.
export type CargaPractica = { envio: string; cajas: string[]; cliente: string | null; preparada: boolean; preorden?: string; estado: "pendiente" | "recibida" | "consolidada"; consolidado?: string };
export type ChinaPractica = { generacion: number; cargas: CargaPractica[]; eventos: { id: string; fecha: string; accion: string; fuente: "practica-personal"; motivo: string; antes: CargaPractica; despues: CargaPractica }[] };
export type ComandoChina = { accion: "recibir" | "identificar" | "consolidar" | "reiniciar"; envio: string };
export function semillaChina(generacion = 1): ChinaPractica {
  return { generacion, cargas: [
    { envio: "PRA-EMB-001", cajas: ["PRA-CAJA-001", "PRA-CAJA-002"], cliente: "DTD-PRA-001", preparada: true, preorden: "PRA-PRE-001", estado: "recibida" },
    { envio: "PRA-EMB-003", cajas: ["PRA-CAJA-003"], cliente: "DTD-PRA-003", preparada: false, estado: "pendiente" },
    { envio: "PRA-EMB-004", cajas: ["PRA-CAJA-004"], cliente: null, preparada: false, estado: "pendiente" },
  ], eventos: [] };
}
export function aplicarChina(actual: ChinaPractica, comando: ComandoChina): ChinaPractica {
  const siguiente = structuredClone(actual);
  const carga = siguiente.cargas.find(c => c.envio === comando.envio);
  if (!carga) throw new Error("Carga inexistente.");
  const antes = structuredClone(carga);
  switch (comando.accion) {
    case "recibir":
      if (carga.estado !== "pendiente") return siguiente;
      carga.estado = "recibida"; break;
    case "identificar":
      if (carga.cliente) return siguiente;
      if (carga.estado !== "recibida") throw new Error("Recibe primero la carga.");
      carga.cliente = "DTD-PRA-003"; break;
    case "consolidar":
      if (carga.estado === "consolidada") return siguiente;
      if (carga.estado !== "recibida" || !carga.cliente) throw new Error("Recibe e identifica primero la carga.");
      carga.estado = "consolidada"; carga.consolidado = "PRA-CON-001"; break;
    default: throw new Error("Operación desconocida.");
  }
  siguiente.eventos.push({ id: crypto.randomUUID(), fecha: new Date().toISOString(), accion: comando.accion, fuente: "practica-personal", motivo: "Ejercicio sintético de " + comando.accion, antes, despues: structuredClone(carga) });
  return siguiente;
}
