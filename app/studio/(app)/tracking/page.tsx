/**
 * Tracking en vivo — vista operativa (SDD-0013).
 *
 * Reemplaza el listado plano anterior (que se solapaba con Embarques)
 * por sidebar de embarques activos + mapa SVG estilizado + timeline
 * operativa con steps done/active/pending.
 *
 * Selección persiste via `?id=<shipment.id>`. Si no se pasa o el id
 * no existe en la lista activa, fallback al primero.
 *
 * Detalle de edición sigue siendo `/tracking/[id]`. Crear sigue siendo
 * `/tracking/nuevo`.
 */

import Link from "next/link";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { createClient } from "@/lib/db/server";
import {
  getShipmentById,
  listActiveShipments,
} from "@/lib/studio/shipment-queries";
import type {
  Shipment,
  ShipmentService,
  ShipmentStatus,
} from "@/lib/studio/shipment-types";
import {
  ActiveShipmentList,
  type ActiveShipmentRow,
} from "./_components/ActiveShipmentList";
import { TrackingMap } from "./_components/TrackingMap";
import { TrackingTimeline } from "./_components/TrackingTimeline";
import { TrackingDetailActions } from "./_components/TrackingDetailActions";
import { TrackingEmptyOps } from "./_components/TrackingEmptyOps";
import { contarAdjuntosDeEmbarques } from "@/lib/studio/documents/adjuntos-queries";
import { conteosPorId } from "@/lib/studio/documents/adjuntos";
import {
  readCanSeeClientNames,
  segunVisibilidad,
} from "@/lib/studio/privacidad-cn";

export const metadata = { title: "Tracking en vivo" };

type ActiveRow = {
  id: string;
  code: string;
  client_name: string | null;
  client_markbox: string | null;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService;
  status: ShipmentStatus;
  created_at: string;
  arrived_destination_at: string | null;
};

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleView("tracking");

  const sp = await searchParams;
  const requestedId = typeof sp.id === "string" ? sp.id : null;

  const supabase = await createClient();
  // SDD-0531 · PIPL: al equipo de China (región cn, no admin) el nombre del
  // cliente no le llega. Se oculta acá, en el servidor, antes de que la lista y
  // el envío seleccionado se serialicen hacia el navegador.
  const puedeVerNombres = await readCanSeeClientNames(supabase);
  const active = segunVisibilidad(
    (await listActiveShipments(supabase)) as ActiveRow[],
    puedeVerNombres,
  );

  // Empty state si no hay activos
  if (active.length === 0) {
    return (
      <div style={{ maxWidth: 1200 }}>
        <TrackingHeader count={0} />
        <TrackingEmptyOps />
      </div>
    );
  }

  // Resolver el seleccionado:
  //   1. ?id=<x> si existe en activos
  //   2. ?id=<x> que no esté en activos → buscar shipment completo
  //      (puede ser delivered y se quiera ver). Si no existe → primero activo.
  //   3. sin ?id → primero activo.
  let selected: Shipment | null = null;
  if (requestedId) {
    const inActive = active.find((s) => s.id === requestedId);
    if (inActive) {
      selected = await getShipmentById(supabase, requestedId);
    } else {
      // El id puede ser de un envío terminal; intentamos cargarlo igual.
      selected = await getShipmentById(supabase, requestedId);
    }
  }
  if (!selected) {
    selected = await getShipmentById(supabase, active[0].id);
  }
  selected = segunVisibilidad(selected, puedeVerNombres);

  // Si después de todo no hay selected, fallback al empty (caso edge).
  if (!selected) {
    return (
      <div style={{ maxWidth: 1200 }}>
        <TrackingHeader count={active.length} />
        <TrackingEmptyOps />
      </div>
    );
  }

  // SDD-0507: cuántos adjuntos tiene cada envío activo, con el cliente de
  // sesión. `null` si no se pudo contar: la barra lateral lo dice.
  const adjuntos = conteosPorId(
    await contarAdjuntosDeEmbarques(
      supabase,
      active.map((s) => s.id),
    ),
  );

  const sidebarRows: ActiveShipmentRow[] = active.map((s) => ({
    id: s.id,
    code: s.code,
    client_name: s.client_name,
    client_markbox: s.client_markbox,
    origin: s.origin,
    destination: s.destination,
    shipment_service: s.shipment_service,
    status: s.status,
    created_at: s.created_at,
    arrived_destination_at: s.arrived_destination_at,
  }));

  return (
    <div style={{ maxWidth: 1200 }}>
      <TrackingHeader count={active.length} />

      <div className="studio-tracking-ops-grid">
        {/* Sidebar */}
        <ActiveShipmentList
          shipments={sidebarRows}
          selectedId={selected.id}
          adjuntos={adjuntos}
          nombresOcultos={!puedeVerNombres}
        />

        {/* Detalle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TrackingDetailActions shipment={selected} />
          <TrackingMap shipment={selected} />
          <TrackingTimeline shipment={selected} />
        </div>
      </div>
    </div>
  );
}

function TrackingHeader({ count }: { count: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 24,
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <span className="studio-eyebrow">Operación · en vivo</span>
        <h1
          className="studio-display"
          style={{
            fontSize: 30,
            margin: "var(--s-2) 0 var(--s-3)",
            color: "var(--ink)",
          }}
        >
          Tracking en vivo.
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "60ch",
          }}
        >
          Posición estimada por status operativo. ETA exacto cuando exista
          integración AIS · {count}{" "}
          {count === 1 ? "envío activo" : "envíos activos"}.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {/* SDD-0289 · el CSV trae TODOS los embarques (paginado), no sólo los
            activos que muestra esta pantalla. */}
        <a
          href="/api/studio/operativo/export?tipo=embarques"
          className="studio-btn studio-btn-ghost"
          title="Descarga todos los embarques en CSV"
        >
          Exportar
        </a>
        <Link
          href="/studio/tracking/nuevo"
          className="studio-btn studio-btn-primary"
        >
          + Envío
        </Link>
      </div>
    </div>
  );
}
