/**
 * Bandera de los avisos por hito (SDD-0627), en un módulo propio y sin
 * imports: `resolve-shipment-eta` la lee sin importar `avisos-por-hito`, que a
 * su vez importa `schedule-client-notifications` (y éste, `resolve-shipment-eta`).
 * Así no hay ciclo.
 *
 * 🔴 Cambia lo que recibe el cliente. En false (estado de entrega) no sale
 * ningún aviso por hito. Encenderla es decisión de Sam, con el ensayo en seco
 * corrido antes sobre el contenedor real. Declarada en
 * scripts/feature-constants.json.
 */
export const AVISOS_POR_HITO_LIVE = false;
