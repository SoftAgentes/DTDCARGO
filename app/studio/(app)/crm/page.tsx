import type { AnnualBillingRead } from "@/lib/shared/annual-billing";
/**
 * Tablero CRM Kommo (SDD-0078) — espejo READ-ONLY + cruce con la plata del ERP.
 * Server component: resuelve la pestaña, computa la analítica (Dirección) en una
 * pasada y deriva los mapas del worklist (Asesor) sin queries extra. No muta nada
 * (ni Kommo ni el mirror).
 *
 * SDD-0614 · S0: las pestañas de Kommo están ocultas. La página pinta Embudos
 * (CRM propio, SDD-0587 · 6.3) sin leer el espejo; ver el `return` temprano.
 */
import { createClient } from "@/lib/db/server";
import { moduleEditDenial, requireModuleView } from "@/lib/studio/rbac-guard";
import { getKommoAnalytics } from "@/lib/studio/kommo-analytics";
import {
  getKommoMarkboxContactFieldId,
  getKommoMarkboxFieldId,
  getKommoStageMap,
  getWritebackStatus,
  type WritebackStatus,
  getPendingOpsByLead,
  getPendingOpsForBoard,
  getStaleOpsByLead,
  getStaleOpsForBoard,
} from "@/lib/studio/kommo-writeback";
import {
  getKommoOverview,
  getKommoStatusCounts,
  getLeadContactInfo,
  listKommoBoardLeads,
  listKommoContactCustomFields,
  listKommoLeadCustomFields,
  listKommoLeads,
  listKommoPipelines,
  listKommoStatuses,
  parseKommoFiltersFromSearchParams,
} from "@/lib/studio/kommo-queries";
import type {
  KommoCustomFieldRow,
  KommoStageMap,
} from "@/lib/studio/kommo-types";
import { Suspense, type ReactNode } from "react";
import { resolverTablero } from "@/lib/studio/crm-tablero";
import {
  filterRecoveryRows,
  getRecoveryUniverse,
  parseRecoveryFilters,
  RECOVERY_LIST_CAP,
} from "@/lib/studio/kommo-recovery";
import { DireccionTab } from "./_components/DireccionTab";
import { KommoBoardView } from "./_components/KommoBoardView";
import { KommoClient } from "./_components/KommoClient";
import { RecoveryTab } from "./_components/RecoveryTab";
import { CrmEmbudosCargando, CrmEmbudosSlot } from "./_components/CrmEmbudosSlot";
import { KOMMO_TABS_OCULTAS, resolveKommoTab } from "./_components/kommo-tabs.shared";

/** Tope de leads traídos por embudo para el Tablero kanban. */
const BOARD_CAP = 2000;

export const metadata = { title: "CRM" };

