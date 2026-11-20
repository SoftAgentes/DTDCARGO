/**
 * Almacén China · vista «En camino» (SDD-0682 §2.2). PURO: sin base de datos.
 *
 * El equipo de China ve aquí los contenedores que ya salieron de su bodega: los
 * que van en el mar y los ya cargados que aún no zarpan. Por contenedor: número
 * DTD, naviera, ETA, el contador de días y el porcentaje (Sam: «solo el contador
 * y el porcentaje»). Al abrirlo, las recepciones que lleva, con su MARKBOX.
 *
 * La regla de grupo, días y progreso es la de Tracking
 * (`lib/studio/tracking-contenedores.ts`): este módulo no la copia, solo recorta
 * lo que se envía al navegador. NO viaja ningún nombre de importador
 * (SDD-0039 B.9, SDD-0531): solo el MARKBOX, que es lo que China sí ve.
 */

import {
  ordenarContenedores,
  type ContenedorVista,
  type GrupoContenedor,
} from "@/lib/studio/tracking-contenedores";

/** Estados de contenedor que ya no están en la bodega de China. */
export const ESTADOS_EN_CAMINO = ["consolidando", "cerrado", "zarpado"] as const;

/** Una recepción dentro del contenedor: sin nombre de importador. */
export type RecepcionEnCamino = {
  id: string;
  codigo: string;
  markbox: string | null;
  cajas: number;
  cbm: number;
};

export type ContenedorEnCamino = {
  id: string;
  /** Número DTD que usa la oficina («64»), leído de `consolidations.notes`. `null` si no lo dice. */
  numeroDtd: number | null;
  /** Referencia interna (DTD-CONSOL-NNNN) o número físico, si no hay referencia. */
  nombre: string;
  containerNo: string | null;
  /** `mar` = ya zarpó; `origen` = cargado o cargándose, aún no zarpa. */
  grupo: Extract<GrupoContenedor, "mar" | "origen">;
  estadoLabel: string;
  /** Naviera del itinerario (`sailings.carrier_id` → `carriers.name`). */
  naviera: string | null;
  vessel: string | null;
  eta: string | null;
  etaFuente: "naviera" | "itinerario" | null;
  /** Días a la ETA; negativo = ya pasó; `null` = sin ETA (no se inventa). */
  diasRestantes: number | null;
  /** 0–100, el de Tracking. */
  progreso: number;
  clientes: number;
  piezas: number;
  recepciones: RecepcionEnCamino[];
};

/** Lo que el contenedor necesita además de la vista de Tracking. */
export type ExtrasDelContenedor = {
  numeroDtd: number | null;
  naviera: string | null;
  recepciones: RecepcionEnCamino[];
};

const SIN_EXTRAS: ExtrasDelContenedor = { numeroDtd: null, naviera: null, recepciones: [] };

/** Recorta un contenedor de Tracking a lo que muestra Almacén China. */
export function aContenedorEnCamino(
  v: ContenedorVista,
  extras: ExtrasDelContenedor = SIN_EXTRAS,
): ContenedorEnCamino | null {
  if (v.grupo !== "mar" && v.grupo !== "origen") return null;
  return {
    id: v.id,
    numeroDtd: extras.numeroDtd,
    nombre: v.nombre,
    containerNo: v.containerNo,
    grupo: v.grupo,
    estadoLabel: v.estadoLabel,
    naviera: extras.naviera,
    vessel: v.vessel,
    eta: v.eta,
    etaFuente: v.etaFuente,
    diasRestantes: v.diasRestantes,
    progreso: v.progreso,
    clientes: v.clientes,
    piezas: v.items.reduce((s, it) => s + (Number(it.pieces) || 0), 0),
    recepciones: [...extras.recepciones].sort((a, b) => a.codigo.localeCompare(b.codigo, "es")),
  };
}

/**
 * Lista de la vista: primero los que ya van en el mar, y dentro de cada grupo lo
 * que llega antes; sin ETA, al final (orden de Tracking).
 */
export function enCaminoOrdenados(
  vistas: readonly ContenedorVista[],
  extrasPorId: ReadonlyMap<string, ExtrasDelContenedor> = new Map(),
): ContenedorEnCamino[] {
  const lista = ordenarContenedores(vistas)
    .map((v) => aContenedorEnCamino(v, extrasPorId.get(v.id)))
    .filter((c): c is ContenedorEnCamino => c !== null);
  return [...lista.filter((c) => c.grupo === "mar"), ...lista.filter((c) => c.grupo === "origen")];
}

/** Lo que se muestra como nombre del contenedor: «DTD #64», o la referencia si no hay número. */
export function rotuloDelContenedor(c: Pick<ContenedorEnCamino, "numeroDtd" | "nombre">): string {
  return c.numeroDtd !== null ? `DTD #${c.numeroDtd}` : c.nombre;
}
