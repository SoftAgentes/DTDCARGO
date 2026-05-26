"use client";

/**
 * RoutesClient — orquestador admin de rutas + ciudades (SDD-0029).
 *
 * Tabs URL-state (?tab=routes|cities).
 * Drawers (?view=new-route|edit-route|new-city|edit-city · ?id=<uuid>).
 * Seed catalog button: invoca server action que copia las ~98 ciudades públicas.
 */

import { useTransition, useActionState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { seedTenantCitiesFromVeCatalogAction } from "../actions";
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
          { value: "cities" as Tab, label: "Ciudades", count: citiesCount },
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
        <RoutesTab routes={routes} onCreate={() => openDrawer("new-route")} onEdit={(id) => openDrawer("edit-route", id)} />
      ) : (
        <CitiesTab
          cities={cities}
          citiesCount={citiesCount}
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
// Routes Tab
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
  const active = routes.filter((r) => !r.deleted_at);
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Las rutas definen origen → destino con ciudades intermedias opcionales y SLA en horas.
        </p>
        <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" onClick={onCreate}>
          + Nueva ruta
        </button>
      </div>

      {active.length === 0 ? (
        <EmptyState
          title="Sin rutas configuradas"
          description="Creá tu primera ruta para empezar a despachar paquetes."
          action={
            <button type="button" className="studio-btn studio-btn-primary" onClick={onCreate}>
              Crear ruta
            </button>
          }
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                <th style={thStyle}>Código</th>
                <th style={thStyle}>Nombre</th>
                <th style={thStyle}>Hub</th>
                <th style={thStyle}>Origen → Destino</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Intermedias</th>
                <th style={{ ...thStyle, textAlign: "right" }}>SLA</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Activa</th>
              </tr>
            </thead>
            <tbody>
              {active.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={() => onEdit(r.id)}
                >
                  <td style={tdStyle}>
                    <code style={{ font: "800 12.5px/1 var(--f-mono)", color: "var(--wine)" }}>
                      {r.route_code}
                    </code>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>{r.name}</div>
                    {r.notes && (
                      <div style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-mute)", marginTop: 3 }}>
                        {r.notes}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <Badge tone="info" size="sm">{DISPATCH_HUB_LABELS[r.hub]}</Badge>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ font: "600 12px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                      {r.origin_city}
                    </span>
                    <span style={{ color: "var(--wine)", margin: "0 6px" }}>→</span>
                    <span style={{ font: "600 12px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                      {r.destination_city}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", font: "700 13px/1 var(--f-mono)" }}>
                    {r.intermediate_cities?.length ?? 0}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", font: "700 13px/1 var(--f-mono)" }}>
                    {r.sla_hours}h
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <Badge tone={r.active ? "success" : "neutral"} size="sm">
                      {r.active ? "Activa" : "Inactiva"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Cities Tab
// ─────────────────────────────────────────────────────────────

function CitiesTab({
  cities,
  citiesCount,
  onCreate,
  onEdit,
  seedAction,
  seedPending,
  seedState,
}: {
  cities: DispatchCity[];
  citiesCount: number;
  onCreate: () => void;
  onEdit: (id: string) => void;
  seedAction: (formData: FormData) => void;
  seedPending: boolean;
  seedState: { ok?: boolean; error?: string; createdCode?: string };
}) {
  const isEmpty = citiesCount === 0;

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
            <div style={{ font: "800 14px/1.2 var(--f-display)", color: "var(--ink)", marginBottom: 4 }}>
              Tu catálogo está vacío
            </div>
            <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
              Podés seedear con las 98 ciudades del catálogo público VE (24 estados + IPOSTEL).
              Después editás cuáles te interesan.
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

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          {citiesCount > 0
            ? `${citiesCount} ciudades en tu catálogo. Editá radio, CP o marcá HQ.`
            : "Tu catálogo de ciudades destino."}
        </p>
        <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" onClick={onCreate}>
          + Nueva ciudad
        </button>
      </div>

      {!isEmpty && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
          }}
        >
          <div style={{ overflow: "auto", maxHeight: "70vh" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)", position: "sticky", top: 0, zIndex: 1 }}>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Municipio</th>
                  <th style={thStyle}>Ciudad</th>
                  <th style={thStyle}>CP</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Radio km</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>HQ</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Activa</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                    onClick={() => onEdit(c.id)}
                  >
                    <td style={tdStyle}>
                      <div style={{ font: "700 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}>{c.state_name}</div>
                      <code style={{ font: "600 10.5px/1.2 var(--f-mono)", color: "var(--ink-mute)", marginTop: 3, display: "inline-block" }}>
                        {c.state_code}
                      </code>
                    </td>
                    <td style={tdStyle}>{c.municipio}</td>
                    <td style={tdStyle}>
                      <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>{c.city}</div>
                    </td>
                    <td style={{ ...tdStyle, font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                      {c.postal_code ?? "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", font: "700 13px/1 var(--f-mono)" }}>
                      {c.default_radius_km}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {c.is_hq ? <Badge tone="wine" size="sm">HQ</Badge> : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <Badge tone={c.active ? "success" : "neutral"} size="sm">
                        {c.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
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
      <div style={{ font: "800 16px/1.2 var(--f-display)", color: "var(--ink)", marginBottom: 8 }}>
        {title}
      </div>
      <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "0 0 20px" }}>
        {description}
      </p>
      {action}
    </div>
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
