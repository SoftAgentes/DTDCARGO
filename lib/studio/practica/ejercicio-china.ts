import { parseScannedLabel } from "@/lib/studio/etiquetas-qr";
import { esUuid } from "./contrato";

export const COMPRA_CHINA = "PRA-COMPRA-CHINA-001";
export const CODIGOS_CHINA = ["DTD-B-99007131", "DTD-B-99007132", "DTD-B-99007133", "DTD-B-99007134"] as const;
export const CONSOLIDADOS_CHINA = ["PRA-CON-CN-A", "PRA-CON-CN-B"] as const;
export type ConsolidadoEjercicio = typeof CONSOLIDADOS_CHINA[number];
export type CajaEjercicio = { codigo: string; secuencia: number; recepcion?: string; estiba?: { consolidado: ConsolidadoEjercicio; lote: string; orden: number; ancho: number } };
export type RecepcionEjercicio = { id: string; cajas: string[]; fecha: string; fragil: boolean; marcaSinAutorizacion: boolean; origen: "CN" };
export type LoteEjercicio = { id: string; compra: string; cajas: string[]; consolidado: ConsolidadoEjercicio; orden: number; ancho: number };
export type TareaEjercicio = { id: string; recepcion: string; titulo: "Marca sin autorización"; estado: "pendiente" | "en_revision" | "resuelta"; evidencia?: "PRA-CARTA-001"; resolucion?: string };
export type ComandoEjercicioChina = { id: string } & (
  | { accion: "recibir"; codigo: string; cantidad: number }
  | { accion: "cargar"; codigo: string; cantidad: number; consolidado: ConsolidadoEjercicio; ancho: number }
  | { accion: "fragil"; recepcion: string; activo: boolean; motivo: string }
  | { accion: "marca"; recepcion: string; motivo: string }
  | { accion: "revisar_tarea"; tarea: string }
  | { accion: "resolver_tarea"; tarea: string; evidencia: "PRA-CARTA-001"; resolucion: string }
);
type EstadoEjercicio = { cajas: CajaEjercicio[]; recepciones: RecepcionEjercicio[]; lotes: LoteEjercicio[]; tareas: TareaEjercicio[] };
export type EjercicioChina = EstadoEjercicio & { version: "china-completa-1"; compra: string; markbox: string; eventos: { id: string; fecha: string; fuente: "practica-personal"; comando: ComandoEjercicioChina; antes: EstadoEjercicio; despues: EstadoEjercicio }[] };
export function semillaEjercicioChina(): EjercicioChina {
  return { version: "china-completa-1", compra: COMPRA_CHINA, markbox: "DTD-PRA-CHINA", cajas: CODIGOS_CHINA.map((codigo,i) => ({codigo,secuencia:i+1})), recepciones: [], lotes: [], tareas: [], eventos: [] };
}
export function consultarEtiquetaChina(estado: EjercicioChina, raw: string) {
  if (typeof raw !== "string" || raw.length > 512) throw new Error("Revisa el código de la etiqueta de práctica.");
  const etiqueta = parseScannedLabel(raw);
  if (etiqueta.kind === "verify_url") throw new Error("La etiqueta del proveedor identifica al cliente. Usa una etiqueta DTD-B de práctica para recibir.");
  const caja = etiqueta.kind === "box_code" && estado.cajas.find(c => c.codigo === etiqueta.code);
  if (!caja) throw new Error("Código desconocido en tu práctica. Usa uno de los cuatro códigos de muestra.");
  return { codigo: caja.codigo, compra: estado.compra, markbox: estado.markbox, anunciadas: estado.cajas.length,
    pendientes: estado.cajas.filter(c => !c.recepcion).map(c => c.codigo),
    disponibles: estado.cajas.filter(c => c.recepcion && !c.estiba).map(c => c.codigo),
    yaRecibida: !!caja.recepcion, montadaEn: caja.estiba?.consolidado ?? null };
}
const foto = (e: EjercicioChina): EstadoEjercicio => structuredClone({cajas:e.cajas,recepciones:e.recepciones,lotes:e.lotes,tareas:e.tareas});
const motivoValido = (m: unknown, min=4): m is string => typeof m === "string" && m.trim().length >= min && m.length <= 300;
function cantidadValida(cantidad: number, disponibles: number) {
  if (!Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > disponibles) throw new Error("En este ejercicio elige una cantidad entera entre 1 y las cajas disponibles.");
}
export function aplicarEjercicioChina(actual: EjercicioChina, comando: ComandoEjercicioChina, fecha = new Date().toISOString()): EjercicioChina {
  if (!comando || !esUuid(comando.id)) throw new Error("La operación de práctica necesita una referencia válida.");
  const repetido = actual.eventos.find(e => e.id === comando.id);
  if (repetido) {
    if (JSON.stringify(repetido.comando) !== JSON.stringify(comando)) throw new Error("La referencia ya se usó para otra operación de práctica.");
    return structuredClone(actual);
  }
  const siguiente = structuredClone(actual), antes = foto(actual);
  switch (comando.accion) {
    case "recibir": {
      const consulta = consultarEtiquetaChina(siguiente, comando.codigo);
      const pendientes = siguiente.cajas.filter(c => !c.recepcion);
      cantidadValida(comando.cantidad, pendientes.length);
      const escaneada = pendientes.find(c=>c.codigo===consulta.codigo);
      const cajas = [...(escaneada ? [escaneada] : []), ...pendientes.filter(c=>c.codigo!==consulta.codigo)].slice(0,comando.cantidad);
      const id = `PRA-REC-CN-${String(siguiente.recepciones.length+1).padStart(3,"0")}`;
      for (const caja of cajas) caja.recepcion = id;
      siguiente.recepciones.push({ id, cajas:cajas.map(c=>c.codigo), fecha, fragil:false, marcaSinAutorizacion:false, origen:"CN" });
      break;
    }
    case "cargar": {
      const consulta = consultarEtiquetaChina(siguiente,comando.codigo);
      if (!consulta.yaRecibida) throw new Error("Recibe primero la caja escaneada antes de montar el lote.");
      if (consulta.montadaEn) throw new Error("La caja escaneada ya está montada. Escanea una caja recibida disponible.");
      if (!CONSOLIDADOS_CHINA.includes(comando.consolidado) || ![0,1,2].includes(comando.ancho)) throw new Error("Elige un consolidado de práctica y una posición válida.");
      const disponibles = siguiente.cajas.filter(c => c.recepcion && !c.estiba);
      cantidadValida(comando.cantidad,disponibles.length);
      const cajas = [disponibles.find(c=>c.codigo===consulta.codigo)!, ...disponibles.filter(c=>c.codigo!==consulta.codigo)].slice(0,comando.cantidad);
      const id = `PRA-LOTE-CN-${String(siguiente.lotes.length+1).padStart(3,"0")}`;
      const orden = siguiente.lotes.filter(l=>l.consolidado===comando.consolidado).length;
      for (const caja of cajas) caja.estiba={consolidado:comando.consolidado,lote:id,orden,ancho:comando.ancho};
      siguiente.lotes.push({id,compra:actual.compra,cajas:cajas.map(c=>c.codigo),consolidado:comando.consolidado,orden,ancho:comando.ancho});
      break;
    }
    case "fragil": case "marca": {
      const recepcion=siguiente.recepciones.find(r=>r.id===comando.recepcion);
      if (!recepcion || !motivoValido(comando.motivo)) throw new Error("Elige una recepción y escribe un motivo ficticio de 4 a 300 caracteres.");
      if (comando.accion === "fragil") {
        if (typeof comando.activo !== "boolean") throw new Error("Elige aplicar o retirar Frágil.");
        recepcion.fragil=comando.activo;
      } else {
        if (recepcion.marcaSinAutorizacion) throw new Error("Esta recepción ya tiene una tarea documental pendiente.");
        recepcion.marcaSinAutorizacion=true;
        siguiente.tareas.push({id:`PRA-TAREA-CN-${String(siguiente.tareas.length+1).padStart(3,"0")}`,recepcion:recepcion.id,titulo:"Marca sin autorización",estado:"pendiente"});
      }
      break;
    }
    case "revisar_tarea": case "resolver_tarea": {
      const tarea=siguiente.tareas.find(t=>t.id===comando.tarea);
      if (!tarea || tarea.estado === "resuelta") throw new Error("La tarea documental no está pendiente de resolver.");
      if (comando.accion === "revisar_tarea") tarea.estado="en_revision";
      else {
        if (tarea.estado !== "en_revision" || comando.evidencia !== "PRA-CARTA-001" || !motivoValido(comando.resolucion,8)) throw new Error("Revisa la tarea y registra la carta sintética y una resolución de 8 a 300 caracteres.");
        tarea.estado="resuelta"; tarea.evidencia=comando.evidencia; tarea.resolucion=comando.resolucion.trim();
        siguiente.recepciones.find(r=>r.id===tarea.recepcion)!.marcaSinAutorizacion=false;
      }
      break;
    }
    default: throw new Error("Operación de ejercicio desconocida.");
  }
  siguiente.eventos.push({id:comando.id,fecha,fuente:"practica-personal",comando:structuredClone(comando),antes,despues:foto(siguiente)});
  return siguiente;
}
export function cajasDeConsolidado(estado: EjercicioChina, consolidado: ConsolidadoEjercicio) {
  return estado.cajas.filter(c=>c.estiba?.consolidado===consolidado).map(c=>{
    const recepcion=estado.recepciones.find(r=>r.id===c.recepcion)!;
    return { ...structuredClone(c), compra:estado.compra, markbox:estado.markbox, origen:"CN" as const,
      indicadores:{fragil:recepcion.fragil,marcaSinAutorizacion:recepcion.marcaSinAutorizacion},
      indicadoresAlmacenVe:recepcion.fragil ? ["Frágil / 易碎"] : [] };
  });
}

