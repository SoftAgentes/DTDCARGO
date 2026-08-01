"use client";

/**
 * SeniatClient — orquestador del módulo Aduana SENIAT.
 *
 * - 4 tabs (URL state ?tab=): queue / cleared / agents / tax
 * - Filtros para queue/cleared: search + port + status
 * - Selected filing via URL ?filing=<id> abre FilingDetailDrawer
 * - "+ Nuevo trámite" abre CreateFilingDrawer (URL ?view=create)
 */

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  CUSTOMS_STATUS_OPTIONS,
  VE_PORTS,
  type CustomsAgent,
  type CustomsDocument,
  type CustomsFiling,
  type CustomsFilingRow,
} from "@/lib/studio/customs-types";
import type {
  EligibleShipment,
  TaxBreakdown,
} from "@/lib/studio/customs-queries";
import { CustomsFilingsList } from "./CustomsFilingsList";
import { CustomsAgentsTab } from "./CustomsAgentsTab";
import { CustomsTaxTab } from "./CustomsTaxTab";
import { FilingDetailDrawer } from "./FilingDetailDrawer";
import { CreateFilingDrawer } from "./CreateFilingDrawer";

type Tab = "queue" | "cleared" | "agents" | "tax";

interface Props {
  filings: CustomsFilingRow[];
  agents: CustomsAgent[];
  eligibleShipments: EligibleShipment[];
  taxBreakdown: TaxBreakdown;
  filingDetail: {
    filing: CustomsFiling;
    documents: CustomsDocument[];
    agent: CustomsAgent | null;
    shipment: {
      id: string;
      code: string;
      client_name: string | null;
      client_markbox: string | null;
      destination: string | null;
    } | null;
  } | null;
  counts: { queue: number; cleared: number };
}

function parseTab(raw: string | null): Tab {
  if (raw === "cleared" || raw === "agents" || raw === "tax") return raw;
  return "queue";
}

export function SeniatClient({
  filings,
  agents,
  eligibleShipments,
  taxBreakdown,
  filingDetail,
  counts,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const tab = parseTab(params.get("tab"));
  const viewCreate = params.get("view") === "create";

  // Filtros locales sincronizados con URL
  const [q, setQ] = useState(params.get("q") ?? "");
  const [port, setPort] = useState(params.get("port") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const paramsKey = params.toString();
  const [filtersKey, setFiltersKey] = useState(paramsKey);
  if (filtersKey !== paramsKey) {
    setFiltersKey(paramsKey);
    setQ(params.get("q") ?? "");
    setPort(params.get("port") ?? "");
    setStatus(params.get("status") ?? "");
  }

  const pushFilters = (next: {
    q?: string;
    port?: string;
    status?: string;
  }) => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("q");
    sp.delete("port");
    sp.delete("status");
    if (next.q?.trim()) sp.set("q", next.q.trim());
    if (next.port) sp.set("port", next.port);
    if (next.status) sp.set("status", next.status);
    const qs = sp.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };
  const pushFiltersEvent = useEffectEvent(pushFilters);
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => pushFiltersEvent({ q, port, status }), 300);
    return () => clearTimeout(t);
  }, [params, port, q, status]);

  const changeTab = (newTab: Tab) => {
    const sp = new URLSearchParams(params.toString());
    if (newTab === "queue") {
      sp.delete("tab");
    } else {
      sp.set("tab", newTab);
    }
    // Limpiar selection al cambiar de tab
    sp.delete("filing");
    // Si vamos a tabs sin lista (agents/tax), limpiar filtros de queue/cleared
    // para no llevarlos invisibles a los próximos tabs (UX confusa).
    if (newTab === "agents" || newTab === "tax") {
      sp.delete("q");
      sp.delete("port");
      sp.delete("status");
    }
    const qs = sp.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const openFiling = (filingId: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("filing", filingId);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const closeFiling = () => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("filing");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const closeCreate = () => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("view");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    router.refresh();
  };

  const hasActiveFilters = Boolean(q || port || status);

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: "queue", label: "Cola activa", count: counts.queue },
    { value: "cleared", label: "Liberados", count: counts.cleared },
    { value: "agents", label: "Agentes aduanales" },
    { value: "tax", label: "Aranceles & impuestos" },
  ];

  return (
    <>
      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 18,
          borderBottom: "1px solid var(--border)",
          overflowX: "auto",
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => changeTab(t.value)}
              style={{
                padding: "10px 16px",
                background: "transparent",
                border: 0,
                borderBottom: `2px solid ${active ? "var(--wine)" : "transparent"}`,
                color: active ? "var(--ink)" : "var(--ink-soft)",
                font: `${active ? "700" : "500"} 12.5px/1 var(--f-sans)`,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--s-2)",
                marginBottom: -1,
                transition:
                  "color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
              }}
            >
              {t.label}
              {t.count != null && (
                <span
                  style={{
                    font: "700 11px/1 var(--f-mono)",
                    color: active ? "var(--wine)" : "var(--ink-mute)",
                    padding: "2px 7px",
                    background: active ? "var(--wine-tint)" : "var(--bg-elevated)",
                    borderRadius: "var(--r-sm)",
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar (solo para queue/cleared) */}
      {(tab === "queue" || tab === "cleared") && (
        <>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-end",
              marginBottom: "var(--s-4)",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-end",
                flex: "1 1 auto",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 240px", minWidth: 220 }}>
                <label className="studio-label" htmlFor="seniat-q">
                  Buscar
                </label>
                <input
                  id="seniat-q"
                  type="search"
                  className="studio-input"
                  placeholder="DUA, observaciones, alerta…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div style={{ flex: "0 0 200px" }}>
                <label className="studio-label" htmlFor="seniat-port">
                  Puerto
                </label>
                <select
                  id="seniat-port"
                  className="studio-input"
                  value={port}
                  onChange={(e) => {
                    setPort(e.target.value);
                    pushFilters({ q, port: e.target.value, status });
                  }}
                >
                  <option value="">Todos</option>
                  {VE_PORTS.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "0 0 200px" }}>
                <label className="studio-label" htmlFor="seniat-status">
                  Estado
                </label>
                <select
                  id="seniat-status"
                  className="studio-input"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    pushFilters({ q, port, status: e.target.value });
                  }}
                >
                  <option value="">Todos</option>
                  {CUSTOMS_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  style={{ height: 38 }}
                  onClick={() => {
                    setQ("");
                    setPort("");
                    setStatus("");
                    pushFilters({});
                  }}
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <CustomsFilingsList
            rows={filings}
            onRowClick={openFiling}
            emptyMessage={
              hasActiveFilters
                ? "Ningún trámite coincide con los filtros."
                : tab === "queue"
                  ? "No hay trámites en cola activa. Crea uno cuando un container ingrese a aduana."
                  : "Aún no hay trámites liberados YTD."
            }
          />
        </>
      )}

      {tab === "agents" && <CustomsAgentsTab agents={agents} />}

      {tab === "tax" && <CustomsTaxTab breakdown={taxBreakdown} />}

      {/* Drawers */}
      {filingDetail && (
        <FilingDetailDrawer
          filing={filingDetail.filing}
          documents={filingDetail.documents}
          agent={filingDetail.agent}
          shipment={filingDetail.shipment}
          onClose={closeFiling}
        />
      )}

      {viewCreate && (
        <CreateFilingDrawer
          agents={agents}
          shipments={eligibleShipments}
          onClose={closeCreate}
        />
      )}
    </>
  );
}
