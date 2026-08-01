import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { listMyShipments, getPortalClient } from "@/lib/portal/portal-queries";
import {
  listPrealertas,
  listSuppliers,
  listPrealertaDocuments,
} from "@/lib/studio/prealertas/queries";
import {
  computeProgress,
  effectiveVisibleStatus,
  isActiveShipmentStatus,
  STATUS_LABELS,
  type ShipmentStatus,
} from "@/lib/portal/portal-types";
import { getHiddenPortalStatusesForClient } from "@/lib/studio/notifications/portal-visibility-queries";
import {
  getNextOpenSailing,
  daysUntil,
  type PortalSailing,
} from "@/lib/portal/next-sailing-queries";
import { buildAlertItems } from "@/lib/portal/alertas";
import { getConsolidationsForShipments } from "@/lib/portal/consolidation-queries";
import { groupTrackByContainer, type TrackItem } from "@/lib/portal/seguimiento";
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
  const client = await getPortalClient(supabase);
  if (!client) return null;

  const [rawShipments, prealertas, suppliers] = await Promise.all([
    listMyShipments(supabase),
    listPrealertas(supabase, { markbox: client.markbox }),
    listSuppliers(supabase, { markbox: client.markbox }),
  ]);

  // SDD-0156 · Slice D: si la config del tenant oculta un hito (ej. "en aduana"),
  // la lista muestra el último estado VISIBLE — el badge y el % no delatan el hito
  // oculto (coherente con el stepper del detalle). Falla-seguro → sin sustitución.
  const hiddenStatuses = await getHiddenPortalStatusesForClient(
    createAdminClient(),
    client.id,
  );
  const shipments = rawShipments.map((s) => ({
    ...s,
    status: effectiveVisibleStatus(s.status, s.service, hiddenStatuses),
  }));

  const supplierNameById: Record<string, string> = {};
  for (const s of suppliers) supplierNameById[s.id] = s.name;

  const items = buildAlertItems(prealertas, shipments, supplierNameById);

  // Slice B — presencia de documentos por compra (packing/factura/foto). Solo
  // las prealertas tienen `prealerta_documents`; los envíos derivan a su detalle.
  const docEntries = await Promise.all(
    prealertas
      .filter((p) => !p.shipment_id && p.status !== "cancelada")
      .map(async (p) => {
        const docs = await listPrealertaDocuments(supabase, {
          prealertaId: p.id,
          markbox: client.markbox,
        });
        const has = (t: string) => docs.some((d) => d.doc_type === t);
        const presence: DocPresence = {
          packing: has("packing"),
          factura: has("factura"),
          foto: has("foto"),
        };
        return [`p:${p.id}`, presence] as const;
      }),
  );
  const docs: Record<string, DocPresence> = Object.fromEntries(docEntries);

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
  const consolidations = await getConsolidationsForShipments(
    createAdminClient(),
    track.map((t) => t.id),
  ).catch(() => ({}));
  const trackGroups = groupTrackByContainer(track, consolidations);

  // Banner del próximo consolidado (cut-off). Admin client scopeado por tenant (el
  // cliente no tiene RLS sobre `sailings`); best-effort → null oculta el banner.
  const banner = await loadConsolidadoBanner(client.id);

  return (
    <PortalAlertasHub
      items={items}
      docs={docs}
      trackGroups={trackGroups}
      banner={banner}
      markbox={client.markbox}
    />
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
async function loadConsolidadoBanner(
  clientId: string,
): Promise<{ route: string; sentence: string } | null> {
  const todayIso = new Date().toISOString().slice(0, 10);
  let sailing: PortalSailing | null = null;
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("clients")
      .select("tenant_id")
      .eq("id", clientId)
      .maybeSingle<{ tenant_id: string }>();
    const tenantId = String(row?.tenant_id ?? "").trim();
    if (tenantId) sailing = await getNextOpenSailing(admin, tenantId, todayIso);
  } catch {
    sailing = null;
  }
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
