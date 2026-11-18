/**
 * SDD-0654 fase 2 · El estado de un envío en palabras sencillas (bloque 1).
 *
 * Cada frase dice qué pasa con la carga, sin jerga. Se aplica siempre al estado
 * VISIBLE (`effectiveVisibleStatus` con la lectura estricta de ocultos): nunca
 * nombra un hito que el tenant ocultó (FC-14, AC-11).
 *
 * La ruta de cinco etapas agrupa los estados. Una etapa cuyos estados están
 * todos ocultos no se dibuja ni se nombra.
 */
import type { ShipmentStatus } from "@/lib/shared/shipment-public";

export const FRASE_ESTADO: Readonly<Record<ShipmentStatus, string>> = Object.freeze({
  draft: "Estamos preparando tu envío.",
  in_warehouse: "Llegó a nuestro almacén en China.",
  consolidating: "Lo estamos preparando para el contenedor.",
  delayed_warehouse: "Está en el almacén, esperando su salida.",
  shipped: "Ya salió de China.",
  in_transit: "Va en camino a Venezuela.",
  in_customs: "Está en la aduana de Venezuela.",
  arrived_destination: "Llegó a nuestro almacén en Venezuela.",
  out_for_delivery: "Va en camino a tu dirección.",
  last_mile: "Va en camino a tu dirección.",
  delivered: "Entregado.",
  exception: "Tu asesor está revisando este envío.",
  cancelled: "Este envío se canceló.",
});

export type EtapaRuta = { id: string; nombre: string; estados: readonly ShipmentStatus[] };

export const ETAPAS_RUTA: readonly EtapaRuta[] = Object.freeze([
  { id: "preparando", nombre: "Comprado", estados: ["draft"] },
  {
    id: "almacen-china",
    nombre: "En almacén de China",
    estados: ["in_warehouse", "consolidating", "delayed_warehouse"],
  },
  { id: "mar", nombre: "En camino", estados: ["shipped", "in_transit"] },
  { id: "aduana", nombre: "Aduana", estados: ["in_customs"] },
  {
    id: "entrega",
    nombre: "Entrega",
    estados: ["arrived_destination", "out_for_delivery", "last_mile", "delivered"],
  },
]);
