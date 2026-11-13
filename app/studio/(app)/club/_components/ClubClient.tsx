"use client";

/**
 * Shell client del Club DTD (SDD-0116). Header + 2 pestañas:
 *  - Miembros        · Slice A (membresía).
 *  - Compras grupales · Slice B (rondas de consolidación comunitaria).
 * Cada vista maneja sus KPIs, su botón "+ Nuevo", sus drawers y su trazabilidad.
 */

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MembersView } from "./MembersView";
import { GroupBuysView } from "./GroupBuysView";
import { EventsView } from "./EventsView";
import { SuppliersView } from "./SuppliersView";
import type { ClubMemberRow, ClubStats } from "@/lib/studio/club/club-member-types";
import type { GroupBuyDetail, GroupBuyStats } from "@/lib/studio/club/group-buy-types";
import type { EligibleMember } from "@/lib/studio/club/group-buy-queries";
import type { ClubEvent, ClubEventStats } from "@/lib/studio/club/club-event-types";
import type { EventRegistration } from "@/lib/studio/club/club-event-registration-types";
import type {
  FeaturedSupplier,
  FeaturedSupplierStats,
} from "@/lib/studio/club/featured-supplier-types";
import type { EligibleInspection } from "@/lib/studio/club/featured-supplier-queries";

type Tab = "miembros" | "compras" | "eventos" | "proveedores";

const TABS: { value: Tab; label: string }[] = [
  { value: "miembros", label: "Miembros" },
  { value: "compras", label: "Compras grupales" },
  { value: "eventos", label: "Eventos" },
  { value: "proveedores", label: "Proveedor del mes" },
];

export function ClubClient({
  stats,
  members,
  gbStats,
  groupBuys,
  eligibleMembers,
  eventStats,
  events,
  registrationsByEvent,
  supplierStats,
  suppliers,
  eligibleInspections,
}: {
  stats: ClubStats;
  members: ClubMemberRow[];
  gbStats: GroupBuyStats;
  groupBuys: GroupBuyDetail[];
  eligibleMembers: EligibleMember[];
  eventStats: ClubEventStats;
  events: ClubEvent[];
  registrationsByEvent: Record<string, EventRegistration[]>;
  supplierStats: FeaturedSupplierStats;
  suppliers: FeaturedSupplier[];
  eligibleInspections: EligibleInspection[];
}) {
  const searchParams = useSearchParams();

  // Los ids que viven en la tab Compras (rondas + participantes), para que un
  // ?highlight= que apunte a cualquiera de ellos abra esa tab (trazabilidad).
  const comprasIds = useMemo(() => {
    const s = new Set<string>();
    for (const g of groupBuys) {
      s.add(g.id);
      for (const p of g.participants) s.add(p.id);
    }
    return s;
  }, [groupBuys]);

  const eventIds = useMemo(() => new Set(events.map((e) => e.id)), [events]);
  const supplierIds = useMemo(() => new Set(suppliers.map((s) => s.id)), [suppliers]);

  const [tab, setTab] = useState<Tab>(() => {
    const hl = searchParams.get("highlight");
    if (hl && comprasIds.has(hl)) return "compras";
    if (hl && eventIds.has(hl)) return "eventos";
    if (hl && supplierIds.has(hl)) return "proveedores";
    return "miembros";
  });

  // Navegación por flechas del patrón ARIA tablist (complemento del roving
  // tabindex: sin esto la tab inactiva queda inalcanzable por teclado).
  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = TABS.findIndex((t) => t.value === tab);
    const nextIdx =
      e.key === "ArrowRight"
        ? (idx + 1) % TABS.length
        : (idx - 1 + TABS.length) % TABS.length;
    const next = TABS[nextIdx].value;
    setTab(next);
    document.getElementById(`club-tab-${next}`)?.focus();
  };

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div style={{ marginBottom: "var(--s-5)" }}>
        <span className="studio-eyebrow" style={{ color: "var(--wine-text)" }}>
          Club DTD
        </span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
        >
          La comunidad de importadores DTD.
        </h1>
        <p
          style={{
            font: "400 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "64ch",
          }}
        >
          Donde aprender se vuelve hacer, en grupo. Miembros del Club (Slice A) y
          compras grupales que juntan volumen para bajar el costo por CBM (Slice B).
        </p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Vistas del Club"
        onKeyDown={onTabKeyDown}
        className="studio-tabs"
        style={{ marginBottom: 18 }}
      >
        {TABS.map((tDef) => {
          const active = tab === tDef.value;
          return (
            <button
              key={tDef.value}
              type="button"
              role="tab"
              id={`club-tab-${tDef.value}`}
              aria-selected={active}
              aria-controls={`club-panel-${tDef.value}`}
              data-activa={active ? "true" : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(tDef.value)}
              className="studio-tab"
            >
              {tDef.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`club-panel-${tab}`} aria-labelledby={`club-tab-${tab}`}>
        {tab === "miembros" && <MembersView stats={stats} members={members} />}
        {tab === "compras" && (
          <GroupBuysView
            stats={gbStats}
            groupBuys={groupBuys}
            eligibleMembers={eligibleMembers}
          />
        )}
        {tab === "eventos" && (
          <EventsView
            stats={eventStats}
            events={events}
            registrationsByEvent={registrationsByEvent}
            eligibleMembers={eligibleMembers}
          />
        )}
        {tab === "proveedores" && (
          <SuppliersView
            stats={supplierStats}
            suppliers={suppliers}
            eligibleInspections={eligibleInspections}
          />
        )}
      </div>
    </div>
  );
}