export type EtapaLecturaChina = "shipments" | "ve";
export type CajaChinaLectura = { codigo: string; secuencia: number; compra: string; markbox: string; recepcion: string; fechaRecepcion: string; lote: string; consolidado: ConsolidadoEjercicio; orden: number; ancho: number; indicadores: {codigo:"fragil"|"marca_sin_autorizacion";nombre:string;origen:"CN"}[] };
export function proyectarCajasChina(estado: EjercicioChina, consolidado: ConsolidadoEjercicio, etapa: EtapaLecturaChina): CajaChinaLectura[] {
  return estado.cajas.filter(c=>c.estiba?.consolidado===consolidado).map(c=>{
    const recepcion=estado.recepciones.find(r=>r.id===c.recepcion)!;
    const indicadores: CajaChinaLectura["indicadores"]=[];
    if (recepcion.fragil) indicadores.push({codigo:"fragil",nombre:"Frágil / 易碎",origen:"CN"});
    if (etapa === "shipments" && recepcion.marcaSinAutorizacion) indicadores.push({codigo:"marca_sin_autorizacion",nombre:"Marca sin autorización",origen:"CN"});
    return {codigo:c.codigo,secuencia:c.secuencia,compra:estado.compra,markbox:estado.markbox,recepcion:recepcion.id,fechaRecepcion:recepcion.fecha,lote:c.estiba!.lote,consolidado,orden:c.estiba!.orden,ancho:c.estiba!.ancho,indicadores};
  });
}
