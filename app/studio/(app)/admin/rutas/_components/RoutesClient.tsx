"use client";

/**
 * RoutesClient — orquestador admin de rutas + ciudades (SDD-0029).
 *
 * Alineado a Claude Design v1.7 (erp/modules/admin-routes.jsx):
 *   - Tab Rutas: 4 KPIs + Toolbar (search + type filter) + cards (no tabla)
 *   - Tab Ciudades: header rico + banner IPOSTEL + cols Uso/Barrios + banner radio
 *
 * Tabs URL-state (?tab=routes|cities).
 * Drawers (?view=new-route|edit-route|new-city|edit-city · ?id=<uuid>).
 */

import { useMemo, useState, useTransition, useActionState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { ActionableRow } from "@/app/studio/_components/ui/DataTable";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { Icon } from "@/app/studio/_components/icons";
import {
  seedTenantCitiesFromVeCatalogAction,
  softDeleteRouteAction,
  toggleRouteActiveAction,
} from "../actions";
import { RouteDrawer } from "./RouteDrawer";
import { CityDrawer } from "./CityDrawer";
import { DISPATCH_HUB_LABELS } from "@/lib/studio/dispatch-types";
import type {
  DispatchCity,
  DispatchRoute,
  RoutesActionState,
} from "@/lib/studio/dispatch-routes-types";
import type { VeLocalityEntry } from "@/lib/studio/ve-catalog-types";

const SEED_INITIAL: RoutesActionState = {};

type Tab = "routes" | "cities";
type TypeFilter = "all" | "active" | "inactive" | "directa" | "intermedias";

interface Props {
  routes: DispatchRoute[];
  cities: DispatchCity[];
  citiesCount: number;
  veCatalog: VeLocalityEntry[];
}

export function RoutesClient({ routes, cities, citiesCount, veCatalog }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const rawTab = params.get("tab");
  const tab: Tab = rawTab === "cities" ? "cities" : "routes";
  const view = params.get("view");
  const editId = params.get("id");

  const [seedState, seedAction, seedPending] = useActionState(
    seedTenantCitiesFromVeCatalogAction,
    SEED_INITIAL,
  );

  const changeTab = (next: Tab) => {
    const sp = new URLSearchParams(params.toString());
    if (next === "routes") sp.delete("tab");
    else sp.set("tab", next);
    sp.delete("view");
    sp.delete("id");
    startTransition(() => {
      router.replace(sp.toString() ? `${pathname}?${sp.toString()}` : pathname, {
        scroll: false,
      });
    });
  };

  const openDrawer = (view: string, id?: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("view", view);
    if (id) sp.set("id", id);
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  };

  const closeDrawer = () => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("view");
    sp.delete("id");
    router.replace(sp.toString() ? `${pathname}?${sp.toString()}` : pathname, {
      scroll: false,
    });
    router.refresh();
  };

  const editingRoute = editId ? routes.find((r) => r.id === editId) : undefined;
  const editingCity = editId ? cities.find((c) => c.id === editId) : undefined;

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
        }}
      >
        {[
          { value: "routes" as Tab, label: "Rutas", count: routes.length },
          { value: "cities" as Tab, label: "Configurable por ciudad", count: citiesCount },
        ].map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              role="tab"
              type="button"
              onClick={() => changeTab(t.value)}
              style={{
                padding: "12px 18px",
                background: "transparent",
                border: 0,
                borderBottom: active ? "2px solid var(--wine)" : "2px solid transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                font: `${active ? "700" : "500"} 13px/1 var(--f-sans)`,
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t.label}
              <span
                style={{
                  marginLeft: 8,
                  padding: "2px 7px",
                  background: active ? "var(--wine-tint)" : "var(--bg-elevated)",
                  color: active ? "var(--wine)" : "var(--ink-mute)",
                  borderRadius: "var(--r-pill)",
                  font: "700 10.5px/1 var(--f-mono)",
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "routes" ? (
        <RoutesTab
          routes={routes}
          onCreate={() => openDrawer("new-route")}
          onEdit={(id) => openDrawer("edit-route", id)}
        />
      ) : (
        <CitiesTab
          cities={cities}
          citiesCount={citiesCount}
          routes={routes}
          veCatalog={veCatalog}
          onCreate={() => openDrawer("new-city")}
          onEdit={(id) => openDrawer("edit-city", id)}
          seedAction={seedAction}
          seedPending={seedPending}
          seedState={seedState}
        />
      )}

      {/* Drawers */}
      {(view === "new-route" || (view === "edit-route" && editingRoute)) && (
        <RouteDrawer
          mode={view === "new-route" ? "create" : "edit"}
          route={editingRoute ?? null}
          cities={cities}
          veCatalog={veCatalog}
          onClose={closeDrawer}
        />
      )}

      {(view === "new-city" || (view === "edit-city" && editingCity)) && (
        <CityDrawer
          mode={view === "new-city" ? "create" : "edit"}
          city={editingCity ?? null}
          veCatalog={veCatalog}
          onClose={closeDrawer}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Routes Tab — KPIs + Toolbar + Cards (v1.7 alineado)
// ─────────────────────────────────────────────────────────────

function RoutesTab({
  routes,
  onCreate,
  onEdit,
}: {
  routes: DispatchRoute[];
  onCreate: () => void;
  onEdit: (id: string) => void;
}) {
  const visible = routes.filter((r) => !r.deleted_at);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const stats = useMemo(() => {
    const total = visible.length;
    const active = visible.filter((r) => r.active).length;
    const direct = visible.filter((r) => r.route_type === "directa").length;
    const withStops = visible.filter((r) => r.route_type === "intermedias").length;
    const stopsAvg = (() => {
      const cp = visible.filter((r) => r.route_type === "intermedias");
      if (cp.length === 0) return 0;
      const total = cp.reduce((s, r) => s + (r.intermediate_cities?.length ?? 0), 0);
      return Math.round((total / cp.length) * 10) / 10;
    })();
    return { total, active, direct, withStops, stopsAvg };
  }, [visible]);

  const filtered = useMemo(() => {
    return visible.filter((r) => {
      if (typeFilter === "directa" && r.route_type !== "directa") return false;
      if (typeFilter === "intermedias" && r.route_type !== "intermedias") return false;
      if (typeFilter === "inactive" && r.active) return false;
      if (typeFilter === "active" && !r.active) return false;
      if (search) {
        const q = search.toLowerCase();
        const hit =
          r.name.toLowerCase().includes(q) ||
          r.destination_city.toLowerCase().includes(q) ||
          r.origin_city.toLowerCase().includes(q) ||
          r.route_code.toLowerCase().includes(q) ||
          (r.intermediate_cities ?? []).some((s) => s.city.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [visible, typeFilter, search]);

  return (
    <>
      {/* 4 KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <KpiCard
          label="Total rutas"
          value={stats.total}
          sub={`${stats.active} activa${stats.active === 1 ? "" : "s"}`}
        />
        <KpiCard
          label="Directas"
          value={stats.direct}
          sub="sin paradas intermedias"
        />
        <KpiCard
          label="Con ciudades"
          value={stats.withStops}
          sub={
            stats.withStops > 0
              ? `promedio ${stats.stopsAvg} ciudad${stats.stopsAvg === 1 ? "" : "es"}`
              : "—"
          }
        />
        <KpiCard
          label="Cobertura"
          value={stats.total > 0 ? `${stats.active}/${stats.total}` : "0/0"}
          sub="activas / totales"
        />
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            position: "relative",
            flex: 1,
            minWidth: 240,
            maxWidth: 420,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ink-mute)",
              pointerEvents: "none",
            }}
          >
            {Icon.search(15)}
          </span>
          <input
            type="search"
            className="studio-input"
            placeholder="Buscar ruta, destino, parada…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36, width: "100%" }}
          />
        </div>
        <select
          className="studio-input"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          style={{ width: 180 }}
        >
          <option value="all">Todas las rutas</option>
          <option value="active">Solo activas</option>
          <option value="inactive">Solo inactivas</option>
          <option value="directa">Directas</option>
          <option value="intermedias">Con ciudades</option>
        </select>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={onCreate}
        >
          <span style={{ marginRight: 6, display: "inline-flex" }}>
            {Icon.plus(14)}
          </span>
          Nueva ruta
        </button>
      </div>

      {/* Lista de cards */}
      {filtered.length === 0 ? (
        <RoutesEmptyState
          hasAny={visible.length > 0}
          onCreate={onCreate}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((r) => (
            <RouteRowCard key={r.id} route={r} onEdit={() => onEdit(r.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function RouteRowCard({
  route,
  onEdit,
}: {
  route: DispatchRoute;
  onEdit: () => void;
}) {
  const isDir = route.route_type === "directa";
  const intermediates = route.intermediate_cities ?? [];
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [, startDeleteTransition] = useTransition();
  const [archiveState, archiveAction, archivePending] = useActionState(
    toggleRouteActiveAction,
    {} as RoutesActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    softDeleteRouteAction,
    {} as RoutesActionState,
  );

  void archiveState;
  void deleteState;

  return (
    <>
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "14px 18px",
        opacity: route.active ? 1 : 0.7,
        transition: "opacity 160ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 6,
            }}
          >
            <code style={{ font: "800 12px/1 var(--f-mono)", color: "var(--wine-text)" }}>
              {route.route_code}
            </code>
            <div
              style={{
                font: "800 15px/1.1 var(--f-display)",
                color: "var(--ink)",
                letterSpacing: "-0.01em",
              }}
            >
              {route.name}
            </div>
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "var(--r-sm)",
                background: isDir ? "var(--info-bg)" : "var(--warning-bg)",
                color: isDir ? "var(--info)" : "var(--warning)",
                font: "800 10px/1 var(--f-sans)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {isDir ? "Directa" : "Con ciudades"}
            </span>
            <Badge tone="info" size="sm">
              {DISPATCH_HUB_LABELS[route.hub]}
            </Badge>
            {!route.active && (
              <Badge tone="neutral" size="sm">
                Archivada
              </Badge>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            <span>
              Origen:{" "}
              <b style={{ color: "var(--ink)" }}>{route.origin_city}</b>
            </span>
            <span style={{ color: "var(--ink-mute)" }}>·</span>
            <span>
              Destino:{" "}
              <b style={{ color: "var(--ink)" }}>{route.destination_city}</b>
            </span>
            <span style={{ color: "var(--ink-mute)" }}>·</span>
            <span>SLA {route.sla_hours}h</span>
          </div>
          {!isDir && intermediates.length > 0 && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              <span
                style={{
                  font: "700 10px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  alignSelf: "center",
                }}
              >
                Ciudades:
              </span>
              {intermediates.map((s, i) => (
                <span
                  key={`${s.city}-${i}`}
                  style={{
                    padding: "4px 8px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-sm)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      color: "var(--ink)",
                      font: "600 12px/1 var(--f-sans)",
                    }}
                  >
                    {s.city}
                  </span>
                  <span
                    style={{
                      color: "var(--wine-text)",
                      font: "700 11px/1 var(--f-mono)",
                    }}
                  >
                    {s.radius_km}km
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div
          style={{
            display: "inline-flex",
            gap: 4,
            flexShrink: 0,
            alignItems: "flex-start",
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onEdit}
            disabled={archivePending || deletePending}
          >
            <span style={{ marginRight: 6, display: "inline-flex" }}>
              {Icon.edit(13)}
            </span>
            Editar
          </button>
          <form action={archiveAction} style={{ display: "inline-flex" }}>
            <input type="hidden" name="id" value={route.id} />
            <input
              type="hidden"
              name="active"
              value={route.active ? "false" : "true"}
            />
            <button
              type="submit"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              disabled={archivePending || deletePending}
            >
              <span style={{ marginRight: 6, display: "inline-flex" }}>
                {route.active ? Icon.eye(13) : Icon.refresh(13)}
              </span>
              {route.active ? "Archivar" : "Reactivar"}
            </button>
          </form>
          <div style={{ display: "inline-flex" }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              disabled={archivePending || deletePending}
              style={{ color: "var(--danger)" }}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <span style={{ marginRight: 6, display: "inline-flex" }}>
                {Icon.trash(13)}
              </span>
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
      <ConfirmDialog
        open={deleteConfirmOpen}
        danger
        pending={deletePending}
        title={`Eliminar ruta ${route.route_code}`}
        message="La ruta quedará desactivada y dejará de aparecer en las listas. Su historial se conserva."
        confirmLabel="Eliminar ruta"
        error={deleteState?.error}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          const data = new FormData();
          data.set("id", route.id);
          startDeleteTransition(() => deleteAction(data));
        }}
      />
    </>
  );
}

function RoutesEmptyState({
  hasAny,
  onCreate,
}: {
  hasAny: boolean;
  onCreate: () => void;
}) {
  return (
    <div
      style={{
        padding: 60,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          font: "800 16px/1.2 var(--f-display)",
          color: "var(--ink)",
          marginBottom: 8,
        }}
      >
        {hasAny ? "No hay rutas con esos filtros" : "Sin rutas configuradas"}
      </div>
      <p
        style={{
          font: "500 12.5px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 20px",
        }}
      >
        {hasAny
          ? "Ajusta los filtros o crea una ruta nueva."
          : "Crea tu primera ruta para empezar a despachar paquetes."}
      </p>
      <button
        type="button"
        className="studio-btn studio-btn-primary"
        onClick={onCreate}
      >
        <span style={{ marginRight: 6, display: "inline-flex" }}>
          {Icon.plus(14)}
        </span>
        {hasAny ? "Nueva ruta" : "Crear ruta"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cities Tab — header rico + IPOSTEL + cols Uso/Barrios (v1.7)
// ─────────────────────────────────────────────────────────────

function CitiesTab({
  cities,
  citiesCount,
  routes,
  veCatalog,
  onCreate,
  onEdit,
  seedAction,
  seedPending,
  seedState,
}: {
  cities: DispatchCity[];
  citiesCount: number;
  routes: DispatchRoute[];
  veCatalog: VeLocalityEntry[];
  onCreate: () => void;
  onEdit: (id: string) => void;
  seedAction: (formData: FormData) => void;
  seedPending: boolean;
  seedState: { ok?: boolean; error?: string; createdCode?: string };
}) {
  const isEmpty = citiesCount === 0;

  // Lookup barrios desde catálogo público por (state_code, city)
  const barriosByCity = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of veCatalog) {
      map.set(`${e.state_code}::${e.city}`, e.barrios ?? []);
    }
    return map;
  }, [veCatalog]);

  // Lookup uso desde rutas activas + soft-deleted excluidas
  const usageByCity = useMemo(() => {
    const map = new Map<string, number>();
    const visible = routes.filter((r) => !r.deleted_at);
    for (const r of visible) {
      const cities = new Set<string>();
      cities.add(r.origin_city);
      cities.add(r.destination_city);
      for (const ic of r.intermediate_cities ?? []) cities.add(ic.city);
      for (const c of cities) {
        map.set(c, (map.get(c) ?? 0) + 1);
      }
    }
    return map;
  }, [routes]);

  const visible = cities.filter((c) => c.active);
  const inactive = cities.filter((c) => !c.active);

  return (
    <>
      {isEmpty && (
        <div
          style={{
            padding: 18,
            background: "var(--info-bg)",
            border: "1px solid var(--info)",
            borderRadius: "var(--r-md)",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                font: "800 14px/1.2 var(--f-display)",
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              Tu catálogo está vacío
            </div>
            <p
              style={{
                font: "500 12.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
              }}
            >
              Puedes seedear con las 98 ciudades del catálogo público VE (24 estados +
              IPOSTEL). Después editas cuáles te interesan.
            </p>
          </div>
          <form action={seedAction}>
            <button
              type="submit"
              className="studio-btn studio-btn-primary"
              disabled={seedPending}
            >
              {seedPending ? "Seedeando…" : "Seedear desde catálogo VE"}
            </button>
          </form>
        </div>
      )}

      {seedState?.ok && seedState.createdCode && (
        <div
          style={{
            padding: 12,
            background: "var(--success-bg)",
            color: "var(--success)",
            borderRadius: "var(--r-md)",
            marginBottom: 14,
            font: "600 13px/1.3 var(--f-sans)",
          }}
        >
          {seedState.createdCode}
        </div>
      )}

      {/* SDD-0497: el seed ya devuelve motivo (denegación de permiso o fallo de
          la RPC) y hasta acá nadie lo mostraba — el botón quedaba mudo. */}
      {seedState?.error && (
        <div
          role="alert"
          style={{
            padding: 12,
            background: "var(--danger-bg)",
            /* `--danger-text`, no `--danger`: en oscuro el crudo da 4,19:1
               sobre este fondo y no pasa AA (SDD-0275, tokens.css:284-293). */
            color: "var(--danger-text)",
            borderRadius: "var(--r-md)",
            marginBottom: 14,
            font: "600 13px/1.3 var(--f-sans)",
          }}
        >
          {seedState.error}
        </div>
      )}

      {/* Header rico */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="studio-eyebrow">Catálogo per-tenant · DTD Cargo</span>
          <div
            style={{
              font: "900 17px/1.1 var(--f-display)",
              color: "var(--ink)",
              letterSpacing: "-0.02em",
              marginTop: 6,
            }}
          >
            Configurable por ciudad
          </div>
          <p
            style={{
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 6,
              maxWidth: "70ch",
            }}
          >
            Cada tenant define su catálogo de ciudades operables siguiendo la
            estructura venezolana{" "}
            <b style={{ color: "var(--ink)" }}>
              Estado → Municipio → Parroquia → Ciudad → Barrio
            </b>
            . El radio default se precarga cuando agregas esa ciudad como parada en
            una ruta — editable después por ruta sin tocar el catálogo.
          </p>
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={onCreate}
        >
          <span style={{ marginRight: 6, display: "inline-flex" }}>
            {Icon.plus(14)}
          </span>
          Agregar ciudad
        </button>
      </div>

      {/* Banner IPOSTEL */}
      <div
        style={{
          marginBottom: 14,
          padding: "10px 14px",
          background: "var(--info-bg)",
          color: "var(--info)",
          borderRadius: "var(--r-md)",
          font: "500 11.5px/1.5 var(--f-sans)",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <span style={{ marginTop: 1, flexShrink: 0, display: "inline-flex" }}>
          {Icon.info(13)}
        </span>
        <span>
          <b>Códigos postales venezolanos (IPOSTEL):</b> 4 dígitos, a veces con
          sufijo{" "}
          <code style={{ font: "700 11px/1 var(--f-mono)" }}>-A</code> para zonas
          dentro del mismo código. Caracas centro 1010 · Chacao 1060 · Valencia
          2001 · Maracaibo 4001. La columna Barrios cuenta las urbanizaciones
          registradas para el filtro de la cola de despacho.
        </span>
      </div>

      {!isEmpty && (
        <>
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              overflow: "hidden",
            }}
          >
            <div style={{ overflow: "auto", maxHeight: "70vh" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 880,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "var(--bg-elevated)",
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    <th style={thStyle}>Ciudad</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Municipio</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>CP</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Barrios</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Radio km</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>HQ</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Activa</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Uso</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <CityRow
                      key={c.id}
                      c={c}
                      barrios={barriosByCity.get(`${c.state_code}::${c.city}`) ?? []}
                      usage={usageByCity.get(c.city) ?? 0}
                      onEdit={() => onEdit(c.id)}
                    />
                  ))}
                  {inactive.length > 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          padding: "12px 14px",
                          background: "var(--bg-elevated)",
                          font: "700 10.5px/1 var(--f-sans)",
                          color: "var(--ink-soft)",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                        }}
                      >
                        Inactivas · {inactive.length}
                      </td>
                    </tr>
                  )}
                  {inactive.map((c) => (
                    <CityRow
                      key={c.id}
                      c={c}
                      barrios={barriosByCity.get(`${c.state_code}::${c.city}`) ?? []}
                      usage={usageByCity.get(c.city) ?? 0}
                      onEdit={() => onEdit(c.id)}
                      dimmed
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Banner info radio */}
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "var(--info-bg)",
              color: "var(--info)",
              borderRadius: "var(--r-md)",
              font: "500 11.5px/1.5 var(--f-sans)",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <span style={{ marginTop: 1, flexShrink: 0, display: "inline-flex" }}>
              {Icon.info(13)}
            </span>
            <span>
              <b>¿Cómo se usa el radio?</b> Cuando un cliente está dentro del
              radio km de una parada, califica para esa ruta. Por ejemplo, si{" "}
              <code style={{ font: "700 11.5px/1 var(--f-mono)" }}>Maracay</code>{" "}
              tiene radio 20km, los clientes a más de 20km no aparecen como
              elegibles para una ruta que pase por Maracay.
            </span>
          </div>
        </>
      )}
    </>
  );
}

function CityRow({
  c,
  barrios,
  usage,
  onEdit,
  dimmed = false,
}: {
  c: DispatchCity;
  barrios: string[];
  usage: number;
  onEdit: () => void;
  dimmed?: boolean;
}) {
  return (
    <ActionableRow
      onSelect={onEdit}
      label={`Editar ${c.city}`}
      style={{
        borderTop: "1px solid var(--border)",
        opacity: dimmed ? 0.6 : 1,
      }}
    >
      <td style={tdStyle}>
        <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
          {c.city}
        </div>
      </td>
      <td style={tdStyle}>
        <div style={{ font: "600 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}>
          {c.state_name}
        </div>
        <code
          style={{
            font: "600 10.5px/1.2 var(--f-mono)",
            color: "var(--ink-soft)",
            marginTop: 3,
            display: "inline-block",
          }}
        >
          {c.state_code}
        </code>
      </td>
      <td style={tdStyle}>{c.municipio}</td>
      <td
        style={{
          ...tdStyle,
          textAlign: "center",
          font: "600 12px/1 var(--f-mono)",
          color: "var(--ink-soft)",
        }}
      >
        {c.postal_code ?? "—"}
      </td>
      <td style={{ ...tdStyle, textAlign: "center" }}>
        {barrios.length > 0 ? (
          <span
            title={barrios.join(" · ")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: "var(--r-sm)",
              background: "var(--bg-elevated)",
              color: "var(--ink-soft)",
              font: "700 11px/1 var(--f-sans)",
              cursor: "help",
            }}
          >
            {Icon.pin(10)} {barrios.length}
          </span>
        ) : (
          <span style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-mute)" }}>
            —
          </span>
        )}
      </td>
      <td
        style={{
          ...tdStyle,
          textAlign: "right",
          font: "700 13px/1 var(--f-mono)",
        }}
      >
        {c.is_hq ? (
          <span style={{ font: "500 11.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
            — (HQ)
          </span>
        ) : (
          <>{c.default_radius_km}</>
        )}
      </td>
      <td style={{ ...tdStyle, textAlign: "center" }}>
        {c.is_hq ? <Badge tone="wine" size="sm">HQ</Badge> : "—"}
      </td>
      <td style={{ ...tdStyle, textAlign: "center" }}>
        <Badge tone={c.active ? "success" : "neutral"} size="sm">
          {c.active ? "Activa" : "Inactiva"}
        </Badge>
      </td>
      <td style={{ ...tdStyle, textAlign: "center" }}>
        {usage === 0 ? (
          <span
            style={{ font: "600 11.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}
          >
            Sin uso
          </span>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 8px",
              borderRadius: "var(--r-sm)",
              background: "var(--wine-tint)",
              color: "var(--wine-text)",
              font: "800 11px/1 var(--f-sans)",
            }}
          >
            {usage} ruta{usage === 1 ? "" : "s"}
          </span>
        )}
      </td>
    </ActionableRow>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  font: "700 10.5px/1 var(--f-sans)",
  color: "var(--ink-soft)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  font: "500 12.5px/1.3 var(--f-sans)",
  color: "var(--ink)",
};
