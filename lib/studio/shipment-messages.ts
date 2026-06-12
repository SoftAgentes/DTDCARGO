/**
 * Mensajes customer-facing del modulo Tracking.
 *
 * Capa SEPARADA del estado interno: el operador ve el `status` directo,
 * el cliente final ve el mensaje amigable de aca.
 *
 * Estructura 2-niveles: shipment_service × shipment_status → string.
 *
 * Usado:
 * - En el Studio: preview "asi vera el cliente" debajo de cada cambio de estado.
 * - En el Portal Cliente (SDD futuro): texto principal en /track/[code].
 *
 * Editar el copy aca no requiere migracion ni tocar logica. Solo strings.
 */

import type { ShipmentService, ShipmentStatus } from "./shipment-types";

export const CUSTOMER_MESSAGES: Record<
  ShipmentService,
  Partial<Record<ShipmentStatus, string>>
> = {
  consolidacion: {
    in_warehouse: "Tu carga llegó a nuestra bodega en China.",
    consolidating: "Preparando tu carga para embarque.",
    shipped: "Tu carga zarpó. En ruta a Venezuela.",
    in_transit: "En tránsito marítimo. Prepara tu pago de aduana.",
    in_customs: "En aduana. Paga impuestos para liberar tu carga.",
    arrived_destination: "Llegó a nuestra bodega. Coordina retiro o entrega.",
    delayed_warehouse:
      "Tu carga lleva más de 15 días en bodega — bodegaje en curso.",
    out_for_delivery: "En reparto hacia tu dirección.",
    delivered: "Entregado ✓",
    exception: "Pausa temporal — te contactamos pronto.",
    cancelled: "Operación cerrada.",
  },
  puerta_a_puerta_DDP: {
    in_warehouse: "Tu carga llegó a nuestra bodega en China.",
    consolidating: "Preparando tu carga para embarque.",
    shipped: "Tu carga zarpó. Tu anticipo está vigente.",
    in_transit:
      "En tránsito marítimo. Faltan pocos días para completar tu anticipo.",
    in_customs: "En aduana. Tu pago debió completarse.",
    arrived_destination: "Llegó a nuestra bodega. Coordinamos entrega.",
    delayed_warehouse: "Bodegaje activo — pago pendiente.",
    out_for_delivery: "En reparto hacia tu dirección.",
    delivered: "Entregado ✓",
    exception: "Pausa temporal — te contactamos pronto.",
    cancelled: "Operación cerrada.",
  },
  reserva_FCL: {
    in_warehouse: "Tu contenedor en bodega de origen.",
    shipped: "Tu contenedor zarpó.",
    in_transit: "En tránsito marítimo.",
    in_customs: "En aduana Venezuela.",
    last_mile: "Tu contenedor sale del puerto hacia tu galpón.",
    delivered: "Entregado ✓",
    exception: "Pausa temporal — te contactamos pronto.",
    cancelled: "Operación cerrada.",
  },
  transporte_terrestre: {
    in_warehouse: "Recibido en nuestra bodega.",
    in_transit: "En ruta hacia tu dirección.",
    out_for_delivery: "En reparto.",
    delivered: "Entregado ✓",
    exception: "Pausa temporal — te contactamos pronto.",
    cancelled: "Operación cerrada.",
  },
};

export function getCustomerMessage(
  service: ShipmentService,
  status: ShipmentStatus,
): string {
  return CUSTOMER_MESSAGES[service]?.[status] ?? "Estado actualizado.";
}
