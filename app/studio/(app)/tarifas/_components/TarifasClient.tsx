"use client";

/**
 * Orquestador client del módulo Tarifas (SDD-0008).
 *
 * - Header con CTAs
 * - Toolbar con filtros (servicio + búsqueda), URL state via router.push
 * - Tabla con las tarifas
 * - Drawer modal que abre en modo create o edit
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  RATE_SERVICE_OPTIONS,
  formatRate,
  rateStatusLabel,
  rateStatusTone,
  type Rate,
} from "@/lib/studio/rate-types";
import { SERVICE_LABELS } from "@/lib/studio/shipment-types";
import type { RateFilters } from "@/lib/studio/rate-queries";
import type { CalculatorSettings } from "@/lib/studio/calculator-settings-types";
import type { CalculatorCity } from "@/lib/studio/calculator-cities-types";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";
import { RateDrawer } from "./RateDrawer";
import { ParametrosPanel } from "./ParametrosPanel";
import { CiudadesPanel } from "./CiudadesPanel";
import { ImportRatesDrawer } from "./ImportRatesDrawer";
import { publishRateAction, archiveRateAction } from "../actions";

type DrawerState = null | { mode: "create" } | { mode: "edit"; rate: Rate };
type Tab = "tarifas" | "ciudades" | "parametros";

export function TarifasClient({
  rates,
  filters,
  settings,
  cities,
  isAdmin,
}: {
  rates: Rate[];
  filters: RateFilters;
  settings: CalculatorSettings | null;
  cities: CalculatorCity[];
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState<Tab>("tarifas");
  const [importOpen, setImportOpen] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<DrawerState>(null);

  // Estado local de los filtros (controlled inputs + push a URL)
  const [q, setQ] = useState(params.get("q") ?? "");
  const [service, setService] = useState(params.get("service") ?? "");

  // Sync cuando cambia params (back/forward del browser)
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setService(params.get("service") ?? "");
  }, [params]);

  // Debounce 350ms para el search
  useEffect(() => {
    const currentQ = params.get("q") ?? "";
    if (q === currentQ) return;
    const timer = setTimeout(() => pushFilters({ q, service }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pushFilters = (next: { q?: string; service?: string }) => {
    const search = new URLSearchParams();
    if (next.q && next.q.trim()) search.set("q", next.q.trim());
    if (next.service) search.set("service", next.service);
    const qs = search.toString();
    startTransition(() => {
      router.push(qs ? `/studio/tarifas?${qs}` : "/studio/tarifas");
    });
  };

  // Cerrar drawer con Escape
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Operación comercial</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Tarifas.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "62ch",
            }}
          >
            LCL cobrado por CBM. FCL como tarifa cerrada por contenedor. Editables
            por ruta y vigencia. Los Estimados las consumen para sugerir precios.
          </p>
        </div>
        {tab === "tarifas" && (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={() => setImportOpen(true)}
            >
              Importar tarifas
            </button>
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setDrawer({ mode: "create" })}
            >
              + Nueva tarifa
            </button>
          </div>
        )}
      </div>

      {/* Tabs · Tarifas (catálogo) | Parámetros (reglas del calculador) */}
      <div
        role="tablist"
        aria-label="Secciones de tarifas"
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 22,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <TabButton
          id="tab-tarifas"
          controls="panel-tarifas"
          active={tab === "tarifas"}
          onClick={() => setTab("tarifas")}
          label="Tarifas"
        />
        <TabButton
          id="tab-ciudades"
          controls="panel-ciudades"
          active={tab === "ciudades"}
          onClick={() => setTab("ciudades")}
          label="Ciudades"
        />
        <TabButton
          id="tab-parametros"
          controls="panel-parametros"
          active={tab === "parametros"}
          onClick={() => setTab("parametros")}
          label="Parámetros del calculador"
        />
      </div>

      {tab === "tarifas" && (
        <div role="tabpanel" id="panel-tarifas" aria-labelledby="tab-tarifas">
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 16,
          flexWrap: "wrap",
          opacity: isPending ? 0.6 : 1,
          transition: "opacity 0.12s",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <label className="studio-label" htmlFor="rate-q">
            Buscar
          </label>
          <input
            id="rate-q"
            type="search"
            className="studio-input"
            placeholder="Ruta, origen, destino, notas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 240px" }}>
          <label className="studio-label" htmlFor="rate-service">
            Servicio
          </label>
          <select
            id="rate-service"
            className="studio-input"
            value={service}
            onChange={(e) => {
              setService(e.target.value);
              pushFilters({ q, service: e.target.value });
            }}
          >
            <option value="">Todos los servicios</option>
            {RATE_SERVICE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {(q || service) && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ height: 38 }}
            onClick={() => {
              setQ("");
              setService("");
              pushFilters({});
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla o empty */}
      {rates.length === 0 ? (
        <EmptyState
          eyebrow={filters.q || filters.service !== "all" ? "Sin resultados" : "Catálogo vacío"}
          title={
            filters.q || filters.service !== "all"
              ? "Ninguna tarifa coincide con estos filtros."
              : "Aún no cargaste tarifas."
          }
          description={
            filters.q || filters.service !== "all"
              ? "Probá ajustar los filtros o limpiá la búsqueda."
              : "Agregá tarifas por ruta para que los Estimados y la Facturación las usen automáticamente."
          }
          action={
            !filters.q && filters.service === "all" ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={() => setDrawer({ mode: "create" })}
              >
                + Nueva tarifa
              </button>
            ) : null
          }
        />
      ) : (
        <RatesTable rates={rates} onEdit={(rate) => setDrawer({ mode: "edit", rate })} />
      )}
        </div>
      )}

      {tab === "ciudades" && (
        <div role="tabpanel" id="panel-ciudades" aria-labelledby="tab-ciudades">
          <CiudadesPanel cities={cities} isAdmin={isAdmin} />
        </div>
      )}

      {tab === "parametros" && (
        <div role="tabpanel" id="panel-parametros" aria-labelledby="tab-parametros">
          <ParametrosPanel settings={settings} />
        </div>
      )}

      {/* Drawer crear/editar */}
      {drawer && (
        <RateDrawer
          mode={drawer.mode}
          rate={drawer.mode === "edit" ? drawer.rate : undefined}
          onClose={() => setDrawer(null)}
        />
      )}

      {/* Importador masivo */}
      {importOpen && <ImportRatesDrawer onClose={() => setImportOpen(false)} />}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────

