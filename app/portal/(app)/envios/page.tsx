import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import {
  computeProgress,
  effectiveVisibleStatus,
  isActiveShipmentStatus,
  STATUS_LABELS,
  type ShipmentStatus,
} from "@/lib/portal/portal-types";
import {
  daysUntil,
  type PortalSailing,
} from "@/lib/portal/next-sailing-queries";
import { buildAlertItems } from "@/lib/portal/alertas";
import { groupTrackByContainer, type TrackItem } from "@/lib/portal/seguimiento";
import { getPortalShipmentsHubPrivateContext } from "@/lib/portal/shipments-hub-private-context";
import { EnviosHubTabs } from "../../_components/PortalHubTabs";
import {
  PortalAlertasHub,
  type DocPresence,
} from "./_components/PortalAlertasHub";

export const metadata: Metadata = { title: "Alertas · mis envíos" };

/**
 * "Alertas · mis envíos" (SDD-0042 · hub del Norte `PortalAlertas`). Unifica el
 * ciclo Pre-alerta → Alerta → Envío en una sola lista: mezcla prealertas
 * (SDD-0057) con envíos (`listMyShipments`), suma el banner del próximo
 * consolidado (cut-off · SDD-0133), los documentos por compra y el "Seguimiento
 * total". Gateado a Norte; el fallback conserva la lista plana previa.
 */
export default async function PortalShipmentsPage() {
  const supabase = await createClient();
  const context = await getPortalShipmentsHubPrivateContext(supabase);
  if (!context) return null;
  const {
    client,
    rawShipments,
    prealertas,
    suppliers,
    hiddenStatuses,
    docEntries,
    conPackingOnline,
    consolidations,
    sailing,
  } = context;

  // SDD-0156 · Slice D: si la config del tenant oculta un hito (ej. "en aduana"),
  // la lista muestra el último estado VISIBLE — el badge y el % no delatan el hito
  // oculto (coherente con el stepper del detalle). Falla-seguro → sin sustitución.
  const shipments = rawShipments.map((s) => ({
    ...s,
    status: effectiveVisibleStatus(s.status, s.service, hiddenStatuses),
  }));

  const supplierNameById: Record<string, string> = {};
  for (const s of suppliers) supplierNameById[s.id] = s.name;

  const items = buildAlertItems(prealertas, shipments, supplierNameById);

  // Slice B — presencia de documentos por compra (packing/factura/foto). Solo
  // las prealertas tienen `prealerta_documents`; los envíos derivan a su detalle.
  const prealertasVivas = prealertas.filter(
    (p) => !p.shipment_id && p.status !== "cancelada",
  );

  // SDD-0308 — el packing list tiene DOS caminos y el chip sólo miraba uno.
  // `prealerta_documents` cubre el archivo adjunto; `packing_list_submissions`
  // cubre el formulario online de `/p/{token}`, que es el camino que el propio
  // portal le ofrece al proveedor. Mirando sólo el primero, un proveedor que
  // llenó el formulario dejaba el chip en gris con el documento ya enviado.
  const docTypesByPrealerta = new Map<string, Set<string>>();
  for (const entry of docEntries) {
    const types = docTypesByPrealerta.get(entry.prealerta_id) ?? new Set<string>();
    types.add(entry.doc_type);
    docTypesByPrealerta.set(entry.prealerta_id, types);
  }

  const docs: Record<string, DocPresence> = Object.fromEntries(
    prealertasVivas.map((prealerta) => {
      const types = docTypesByPrealerta.get(prealerta.id) ?? new Set<string>();
      const presence: DocPresence = {
        packing: types.has("packing") || conPackingOnline.has(prealerta.id),
        factura: types.has("factura"),
        foto: types.has("foto"),
      };
      return [`p:${prealerta.id}`, presence] as const;
    }),
  );

  // Slice C — envíos en camino (Seguimiento total): progreso derivado del status.
  const track: TrackItem[] = shipments
    .filter((s) => s.status !== "draft" && isActiveShipmentStatus(s.status))
    .map((s) => ({
      id: s.id,
      code: s.code,
      progress: computeProgress(s.status),
      statusLabel: STATUS_LABELS[s.status as ShipmentStatus] ?? s.status,
      route:
        s.origin || s.destination
          ? `${cityOf(s.origin) ?? "—"} → ${cityOf(s.destination) ?? "—"}`
          : null,
    }));

  // SDD-0170 — "Seguimiento total" agrupado por CONTENEDOR (decisión del Norte:
  // varias compras consolidadas se muestran como UN solo seguimiento). Los ids
  // que entran son los de `listMyShipments`, ya filtrada por `client_markbox`, así
  // que el admin client queda scopeado a envíos propios. Best-effort: si falla,
  // el mapa vacío degrada a la lista plana de antes.
  const trackGroups = groupTrackByContainer(track, consolidations);

  const banner = buildConsolidadoBanner(sailing);

  return (
    <div>
      {/* Las tabs vivían sólo dentro de `FallbackList`; al podar ese código
          muerto (SDD-0179) quedaron en tres de las cuatro páginas del hub y acá
          no. El cliente entraba a "Mis envíos" y perdía la navegación hacia
          Compras, Documentos y Proveedores. Mismo envoltorio que las otras. */}
      <EnviosHubTabs />
      <PortalAlertasHub
        items={items}
        docs={docs}
        trackGroups={trackGroups}
        banner={banner}
        markbox={client.markbox}
      />
    </div>
  );
}

/** Ciudad (parte antes de la coma). */
function cityOf(loc: string | null): string | null {
  if (!loc) return null;
  return loc.split(",")[0]?.trim() || loc;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("es-VE", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return null;
  }
}

/**
 * Arma el banner "Próximo consolidado" con el próximo zarpe abierto. Copy honesto
 * con los campos que existan (cut-off, ETD, ETA). Devuelve null si no hay salida.
 */
function buildConsolidadoBanner(
  sailing: PortalSailing | null,
): { route: string; sentence: string } | null {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (!sailing) return null;

  const cutoff = fmtDate(sailing.cutoff);
  const etd = fmtDate(sailing.etd);
  const eta = fmtDate(sailing.eta);
  const days = sailing.cutoff ? daysUntil(sailing.cutoff, todayIso) : null;

  const parts: string[] = [];
  if (cutoff) {
    const faltan =
      days != null && days >= 0
        ? ` (${days === 0 ? "hoy es el último día" : `faltan ${days} día${days === 1 ? "" : "s"}`})`
        : "";
    parts.push(`Si tu mercancía llega a bodega CN antes del ${cutoff}${faltan}`);
  }
  if (etd) parts.push(`entra en el barco que zarpa el ${etd}`);
  if (eta) parts.push(`y llega aprox. el ${eta}`);

  const sentence =
    parts.length > 0
      ? `${parts.join(" ")}.`
      : "Organiza tus compras para que lleguen a bodega CN antes del cierre del próximo consolidado.";

  return { route: `${sailing.pol} → ${sailing.pod}`, sentence };
}
