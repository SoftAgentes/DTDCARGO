import { esUuid } from "./contrato";
import type { CajaChinaLectura, EtapaLecturaChina } from "./ejercicio-china";

// Contrato interno del consumidor. Los identificadores y las cajas deben venir
// de la proyección de #812, nunca de una suma ni de un cliente enviado por la UI.
export type ViajeAutorizado = { consolidado: string; cajas: readonly string[] };
export type PermisosDestino = {
  embarcar: boolean;
  registrarLlegada: boolean;
  recibirCajas: boolean;
  gestionarIncidencia: boolean;
};
export type AccionDestino = "embarcar" | "registrar_llegada" | "recibir_caja" | "abrir_incidencia" | "resolver_incidencia";
export type ComandoDestino = { id: string; accion: AccionDestino; consolidado: string; caja?: string; motivo?: string };
export type ViajeDestino = {
  consolidado: string;
  cajas: string[];
  recibidas: string[];
  estado: "en_transito" | "en_destino" | "recepcion_parcial" | "recepcion_completa";
  incidencia?: { estado: "pendiente" | "resuelta"; motivo: string; resolucion?: string };
};
export type EjercicioDestino = {
  version: "destino-1";
  generacion: number;
  viajes: ViajeDestino[];
  solicitudes: { id: string; contenido: string }[];
  eventos: { id: string; fecha: string; accion: AccionDestino; consolidado: string; caja?: string; motivo?: string;
    fuente: "practica-personal"; antes: ViajeDestino | null; despues: ViajeDestino }[];
};
export function semillaDestino(generacion: number): EjercicioDestino {
  return { version: "destino-1", generacion, viajes: [], solicitudes: [], eventos: [] };
}
export function contenidoComandoDestino(c: ComandoDestino): string {
  return JSON.stringify({ accion: c.accion, consolidado: c.consolidado, caja: c.caja, motivo: c.motivo?.trim() });
}
function permisoPara(accion: AccionDestino, p: PermisosDestino): boolean {
  switch (accion) {
    case "embarcar": return p.embarcar === true;
    case "registrar_llegada": return p.registrarLlegada === true;
    case "recibir_caja": return p.recibirCajas === true;
    case "abrir_incidencia": case "resolver_incidencia": return p.gestionarIncidencia === true;
    default: return false;
  }
}
function motivoValido(motivo: unknown): motivo is string {
  return typeof motivo === "string" && motivo.trim().length >= 4 && motivo.length <= 300;
}
// Se aplica también a la propuesta de mutación de China, antes de guardar el
// documento compartido. Congelar en destino sin cerrar ese escritor no basta.
export function validarManifiestosDestino(actual: EjercicioDestino, viajes: readonly ViajeAutorizado[]): void {
  for (const fijo of actual.viajes) {
    const origen = viajes.find(v => v.consolidado === fijo.consolidado);
    if (!origen || origen.cajas.length !== fijo.cajas.length || new Set(origen.cajas).size !== origen.cajas.length || fijo.cajas.some(c => !origen.cajas.includes(c))) {
      throw new Error("El viaje ya salió con sus cajas fijadas. Conserva la caja disponible para otro consolidado.");
    }
  }
}
export function aplicarDestino(actual: EjercicioDestino, comando: ComandoDestino, contexto: {
  generacion: number; viajes: readonly ViajeAutorizado[]; permisos: PermisosDestino; fecha: string;
}): EjercicioDestino {
  if (actual.generacion !== contexto.generacion) throw new Error("La práctica cambió. Recarga antes de continuar.");
  if (!comando || !esUuid(comando.id) || !permisoPara(comando.accion, contexto.permisos)) throw new Error("No tienes permiso para esta operación o la solicitud es inválida.");
  if (comando.motivo !== undefined && typeof comando.motivo !== "string") throw new Error("Escribe un motivo ficticio de 4 a 300 caracteres.");
  validarManifiestosDestino(actual, contexto.viajes);
  // La autorización se revalida incluso al recuperar un resultado ya aplicado.
  const contenido = contenidoComandoDestino(comando);
  const repetida = actual.solicitudes.find(s => s.id === comando.id);
  if (repetida) {
    if (repetida.contenido !== contenido) throw new Error("La referencia de solicitud pertenece a otra operación.");
    return actual;
  }
  const carga = contexto.viajes.find(v => v.consolidado === comando.consolidado);
  if (!carga || !carga.cajas.length || new Set(carga.cajas).size !== carga.cajas.length) throw new Error("Viaje o cajas de origen inexistentes.");
  if (actual.viajes.some(v => v.consolidado !== carga.consolidado && v.cajas.some(c => carga.cajas.includes(c)))) throw new Error("Una caja ya pertenece a otro viaje.");
  const copia = structuredClone(actual);
  let viaje = copia.viajes.find(v => v.consolidado === carga.consolidado);
  const antes = viaje ? structuredClone(viaje) : null;
  if (viaje && (viaje.cajas.length !== carga.cajas.length || viaje.cajas.some(c => !carga.cajas.includes(c)))) throw new Error("Las cajas del viaje cambiaron. Revisa su origen antes de continuar.");
  switch (comando.accion) {
    case "embarcar":
      if (viaje) throw new Error("El viaje ya fue registrado.");
      viaje = { consolidado: carga.consolidado, cajas: [...carga.cajas], recibidas: [], estado: "en_transito" };
      copia.viajes.push(viaje); break;
    case "registrar_llegada":
      if (!viaje || viaje.estado !== "en_transito") throw new Error("Registra primero el viaje en tránsito.");
      viaje.estado = "en_destino"; break;
    case "abrir_incidencia":
      if (!viaje || !["en_destino", "recepcion_parcial"].includes(viaje.estado) || viaje.incidencia) throw new Error("La observación requiere un viaje llegado y sin incidencia previa.");
      if (!motivoValido(comando.motivo)) throw new Error("Escribe un motivo ficticio de 4 a 300 caracteres.");
      viaje.incidencia = { estado: "pendiente", motivo: comando.motivo.trim() }; break;
    case "resolver_incidencia":
      if (!viaje || viaje.incidencia?.estado !== "pendiente") throw new Error("No hay una observación pendiente en este viaje.");
      if (!motivoValido(comando.motivo)) throw new Error("Escribe una resolución ficticia de 4 a 300 caracteres.");
      viaje.incidencia.estado = "resuelta"; viaje.incidencia.resolucion = comando.motivo.trim(); break;
    case "recibir_caja":
      if (!viaje || viaje.estado === "en_transito") throw new Error("Registra primero la llegada física del viaje.");
      if (!comando.caja || !viaje.cajas.includes(comando.caja)) throw new Error("La caja no pertenece a este viaje.");
      if (viaje.incidencia?.estado === "pendiente") throw new Error("La observación de este viaje sigue pendiente de resolución.");
      if (viaje.recibidas.includes(comando.caja)) return actual;
      viaje.recibidas.push(comando.caja);
      viaje.estado = viaje.recibidas.length === viaje.cajas.length ? "recepcion_completa" : "recepcion_parcial"; break;
    default: throw new Error("Operación de destino desconocida.");
  }
  if (!viaje) throw new Error("Viaje inexistente.");
  copia.solicitudes.push({ id: comando.id, contenido });
  copia.eventos.push({ id: comando.id, fecha: contexto.fecha, accion: comando.accion, consolidado: viaje.consolidado,
    caja: comando.caja, motivo: comando.motivo?.trim(), fuente: "practica-personal", antes, despues: structuredClone(viaje) });
  return copia;
}

