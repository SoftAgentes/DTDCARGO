"use client";

/**
 * Orquestador client del módulo Legal (SDD-0054 · Slice B).
 *
 * Read-only. Dos vistas (tabs):
 *   1. Documentos   — repositorio versionado: por cada doc (key), header con la
 *      versión vigente + histórico de versiones en tabla. Botón "Ver" abre un
 *      modal con el body completo del doc.
 *   2. Aceptaciones — KPIs + búsqueda + filtro por documento + tabla de acuses +
 *      modal de detalle con la Evidencia (cliente/markbox, estimado, docs+
 *      versión, fecha/hora, IP, hash).
 *
 * NO publica versiones nuevas (futuro). Usa primitivas reales del Studio
 * (Badge, EmptyState, KpiCard, tokens, Icon) — no los ERPUI.* del mockup.
 */

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import type {
  LegalAcceptance,
  LegalDoc,
  LegalSection,
} from "@/lib/studio/legal/types";

type Tab = "docs" | "acceptances";

/** Etiqueta corta de un doc por key (para badges en la bitácora). */
function shortKey(key: string): string {
  if (key === "tyc") return "T&C";
  if (key === "operador") return "Op.";
  return key;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LegalClient({
  docs,
  acceptances,
  currentVersions,
  kpis,
}: {
  docs: LegalDoc[];
  acceptances: LegalAcceptance[];
  currentVersions: Record<string, string>;
  kpis: { total: number; thisMonth: number; onCurrent: number };
}) {
  const [tab, setTab] = useState<Tab>("docs");

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Sistema · Capa legal</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Legal · T&amp;C.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "64ch",
            }}
          >
            Repositorio versionado de los documentos legales de cara al cliente y
            bitácora inmutable de aceptaciones de T&amp;C. Cada aceptación queda
            atada a la versión vigente al momento de aceptar.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Vistas de la capa legal"
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <TabButton active={tab === "docs"} onClick={() => setTab("docs")}>
          Documentos
        </TabButton>
        <TabButton
          active={tab === "acceptances"}
          onClick={() => setTab("acceptances")}
        >
          Aceptaciones
        </TabButton>
      </div>

      {tab === "docs" ? (
        <DocsView docs={docs} />
      ) : (
        <AcceptancesView
          acceptances={acceptances}
          docs={docs}
          currentVersions={currentVersions}
          kpis={kpis}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "10px 14px",
        background: "transparent",
        border: "none",
        borderBottom: active
          ? "2px solid var(--wine)"
          : "2px solid transparent",
        marginBottom: -1,
        font: `${active ? 700 : 500} 13px/1 var(--f-sans)`,
        color: active ? "var(--ink)" : "var(--ink-soft)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════
// 1 · Documentos · repositorio versionado
// ════════════════════════════════════════════════════════════

type DocGroup = {
  key: string;
  name: string;
  audience: string;
  current: LegalDoc | null;
  versions: LegalDoc[];
};

function DocsView({ docs }: { docs: LegalDoc[] }) {
  const [viewing, setViewing] = useState<LegalDoc | null>(null);

  // Agrupar por key (las versiones ya vienen ordenadas version desc).
  const groups = useMemo<DocGroup[]>(() => {
    const byKey = new Map<string, LegalDoc[]>();
    for (const d of docs) {
      const arr = byKey.get(d.key) ?? [];
      arr.push(d);
      byKey.set(d.key, arr);
    }
    return [...byKey.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, versions]) => ({
        key,
        name: versions[0]?.name ?? key,
        audience: versions[0]?.audience ?? "cliente",
        current: versions.find((v) => v.status === "vigente") ?? null,
        versions,
      }));
  }, [docs]);

  if (groups.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin documentos"
        title="No hay documentos legales cargados."
        description="Cuando se publiquen los T&C y las Condiciones del Operador, aparecerán acá con su histórico de versiones."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map((doc) => {
        const cur = doc.current;
        return (
          <div
            key={doc.key}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--r-md)",
                  background: "var(--wine-tint)",
                  color: "var(--wine)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {Icon.doc(20)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      font: "800 15px/1.2 var(--f-display)",
                      color: "var(--ink)",
                    }}
                  >
                    {doc.name}
                  </span>
                  {cur ? (
                    <Badge tone="success" size="sm" dot>
                      Vigente {cur.version}
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      Sin versión vigente
                    </Badge>
                  )}
                </div>
                <div
                  style={{
                    font: "500 12px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    marginTop: 5,
                  }}
                >
                  Audiencia: {doc.audience}
                  {cur
                    ? ` · en vigor desde ${fmtDate(cur.effective_date)} · ${cur.sections} secciones`
                    : ""}
                </div>
              </div>
              {cur && (
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={() => setViewing(cur)}
                >
                  <span style={{ display: "inline-flex", marginRight: 4 }}>
                    {Icon.eye(13)}
                  </span>
                  Ver
                </button>
              )}
            </div>

            {/* Histórico de versiones */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 130px 1fr 110px",
                  gap: 12,
                  padding: "9px 14px",
                  background: "var(--bg-elevated)",
                  font: "700 9.5px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                <span>Versión</span>
                <span>Vigencia</span>
                <span>Secciones</span>
                <span style={{ textAlign: "right" }}>Estado</span>
              </div>
              {doc.versions.map((v, i) => (
                <div
                  key={v.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "90px 130px 1fr 110px",
                    gap: 12,
                    padding: "11px 14px",
                    alignItems: "center",
                    borderTop: i > 0 ? "1px solid var(--border)" : 0,
                    background:
                      v.status === "vigente"
                        ? "var(--wine-tint)"
                        : "var(--bg-surface)",
                  }}
                >
                  <code
                    style={{
                      font: "800 12.5px/1 var(--f-mono)",
                      color:
                        v.status === "vigente" ? "var(--wine)" : "var(--ink)",
                    }}
                  >
                    {v.version}
                  </code>
                  <span
                    style={{
                      font: "600 11.5px/1 var(--f-mono)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    {fmtDate(v.effective_date)}
                  </span>
                  <span
                    style={{
                      font: "500 11.5px/1.4 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    {v.sections} secciones
                  </span>
                  <span style={{ textAlign: "right" }}>
                    {v.status === "vigente" ? (
                      <Badge tone="success" size="sm">
                        Vigente
                      </Badge>
                    ) : (
                      <Badge tone="neutral" size="sm">
                        Archivada
                      </Badge>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Nota informativa (no AI slop, tono info del sistema). */}
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "12px 14px",
          background: "var(--info-bg)",
          borderRadius: "var(--r-md)",
        }}
      >
        <span
          style={{
            color: "var(--info)",
            display: "flex",
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {Icon.shield(15)}
        </span>
        <div style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink)" }}>
          Al publicar una nueva versión, las aceptaciones previas conservan su
          versión histórica (no se reescriben). Los estimados nuevos pedirán
          aceptar la versión vigente.
        </div>
      </div>

      {viewing && (
        <DocModal doc={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

function DocModal({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  const body: LegalSection[] = Array.isArray(doc.body) ? doc.body : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-doc-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 110,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 96vw)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-pop)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
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
          <div>
            <h2
              id="legal-doc-title"
              className="studio-display"
              style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
            >
              {doc.name}
            </h2>
            <p
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "6px 0 0",
              }}
            >
              <code
                style={{ font: "700 12px/1 var(--f-mono)", color: "var(--wine)" }}
              >
                {doc.version}
              </code>{" "}
              · en vigor desde {fmtDate(doc.effective_date)} · {doc.sections}{" "}
              secciones
            </p>
          </div>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onClose}
            autoFocus
          >
            Cerrar
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {body.length === 0 ? (
            <p
              style={{
                font: "500 13px/1.5 var(--f-sans)",
                color: "var(--ink-mute)",
                margin: 0,
              }}
            >
              Sin contenido cargado para esta versión.
            </p>
          ) : (
            body.map(([heading, paragraph], i) => (
              <div key={i}>
                <div
                  style={{
                    font: "800 13px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                    marginBottom: 4,
                  }}
                >
                  {heading}
                </div>
                <p
                  style={{
                    font: "500 13px/1.6 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: 0,
                  }}
                >
                  {paragraph}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 2 · Aceptaciones · bitácora consultable
// ════════════════════════════════════════════════════════════

const ACC_GRID = "120px 1fr 140px 160px 150px 36px";

function AcceptancesView({
  acceptances,
  docs,
  currentVersions,
  kpis,
}: {
  acceptances: LegalAcceptance[];
  docs: LegalDoc[];
  currentVersions: Record<string, string>;
  kpis: { total: number; thisMonth: number; onCurrent: number };
}) {
  const [search, setSearch] = useState("");
  const [docFilter, setDocFilter] = useState("all");
  const [selected, setSelected] = useState<LegalAcceptance | null>(null);

  // Opciones del filtro de documento = keys distintas presentes en los docs.
  const docOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of docs) if (!seen.has(d.key)) seen.set(d.key, d.name);
    return [...seen.entries()].map(([key, name]) => ({ key, name }));
  }, [docs]);

  const filtered = useMemo(
    () =>
      acceptances.filter((a) => {
        if (docFilter !== "all" && !a.docs.some((d) => d.key === docFilter))
          return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const hay = [
            a.acceptance_code,
            a.client_markbox,
            a.quote_code,
            a.ip,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [acceptances, search, docFilter],
  );

  const isStale = (key: string, version: string) =>
    !!currentVersions[key] && currentVersions[key] !== version;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard
          value={kpis.total}
          label="Aceptaciones totales"
          valueColor="var(--ink)"
        />
        <KpiCard
          value={kpis.thisMonth}
          label="Este mes"
          valueColor={kpis.thisMonth > 0 ? "var(--wine)" : "var(--ink)"}
        />
        <KpiCard
          value={`${kpis.onCurrent}/${kpis.total}`}
          label="En versión vigente"
          valueColor={
            kpis.total > 0 && kpis.onCurrent === kpis.total
              ? "var(--success)"
              : "var(--ink)"
          }
          sub="Cubren la versión vigente de cada doc"
        />
      </div>

      {/* Filtros */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <label className="studio-label" htmlFor="acc-search">
            Buscar
          </label>
          <input
            id="acc-search"
            type="text"
            className="studio-input"
            placeholder="Acuse, Shipping Mark, estimado, IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ minWidth: 240 }}>
          <label className="studio-label" htmlFor="acc-doc">
            Documento
          </label>
          <select
            id="acc-doc"
            className="studio-input"
            value={docFilter}
            onChange={(e) => setDocFilter(e.target.value)}
          >
            <option value="all">Todos los documentos</option>
            {docOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <EmptyState
          eyebrow={acceptances.length === 0 ? "Sin aceptaciones" : "Sin resultados"}
          title={
            acceptances.length === 0
              ? "Todavía no hay aceptaciones registradas."
              : "Ninguna aceptación coincide con el filtro."
          }
          description={
            acceptances.length === 0
              ? "Cuando un cliente acepte los T&C de un estimado, el acuse aparecerá acá (inmutable y auditado)."
              : "Probá ajustar la búsqueda o el filtro de documento."
          }
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: ACC_GRID,
              gap: 10,
              padding: "11px 16px",
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              font: "700 9.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            <span>Acuse</span>
            <span>Cliente</span>
            <span>Estimado</span>
            <span>Documentos</span>
            <span>Fecha / hora</span>
            <span />
          </div>
          {filtered.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              className="studio-tracking-row"
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: ACC_GRID,
                gap: 10,
                padding: "12px 16px",
                alignItems: "center",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                textAlign: "left",
                cursor: "pointer",
                background: "var(--bg-surface)",
              }}
            >
              <code
                style={{
                  font: "700 11.5px/1 var(--f-mono)",
                  color: "var(--wine)",
                }}
              >
                {a.acceptance_code}
              </code>
              <div style={{ minWidth: 0 }}>
                <code
                  style={{
                    font: "600 11.5px/1 var(--f-mono)",
                    color: "var(--ink)",
                  }}
                >
                  {a.client_markbox ?? "—"}
                </code>
              </div>
              <code
                style={{
                  font: "600 11.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                {a.quote_code ?? "—"}
              </code>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {a.docs.map((d, k) => (
                  <Badge
                    key={k}
                    tone={isStale(d.key, d.version) ? "warning" : "neutral"}
                    size="sm"
                  >
                    {shortKey(d.key)} {d.version}
                  </Badge>
                ))}
              </div>
              <span
                style={{
                  font: "500 11px/1.3 var(--f-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                {fmtDateTime(a.accepted_at)}
              </span>
              <span
                style={{
                  color: "var(--ink-mute)",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                {Icon.chevR(15)}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <AcceptanceModal
          acceptance={selected}
          isStale={isStale}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/** Fila de la sección Evidencia (label izq / valor mono der). */
function EvidenceRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "9px 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          font: "500 12px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          flexShrink: 0,
        }}
      >
        {k}
      </span>
      <span
        style={{
          font: "600 12px/1.4 var(--f-mono)",
          color: "var(--ink)",
          textAlign: "right",
          wordBreak: "break-all",
        }}
      >
        {v}
      </span>
    </div>
  );
}

function AcceptanceModal({
  acceptance,
  isStale,
  onClose,
}: {
  acceptance: LegalAcceptance;
  isStale: (key: string, version: string) => boolean;
  onClose: () => void;
}) {
  const a = acceptance;
  const anyStale = a.docs.some((d) => isStale(d.key, d.version));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acc-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 110,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(540px, 96vw)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-pop)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
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
          <h2
            id="acc-modal-title"
            className="studio-display"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            Acuse {a.acceptance_code}
          </h2>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onClose}
            autoFocus
          >
            Cerrar
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {anyStale ? (
            <Badge tone="warning" size="sm" dot>
              Versión no vigente
            </Badge>
          ) : (
            <Badge tone="success" size="sm" dot>
              En versión vigente
            </Badge>
          )}
        </div>

        <div
          style={{
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-md)",
            padding: "4px 16px 12px",
          }}
        >
          <div
            style={{
              font: "700 9.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "14px 0 4px",
            }}
          >
            Evidencia
          </div>
          <EvidenceRow k="Cliente / Shipping Mark" v={a.client_markbox ?? "—"} />
          <EvidenceRow k="Estimado" v={a.quote_code ?? "—"} />
          {a.docs.length > 0 ? (
            a.docs.map((d, k) => (
              <EvidenceRow
                key={k}
                k={k === 0 ? "Documentos" : ""}
                v={`${shortKey(d.key)} ${d.version}`}
              />
            ))
          ) : (
            <EvidenceRow k="Documentos" v="—" />
          )}
          <EvidenceRow
            k="Medida (CBM / kg / USD)"
            v={`${a.cbm ?? 0} / ${a.weight_kg ?? 0} / ${a.total_usd ?? 0}`}
          />
          <EvidenceRow k="Fecha / hora" v={fmtDateTime(a.accepted_at)} />
          <EvidenceRow k="IP" v={a.ip ?? "—"} />
          <EvidenceRow k="Hash" v={a.hash ?? "—"} />
        </div>
      </div>
    </div>
  );
}
