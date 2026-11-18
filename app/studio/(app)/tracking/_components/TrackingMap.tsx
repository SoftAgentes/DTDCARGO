/**
 * TrackingMap — posición de UN envío que todavía no tiene contenedor
 * (SDD-0013; mapa centrado en el Pacífico desde SDD-0659).
 *
 * Un envío suelto no tiene buque ni itinerario: su posición es una estimación
 * por estado y así se rotula. El transporte terrestre no cruza el Pacífico, así
 * que no lleva mapa.
 *
 * No hay velocidad: el valor que se mostraba antes era fijo, no un dato.
 */

import type { Shipment } from "@/lib/studio/shipment-types";
import {
  computeProgress,
  daysRemaining,
  nextMilestone,
} from "@/lib/studio/tracking-progress";
import { fraccionDeMar, puntoEnRuta } from "@/lib/studio/tracking-mapa/proyeccion";
import { MapaPacifico } from "./MapaPacifico";

type Props = {
  shipment: Shipment;
};

function formatEtaDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });
}

/** Fracción de la ruta que le toca a un envío suelto según su progreso. */
function fraccionPorProgreso(progreso: number): number {
  const zarpe = computeProgress("shipped");
  const aduana = computeProgress("in_customs");
  if (progreso < zarpe) return 0;
  if (progreso >= aduana) return 1;
  return fraccionDeMar((progreso - zarpe) / (aduana - zarpe) || 0.03);
}

export function TrackingMap({ shipment }: Props) {
  const progress = computeProgress(shipment.status);
  const isAlert =
    shipment.status === "exception" || shipment.status === "delayed_warehouse";
  const days = daysRemaining(shipment.status, shipment.shipment_service);
  const milestone = nextMilestone(shipment.status, shipment.shipment_service);
  const isGround = shipment.shipment_service === "transporte_terrestre";
  const fraccion = fraccionPorProgreso(progress);

  return (
    <section className="studio-tracking-ops-panel" aria-label={`Envío ${shipment.code}`}>
      <header className="studio-tracking-ops-panel-head">
        <div>
          <span className="studio-eyebrow studio-tracking-ops-eyebrow">Posición actual</span>
          <h2 className="studio-display">
            <code>{shipment.code}</code>
          </h2>
          <p>
            {shipment.vehicle_model ?? "Sin contenedor asignado"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="studio-eyebrow">ETA {shipment.destination ?? "destino"}</div>
          <div
            style={{
              font: "800 16px/1 var(--f-mono)",
              color: isAlert ? "var(--warning)" : "var(--ink)",
              marginTop: 4,
            }}
          >
            {shipment.status === "delivered"
              ? formatEtaDate(shipment.arrived_destination_at)
              : `≈ ${days} d`}
          </div>
        </div>
      </header>

      {isGround ? (
        <p className="studio-tracking-ops-nota" data-borde="true">
          Transporte terrestre dentro de Venezuela: no tiene ruta marítima.
        </p>
      ) : (
        <>
          <MapaPacifico
            descripcion="Mapa del Pacífico con la ruta de China a Venezuela. Posición estimada por estado."
            marcadores={[
              {
                id: shipment.id,
                etiqueta: `${progress}%`,
                titulo: `Envío ${shipment.code}, posición estimada`,
                fraccion,
                punto: puntoEnRuta(fraccion),
                activo: true,
                alerta: isAlert,
              },
            ]}
          />
          <p className="studio-tracking-ops-nota" data-borde="true">
            Posición estimada por estado. No es la ubicación real del buque: este envío
            todavía no tiene contenedor.
          </p>
        </>
      )}

      <dl className="studio-tracking-ops-kpis">
        <div>
          <dt className="studio-eyebrow">Progreso</dt>
          <dd className="studio-display" data-acento={isAlert ? "false" : "true"}>
            {progress}%
          </dd>
        </div>
        <div>
          <dt className="studio-eyebrow">Días restantes</dt>
          <dd className="studio-display">≈ {days}</dd>
          <dd className="studio-tracking-ops-kpi-sub">estimado por estado</dd>
        </div>
        <div>
          <dt className="studio-eyebrow">Próximo hito</dt>
          <dd className="studio-display">{milestone}</dd>
        </div>
      </dl>
    </section>
  );
}