// Vista física sin motivos, historial ni tareas documentales. Los indicadores
// físicos se añaden únicamente desde la proyección segura de origen de #812.
export function vistaFisicaDestino(actual: EjercicioDestino) {
  return actual.viajes.map(v => ({ consolidado: v.consolidado, cajas: [...v.cajas], recibidas: [...v.recibidas],
    estado: v.estado, observacionPendiente: v.incidencia?.estado === "pendiente" }));
}
export function vistaViajeDestino(actual: EjercicioDestino, consolidado: string, etapa: EtapaLecturaChina, mostrarMotivo: boolean) {
  const v=actual.viajes.find(v=>v.consolidado===consolidado);
  if (!v) return null;
  return {consolidado:v.consolidado,cajas:[...v.cajas],recibidas:[...v.recibidas],estado:v.estado,
    incidencia:v.incidencia ? {estado:v.incidencia.estado,
      ...(etapa === "shipments" && mostrarMotivo ? {motivo:v.incidencia.motivo,resolucion:v.incidencia.resolucion} : {})} : undefined};
}
export type VistaDestinoPersonal = {revision:number;generacion:number;etapa:EtapaLecturaChina;consolidado:string;
  cajas:CajaChinaLectura[];incidenciaDestino:boolean;edicion:boolean;viaje:ReturnType<typeof vistaViajeDestino>};
