/**
 * Almacén China · vista «En camino» (SDD-0682 §2.2). PURO: sin base de datos.
 *
 * El equipo de China ve aquí los contenedores que ya salieron de su bodega: los
 * que van en el mar y los ya cargados que aún no zarpan. Es una vista mínima:
 * contenedor, buque, ETA, el contador de días y el porcentaje. Sam: «solo el
 * contador y el porcentaje».
 *
 * La regla de grupo, días y progreso es la de Tracking
 * (`lib/studio/tracking-contenedores.ts`): este módulo no la copia, solo recorta
 * lo que se envía al navegador. En particular NO viaja ningún nombre de
 * importador (SDD-0039 B.9, SDD-0531): solo cuántos clientes lleva.
 */

import {
  ordenarContenedores,
  type ContenedorVista,
  type GrupoContenedor,
} from "@/lib/studio/tracking-contenedores";

/** Estados de contenedor que ya no están en la bodega de China. */
export const ESTADOS_EN_CAMINO = ["consolidando", "cerrado", "zarpado"] as const;

export type ContenedorEnCamino = {
  id: string;
  nombre: string;
  containerNo: string | null;
  /** `mar` = ya zarpó; `origen` = cargado o cargándose, aún no zarpa. */
  grupo: Extract<GrupoContenedor, "mar" | "origen">;
  estadoLabel: string;
  /** Buque del itinerario (o del último rastreo de la naviera). */
  vessel: string | null;
  pol: string | null;
  pod: string | null;
  eta: string | null;
  etaFuente: "naviera" | "itinerario" | null;
  /** Días a la ETA; negativo = ya pasó; `null` = sin ETA (no se inventa). */
  diasRestantes: number | null;
  /** 0–100, el de Tracking. */
  progreso: number;
  clientes: number;
  piezas: number;
};

/** Recorta un contenedor de Tracking a lo que muestra Almacén China. */
export function aContenedorEnCamino(v: ContenedorVista): ContenedorEnCamino | null {
  if (v.grupo !== "mar" && v.grupo !== "origen") return null;
  return {
    id: v.id,
    nombre: v.nombre,
    containerNo: v.containerNo,
    grupo: v.grupo,
    estadoLabel: v.estadoLabel,
    vessel: v.vessel,
    pol: v.pol,
    pod: v.pod,
    eta: v.eta,
    etaFuente: v.etaFuente,
    diasRestantes: v.diasRestantes,
    progreso: v.progreso,
    clientes: v.clientes,
    piezas: v.items.reduce((s, it) => s + (Number(it.pieces) || 0), 0),
  };
}

/**
 * Lista de la vista: primero los que ya van en el mar, y dentro de cada grupo lo
 * que llega antes; sin ETA, al final (orden de Tracking).
 */
export function enCaminoOrdenados(vistas: readonly ContenedorVista[]): ContenedorEnCamino[] {
  const ordenadas = ordenarContenedores(vistas);
  const lista = ordenadas
    .map((v) => aContenedorEnCamino(v))
    .filter((c): c is ContenedorEnCamino => c !== null);
  return [...lista.filter((c) => c.grupo === "mar"), ...lista.filter((c) => c.grupo === "origen")];
}
