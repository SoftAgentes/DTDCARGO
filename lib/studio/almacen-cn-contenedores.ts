/**
 * Almacén China · vista «En camino» (SDD-0682 §2.2). PURO: sin base de datos.
 *
 * El equipo de China ve aquí los contenedores que ya zarparon (Sam, 2026-11-20:
 * «solo los que ya zarparon»; así ninguna recepción sale en dos pantallas). Por contenedor: número
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

/**
 * Estados de contenedor que entran en «En camino»: solo `zarpado`. Los que se
 * cargan (`consolidando`) o están cerrados sin zarpar (`cerrado`) quedan fuera:
 * una recepción pendiente de un contenedor que se llena saldría también en
 * «En almacén» (decisión de Sam del 2026-11-20).
 */
export const ESTADOS_EN_CAMINO = ["zarpado"] as const;

/**
 * Estados de contenedor que sacan una recepción consolidada de «En almacén»:
 * `zarpado` (está en «En camino») y `arribado` (ya llegó). Sam, 2026-11-20:
 * mientras el contenedor no zarpe, sus recepciones «quedan en almacén».
 */
export const ESTADOS_FUERA_DE_ALMACEN = ["zarpado", "arribado"] as const;

/** Contenedor en el que va una recepción, con lo necesario para nombrarlo. */
export type ContenedorDeRecepcion = {
  status: string;
  numeroDtd: number | null;
  ref: string | null;
};

/** Dónde se ve una recepción: en la bodega, en «En camino» o en ninguna (ya llegó). */
export type SituacionDeRecepcion = "almacen" | "camino" | "llego";

/**
 * Regla única de dónde va una recepción (SDD-0682). Lo que no está consolidado
 * sigue en la bodega; lo consolidado sigue en la bodega hasta que su contenedor
 * zarpe; al zarpar pasa a «En camino» y al llegar sale de las dos vistas. El
 * contenedor es el vigente del envío (`lineaVigentePorEnvio`). Una recepción
 * consolidada sin contenedor conocido también se queda: así ninguna se pierde y
 * ninguna sale dos veces.
 */
export function situacionDeRecepcion(
  status: string,
  contenedor: ContenedorDeRecepcion | null,
): SituacionDeRecepcion {
  if (status !== "consolidado" || !contenedor) return "almacen";
  if ((ESTADOS_EN_CAMINO as readonly string[]).includes(contenedor.status)) return "camino";
  if ((ESTADOS_FUERA_DE_ALMACEN as readonly string[]).includes(contenedor.status)) return "llego";
  return "almacen";
}

/** Una fila de `consolidation_items`: en qué contenedor se puso un envío y cuándo. */
export type LineaDeContenedor = {
  id: string;
  shipmentId: string;
  consolidationId: string;
  createdAt: string;
};

/**
 * En qué contenedor va cada envío, con la regla vigente del proyecto: si hay más
 * de una línea, gana la más reciente (`created_at`) en un contenedor vivo. Dos
 * líneas del mismo envío significan que se movió de contenedor (partir un envío,
 * SDD-0563/0673, crea la línea nueva en el MISMO contenedor). Es la regla de
 * Embarques (SDD-0643 §3.2, SDD-0661) y del Portal
 * (`lib/portal/consolidation-queries.ts`). Empate de fecha: decide el `id` mayor,
 * para que el resultado no dependa del orden de lectura.
 */
export function lineaVigentePorEnvio(
  lineas: readonly LineaDeContenedor[],
  vivos: ReadonlySet<string>,
): Map<string, string> {
  const mejor = new Map<string, LineaDeContenedor>();
  for (const l of lineas) {
    if (!vivos.has(l.consolidationId)) continue;
    const previa = mejor.get(l.shipmentId);
    if (
      !previa ||
      l.createdAt > previa.createdAt ||
      (l.createdAt === previa.createdAt && l.id > previa.id)
    ) {
      mejor.set(l.shipmentId, l);
    }
  }
  return new Map([...mejor].map(([sid, l]) => [sid, l.consolidationId]));
}

/** Nombre del contenedor para la etiqueta «En contenedor DTD #N, sin zarpar»: el número DTD o la ref. */
export function nombreParaEtiqueta(c: Pick<ContenedorDeRecepcion, "numeroDtd" | "ref">): string {
  return c.numeroDtd !== null ? `DTD #${c.numeroDtd}` : (c.ref ?? "—");
}

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
  /** Siempre `mar`: ya zarpó (regla de grupo de Tracking). */
  grupo: Extract<GrupoContenedor, "mar">;
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
  if (v.grupo !== "mar") return null;
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

/** Lista de la vista: lo que llega antes, primero; sin ETA, al final (orden de Tracking). */
export function enCaminoOrdenados(
  vistas: readonly ContenedorVista[],
  extrasPorId: ReadonlyMap<string, ExtrasDelContenedor> = new Map(),
): ContenedorEnCamino[] {
  return ordenarContenedores(vistas)
    .map((v) => aContenedorEnCamino(v, extrasPorId.get(v.id)))
    .filter((c): c is ContenedorEnCamino => c !== null);
}

/** Lo que se muestra como nombre del contenedor: «DTD #64», o la referencia si no hay número. */
export function rotuloDelContenedor(c: Pick<ContenedorEnCamino, "numeroDtd" | "nombre">): string {
  return c.numeroDtd !== null ? `DTD #${c.numeroDtd}` : c.nombre;
}