function TabButton({
  id,
  controls,
  active,
  onClick,
  label,
}: {
  id: string;
  controls: string;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={active}
      onClick={onClick}
      style={{
        appearance: "none",
        background: "transparent",
        border: 0,
        padding: "10px 14px",
        marginBottom: -1,
        cursor: "pointer",
        font: `${active ? 700 : 500} 13px/1 var(--f-sans)`,
        color: active ? "var(--ink)" : "var(--ink-soft)",
        borderBottom: `2px solid ${active ? "var(--wine)" : "transparent"}`,
        transition: "color 0.12s, border-color 0.12s",
      }}
    >
      {label}
    </button>
  );
}

// ── Tabla ─────────────────────────────────────────────────────

const RATES_GRID = "170px 1fr 1fr 130px 90px 110px 230px";

function RatesTable({
  rates,
  onEdit,
}: {
  rates: Rate[];
  onEdit: (rate: Rate) => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const flashClassFor = useRowHighlight();

  // Resalta la row en verde tras un cambio de estado (publicar/archivar).
  const highlightSuccess = (id: string) => {
    router.push(
      `/studio/tarifas?highlight=${encodeURIComponent(id)}&hl-tone=success`,
    );
  };

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: RATES_GRID,
          gap: 12,
          padding: "12px 20px",
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          font: "700 10px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
        }}
      >
        <span>Servicio</span>
        <span>Origen</span>
        <span>Destino</span>
        <span style={{ textAlign: "right" }}>Tarifa</span>
        <span style={{ textAlign: "right" }}>Min charge</span>
        <span>Vigencia</span>
        <span style={{ textAlign: "right" }}>Estado · acciones</span>
      </div>

      {rates.map((rate, i) => (
        <div
          key={rate.id}
          data-row-id={rate.id}
          className={flashClassFor(rate.id)}
          style={{
            display: "grid",
            gridTemplateColumns: RATES_GRID,
            gap: 12,
            padding: "14px 20px",
            borderTop: i > 0 ? "1px solid var(--border)" : 0,
            alignItems: "center",
            background: "transparent",
            transition: "background 0.12s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-elevated)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <span
            style={{
              display: "inline-flex",
              flexDirection: "column",
              gap: 4,
              alignItems: "flex-start",
            }}
          >
            <Badge tone="wine" size="sm">
              {SERVICE_LABELS[rate.service].primary}
            </Badge>
            {rate.status === "published" && rate.is_public && (
              <Badge tone="success" size="sm">
                Pública · calc
              </Badge>
            )}
          </span>
          <span style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
            {rate.origin}
          </span>
          <span style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
            {rate.destination}
          </span>
          <span
            style={{
              font: "800 14px/1 var(--f-mono)",
              color: "var(--wine)",
              textAlign: "right",
            }}
          >
            {formatRate(rate)}
          </span>
          <span
            style={{
              font: "500 12px/1 var(--f-mono)",
              color: "var(--ink-soft)",
              textAlign: "right",
            }}
          >
            {rate.min_charge != null ? `$${rate.min_charge.toFixed(2)}` : "—"}
          </span>
          <span
            style={{
              font: "500 11.5px/1 var(--f-mono)",
              color: "var(--ink-soft)",
            }}
          >
            {rate.valid_until ?? "—"}
          </span>

          {/* Estado + acciones de lifecycle + editar */}
          <span
            style={{
              display: "inline-flex",
              gap: 6,
              justifyContent: "flex-end",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Badge tone={rateStatusTone(rate.status)} size="sm">
              {rateStatusLabel(rate.status)}
            </Badge>

            {rate.status === "draft" && (
              <ActionButton
                variant="primary"
                size="xs"
                idleLabel="Publicar"
                loadingLabel="…"
                successLabel="Publicada"
                successIcon={Icon.check(12)}
                onAction={() => publishRateAction(rate.id)}
                onError={(m) => toast.error(m)}
                onSuccess={() => {
                  toast.success("Tarifa publicada");
                  highlightSuccess(rate.id);
                }}
              />
            )}
            {rate.status !== "archived" && (
              <ActionButton
                variant="ghost"
                size="xs"
                idleLabel="Archivar"
                loadingLabel="…"
                successLabel={null}
                onAction={() => archiveRateAction(rate.id)}
                onError={(m) => toast.error(m)}
                onSuccess={() => {
                  toast.success("Tarifa archivada");
                  highlightSuccess(rate.id);
                }}
              />
            )}

            <button
              type="button"
              onClick={() => onEdit(rate)}
              title="Editar"
              aria-label="Editar tarifa"
              style={{
                width: 28,
                height: 28,
                display: "grid",
                placeItems: "center",
                borderRadius: "var(--r-sm)",
                color: "var(--ink-soft)",
                background: "transparent",
                cursor: "pointer",
                transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-elevated)";
                e.currentTarget.style.color = "var(--ink)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--ink-soft)";
              }}
            >
              {Icon.edit(13)}
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
