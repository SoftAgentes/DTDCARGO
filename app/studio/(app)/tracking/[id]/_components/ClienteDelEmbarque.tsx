/**
 * Franja «Cliente» de la ficha del embarque (SDD-0662).
 *
 * Va arriba, debajo del encabezado, para que el cambio de cliente no quede
 * escondido al final de la columna derecha:
 *   - con permiso, monta «Pasar a otro cliente» (SDD-0645); si el embarque no
 *     tiene cliente, el panel lo pide como «Asignar cliente»;
 *   - sin permiso, dice qué roles pueden hacerlo (no nombra personas);
 *   - sin ver nombres de clientes (equipo de China, SDD-0531), el buscador no se
 *     monta, tenga el rol que tenga: muestra nombres.
 *
 * Mostrar el botón no concede nada: las server actions y la base repiten el
 * permiso (SDD-0645).
 */

import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { CAPABILITIES } from "@/lib/studio/rbac";
import { roleLabel, type StudioUserRole } from "@/lib/studio/user-types";
import { ReassignClientPanel } from "./ReassignClientPanel";

/** Shipping Mark comodín de un embarque cuyo dueño todavía no se conoce. */
export const MARKBOX_SIN_CLIENTE = "DTD-0000";

/** ¿El embarque está sin cliente? Shipping Mark vacío o el comodín. */
export function esSinCliente(markbox: string | null | undefined): boolean {
  const m = markbox?.trim();
  return !m || m === MARKBOX_SIN_CLIENTE;
}

/** «Admin, Operaciones o Comercial», leído de la misma lista que decide el permiso. */
export function rolesQueCambianElCliente(): string {
  const roles: StudioUserRole[] = ["admin", ...CAPABILITIES.reassign_shipment_owner];
  const nombres = roles.map(roleLabel);
  return nombres.length > 1
    ? `${nombres.slice(0, -1).join(", ")} o ${nombres[nombres.length - 1]}`
    : nombres[0];
}

export function ClienteDelEmbarque({
  shipmentId,
  shipmentCode,
  markbox,
  puedeVerNombres,
  puedeReasignar,
}: {
  shipmentId: string;
  shipmentCode: string;
  markbox: string | null;
  /** SDD-0531: false para el equipo de China. */
  puedeVerNombres: boolean;
  /** El rol tiene la acción `reassign_shipment_owner`. */
  puedeReasignar: boolean;
}) {
  const sinCliente = esSinCliente(markbox);

  if (puedeVerNombres && puedeReasignar) {
    return (
      <ReassignClientPanel
        shipmentId={shipmentId}
        shipmentCode={shipmentCode}
        currentMarkbox={markbox}
        sinCliente={sinCliente}
      />
    );
  }

  return (
    <div className="studio-ficha-embarque-cliente">
      <div>
        <div className="studio-eyebrow">Cliente</div>
        <strong className="studio-ficha-embarque-cliente-marca">
          {markbox?.trim() || "Sin Shipping Mark"}
        </strong>
      </div>
      <Aviso tono={sinCliente ? "atencion" : "info"} compacto>
        {sinCliente ? "Este embarque no tiene cliente asignado. " : null}
        {puedeVerNombres
          ? `${sinCliente ? "Asignarlo" : "Pasarlo a otro cliente"} lo puede hacer quien tenga el rol ${rolesQueCambianElCliente()}.`
          : "El cliente de un embarque no se cambia desde tu región."}
      </Aviso>
    </div>
  );
}