export default async function KommoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleView("kommo");

  const raw = await searchParams;
  const single = (k: string): string | undefined => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const tab = resolveKommoTab(single("tab"));
  const filters = parseKommoFiltersFromSearchParams(raw);

  // Embudos del CRM propio (SDD-0587 · 6.3): se lee dentro de su Suspense, así
  // la pestaña muestra su estado de carga en vez de congelar la página.
  const embudos: ReactNode =
    tab === "embudos" ? (
      <Suspense fallback={<CrmEmbudosCargando />}>
        <CrmEmbudosSlot tableroInicial={resolverTablero(single("embudo"))} />
      </Suspense>
    ) : null;

  // SDD-0614 · S0 (D-6.6-1): Kommo está oculto del Studio hasta la migración
  // completa. `resolveKommoTab` ya no devuelve sus pestañas, así que la página
  // pinta la pestaña propia y vuelve ANTES de leer el espejo `kommo_*`. Lo que
  // sigue es el camino de las pestañas de Kommo: queda sin uso, no borrado, y
  // se retira en 8.7 con su OK aparte.
  if (!KOMMO_TABS_OCULTAS.has(tab)) {
    return (
      <KommoClient
        tab={tab}
        direccion={null}
        tablero={null}
        recuperacion={null}
        embudos={embudos}
        overview={null}
        pipelines={[]}
        statuses={[]}
        leads={[]}
        filters={filters}
        convertedLeads={{}}
        valueByLead={{}}
        // Sin lectura del espejo ni de la facturación: no disponible, nunca cero (SDD-0572-b).
        convertedAvailable={false}
        billingAvailable={false}
        contactByLead={{}}
        pendingOpsByLead={{}}
        staleOpsByLead={{}}
        // Solo lo usa el worklist de Kommo (oculto); Embudos resuelve su permiso.
        canEdit={false}
        responsibleUsers={[]}
      />
    );
  }

  const supabase = await createClient();

  // ¿Este usuario puede MOVER, o sólo mirar? Se deriva del MISMO predicado que
  // usa la server action (`moduleEditDenial`), no de una regla paralela: si la
  // pantalla y el servidor no comparten el criterio, terminan divergiendo y el
  // asesor ve un control que le va a decir que no. Sigue siendo cosmético — el
  // candado real vive en la acción (SDD-0085 §Seguridad), porque una server
  // action es invocable directo como un endpoint.
  const canEdit = (await moduleEditDenial(supabase, "kommo")) === null;

  // La analítica corre siempre: alimenta el tablero Dirección + el reparto de
  // asesores del filtro + los mapas convertido/valor del worklist (sin re-query).
  const [overview, pipelines, statuses, analytics] = await Promise.all([
    getKommoOverview(supabase),
    listKommoPipelines(supabase),
    listKommoStatuses(supabase),
    getKommoAnalytics(supabase),
  ]);

  // Datos solo de la pestaña Dirección: panel de write-back (SDD-0083) + mapa de
  // etapas y rol del viewer para la config (SDD-0084).
  let writeback: WritebackStatus | null = null;
  let stageMap: KommoStageMap = {};
  let canEditStageMap = false;
  let markboxFields: KommoCustomFieldRow[] = [];
  let markboxFieldId: number | null = null;
  let markboxContactFields: KommoCustomFieldRow[] = [];
  let markboxContactFieldId: number | null = null;
  if (tab === "direccion") {
    const [wb, sm, mf, mfid, mcf, mcfid, link] = await Promise.all([
      getWritebackStatus(supabase),
      getKommoStageMap(supabase),
      listKommoLeadCustomFields(supabase),
      getKommoMarkboxFieldId(supabase),
      listKommoContactCustomFields(supabase),
      getKommoMarkboxContactFieldId(supabase),
      supabase.from("user_tenants").select("role").maybeSingle<{ role: string }>(),
    ]);
    writeback = wb;
    stageMap = sm;
    markboxFields = mf;
    markboxFieldId = mfid;
    markboxContactFields = mcf;
    markboxContactFieldId = mcfid;
    canEditStageMap = link.data?.role === "admin";
  }

  // Tablero (kanban): leads del embudo activo (param ?pipeline= o el principal),
  // agrupados por etapa en el componente. Slot server-render (read-only).
  let tablero: ReactNode = null;
  if (tab === "tablero") {
    const p = single("pipeline");
    const boardPipelineId =
      p && /^\d+$/.test(p)
        ? Number(p)
        : (pipelines.find((pl) => pl.is_main)?.id ?? pipelines[0]?.id ?? null);
    if (boardPipelineId != null) {
      const statusIds = statuses
        .filter((s) => s.pipeline_id === boardPipelineId)
        .map((s) => s.id);
      const [boardLeads, realCountByStatus, boardPendingOps, boardStaleOps] =
        await Promise.all([
          listKommoBoardLeads(supabase, boardPipelineId, BOARD_CAP),
          getKommoStatusCounts(supabase, boardPipelineId, statusIds),
          // Las tarjetas también mueven de etapa (SDD-0256), así que necesitan
          // saber qué órdenes van en camino. Si falla, se pintan sin el rótulo.
          getPendingOpsForBoard(supabase).catch(() => ({})),
          // Y qué órdenes NO se mandaron para no pisar al asesor (A1). Si esto
          // no se pinta, el "En camino" desaparece y el asesor asume que salió.
          getStaleOpsForBoard(supabase).catch(() => ({})),
        ]);
      const ownerName: Record<number, string> = {};
      for (const o of analytics.ownership.owners) {
        if (o.id != null) ownerName[o.id] = o.label;
      }
      tablero = (
        <KommoBoardView
          pipelines={pipelines}
          statuses={statuses}
          leads={boardLeads}
          realCountByStatus={realCountByStatus}
          pipelineId={boardPipelineId}
          subdomain={overview.subdomain}
          convertedMarkboxByLead={analytics.convertedMarkboxByLead}
          valueByLead={analytics.valueByLead}
          convertedAvailable={analytics.convertedAvailable}
          billingAvailable={analytics.billingAvailable}
          ownerName={ownerName}
          pendingOpsByLead={boardPendingOps}
          staleOpsByLead={boardStaleOps}
          asesores={analytics.ownership.owners}
          canEdit={canEdit}
          boardCap={BOARD_CAP}
        />
      );
    }
  }

  // Recuperación (SDD-0157): universo de contactos con teléfono × clientes del
  // ERP, filtrado server-side; a la UI viaja solo la página (cap 300).
  let recuperacion: ReactNode = null;
  if (tab === "recuperacion") {
    const universe = await getRecoveryUniverse(supabase);
    const rf = parseRecoveryFilters(raw);
    const filtered = filterRecoveryRows(universe.rows, rf);
    let clientes = 0;
    for (const r of universe.rows) if (r.segment === "cliente") clientes += 1;
    recuperacion = (
      <RecoveryTab
        rows={filtered.slice(0, RECOVERY_LIST_CAP)}
        totalFiltered={filtered.length}
        listCap={RECOVERY_LIST_CAP}
        filters={rf}
        counts={{
          total: universe.rows.length,
          clientes,
          interesados: universe.rows.length - clientes,
          noPhone: universe.noPhone,
          noPhoneWithEmail: universe.noPhoneWithEmail,
          deduped: universe.deduped,
          fetched: universe.fetched,
          cap: universe.cap,
        }}
      />
    );
  }

  // Worklist (Asesor): leads filtrados; converted/valor se derivan del análisis.
  const leads = tab === "asesor" ? await listKommoLeads(supabase, filters) : [];
  const visibleConverted: Record<number, string> = {};
  const visibleValue: Record<number, AnnualBillingRead> = {};
  for (const l of leads) {
    const mb = analytics.convertedMarkboxByLead[l.id];
    if (mb) visibleConverted[l.id] = mb;
    const v = analytics.valueByLead[l.id];
    if (v != null) visibleValue[l.id] = v;
  }

  // Contacto de cada lead visible (nombre + teléfono). Sólo de los ≤200 que se
  // pintan, no del espejo entero: dos queries indexadas contra `kommo_lead_contacts`
  // (migr 0362) y las columnas planas de `kommo_contacts` (0363). Si falla, la
  // tabla se pinta sin la columna en vez de tumbar la pantalla.
  const contactByLead =
    leads.length > 0
      ? await getLeadContactInfo(
          supabase,
          leads.map((l) => l.id),
        ).catch(() => ({}))
      : {};

  // Órdenes que ya salieron del ERP pero todavía no llegaron a Kommo. Es lo que
  // la fila pinta como "en camino": entre el clic y el webhook de vuelta el
  // espejo sigue mostrando lo viejo (guardrail 0107).
  const [pendingOpsByLead, staleOpsByLead] =
    leads.length > 0
      ? await Promise.all([
          getPendingOpsByLead(supabase, leads.map((l) => l.id)).catch(() => ({})),
          // Las órdenes que el chequeo optimista frenó: el asesor tiene que
          // enterarse sin abrir lead por lead.
          getStaleOpsByLead(supabase, leads.map((l) => l.id)).catch(() => ({})),
        ])
      : [{}, {}];

  return (
    <KommoClient
      tab={tab}
      direccion={
        tab === "direccion" ? (
          <DireccionTab
            data={analytics}
            writeback={writeback}
            pipelines={pipelines}
            statuses={statuses}
            stageMap={stageMap}
            canEditStageMap={canEditStageMap}
            markboxFields={markboxFields}
            markboxFieldId={markboxFieldId}
            markboxContactFields={markboxContactFields}
            markboxContactFieldId={markboxContactFieldId}
          />
        ) : null
      }
      tablero={tablero}
      recuperacion={recuperacion}
      embudos={embudos}
      overview={overview}
      pipelines={pipelines}
      statuses={statuses}
      leads={leads}
      filters={filters}
      convertedLeads={visibleConverted}
      valueByLead={visibleValue}
      convertedAvailable={analytics.convertedAvailable}
      billingAvailable={analytics.billingAvailable}
      contactByLead={contactByLead}
      pendingOpsByLead={pendingOpsByLead}
      staleOpsByLead={staleOpsByLead}
      canEdit={canEdit}
      responsibleUsers={analytics.ownership.owners}
    />
  );
}
