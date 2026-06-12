"use client";

/**
 * DocumentosHubClient — explorador del Hub de Documentos (SDD-0049 Slice B).
 *
 * Calca el layout del Norte (documentos-hub.jsx): header + 4 KPIs + grid
 * [árbol 264px | explorador 1fr]. El explorador tiene buscador (GET form),
 * chips de vista (por-vencer/pendientes/sin-vincular) y la tabla de docs con
 * deep-link a la transacción + badge de estado derivado.
 *
 * Navegación por URL (?folder= / ?view= / ?q=) → el server re-fetcha. Solo
 * tokens var(--*), cero hex. Primitivas del sistema (KpiCard / Badge).
 */

import { useState } from "react";
import Link from "next/link";
import { useDTDWiring } from "../../../_components/wiring/WiringProvider";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import {
  VersionChip,
  VersionHistoryDrawer,
} from "@/app/studio/_components/documents/DocsPanel";
import {
  DOC_STATUS,
  EXT_META,
  FOLDERS,
  deriveDocStatus,
  extFromMime,
  folderLabel,
  formatDocSize,
  topOf,
  type DocumentRow,
} from "@/lib/studio/documents/types";
import {
  HUB_VIEWS,
  hubDeepLink,
  hubHref,
  folderTreeCount,
  type HubView,
} from "./hub-helpers";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function extOf(doc: DocumentRow): string {
  if (doc.content_type) {
    const e = extFromMime(doc.content_type);
    if (e !== "bin") return e;
  }
  const m = /\.([a-z0-9]+)$/i.exec(doc.storage_path);
  return m ? m[1].toLowerCase() : "bin";
}

export function DocumentosHubClient({
  rows,
  counts,
  folder,
  view,
  q,
  today,
  kpis,
}: {
  rows: DocumentRow[];
  counts: Record<string, number>;
  folder: string;
  view: HubView;
  q: string;
  today: string;
  kpis: { total: number; expiring: number; pending: number; unlinked: number };
}) {
  const { openGenerateBLModal } = useDTDWiring();
  const activeTop = topOf(folder)?.id;
  const [historyFor, setHistoryFor] = useState<DocumentRow | null>(null);

  const heading =
    view === "por-vencer"
      ? "Por vencer / vencidos"
      : view === "pendientes"
        ? "Pendientes"
        : view === "sin-vincular"
          ? "Sin vincular a transacción"
          : folder === "all"
            ? "Todos los documentos"
            : folderLabel(folder);

  return (
    <div style={{ maxWidth: 1200 }}>
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
          <span className="studio-eyebrow">Hub central · Adjuntos</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Documentos
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "76ch",
            }}
          >
            Todos los adjuntos del negocio en un lugar, clasificados por carpeta
            y vinculados a su transacción. Operacionales, logísticos, contables y
            aduaneros.
          </p>
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={openGenerateBLModal}
        >
          Generar BL
        </button>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <KpiCard
          value={kpis.total}
          label="Documentos"
          sub={`${FOLDERS.length} carpetas`}
        />
        <KpiCard
          value={kpis.pending}
          label="Pendientes de firma"
          sub="requieren acción"
          valueColor={kpis.pending ? "var(--warning)" : "var(--ink)"}
        />
        <KpiCard
          value={kpis.expiring}
          label="Por vencer / vencidos"
          sub="permisos & certificados"
          valueColor={kpis.expiring ? "var(--danger)" : "var(--ink)"}
        />
        <KpiCard
          value={kpis.unlinked}
          label="Sin transacción"
          sub="clasificar / vincular"
          valueColor={kpis.unlinked ? "var(--info)" : "var(--ink)"}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "264px 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Árbol de carpetas */}
        <nav
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <Link
            href={hubHref({})}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              background:
                folder === "all" && view === "all"
                  ? "var(--wine-tint)"
                  : "transparent",
              borderBottom: "1px solid var(--border)",
              font: `${folder === "all" ? "700" : "600"} 13px/1 var(--f-sans)`,
              color: folder === "all" ? "var(--wine)" : "var(--ink)",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                color: folder === "all" ? "var(--wine)" : "var(--ink-soft)",
                display: "inline-flex",
              }}
            >
              {Icon.doc(16)}
            </span>
            <span style={{ flex: 1 }}>Todos los documentos</span>
            <span
              style={{
                font: "700 11px/1 var(--f-mono)",
                color: "var(--ink-mute)",
              }}
            >
              {folderTreeCount(counts, "all")}
            </span>
          </Link>

          <div style={{ padding: 6 }}>
            {FOLDERS.map((g) => {
              const topActive = activeTop === g.id;
              return (
                <div key={g.id} style={{ marginBottom: 2 }}>
                  <Link
                    href={hubHref({ folder: g.id })}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "8px 10px",
                      borderRadius: "var(--r-md)",
                      background:
                        folder === g.id ? "var(--bg-elevated)" : "transparent",
                      textDecoration: "none",
                      font: "700 12.5px/1 var(--f-sans)",
                      color: "var(--ink)",
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "var(--r-sm)",
                        background: `var(--${g.tone}-bg)`,
                        color: `var(--${g.tone})`,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {Icon.doc(13)}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {g.label}
                    </span>
                    <span
                      style={{
                        font: "700 10.5px/1 var(--f-mono)",
                        color: topActive ? "var(--wine)" : "var(--ink-mute)",
                      }}
                    >
                      {folderTreeCount(counts, g.id)}
                    </span>
                  </Link>
                  {g.children.map((c) => {
                    const active = folder === c.id;
                    return (
                      <Link
                        key={c.id}
                        href={hubHref({ folder: c.id })}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 10px 6px 30px",
                          borderRadius: "var(--r-md)",
                          background: active ? "var(--wine-tint)" : "transparent",
                          textDecoration: "none",
                          font: `${active ? "700" : "500"} 12px/1.2 var(--f-sans)`,
                          color: active ? "var(--wine)" : "var(--ink-soft)",
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.label}
                        </span>
                        <span
                          style={{
                            font: "600 10px/1 var(--f-mono)",
                            color: "var(--ink-mute)",
                          }}
                        >
                          {folderTreeCount(counts, c.id)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Explorador */}
        <div>
          {/* Buscador (GET form → ?q=) */}
          <form
            method="get"
            action="/studio/documentos"
            style={{ display: "flex", gap: 8, marginBottom: 12 }}
          >
            {folder !== "all" && (
              <input type="hidden" name="folder" value={folder} />
            )}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre o tipo…"
              className="studio-input"
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              className="studio-btn studio-btn-ghost studio-btn-sm"
            >
              Buscar
            </button>
          </form>

          {/* Chips de vista */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            {HUB_VIEWS.map((v) => {
              const active = view === v.id;
              return (
                <Link
                  key={v.id}
                  href={hubHref({ view: v.id })}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: "var(--r-pill, 999px)",
                    border: "1px solid var(--border)",
                    background: active ? "var(--wine-tint)" : "var(--bg-surface)",
                    color: active ? "var(--wine)" : "var(--ink-soft)",
                    textDecoration: "none",
                    font: `${active ? "700" : "600"} 11.5px/1 var(--f-sans)`,
                  }}
                >
                  {v.label}
                </Link>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                font: "800 14px/1 var(--f-display)",
                color: "var(--ink)",
              }}
            >
              {heading}
              <span
                style={{
                  font: "600 12px/1 var(--f-mono)",
                  color: "var(--ink-mute)",
                  marginLeft: 8,
                }}
              >
                {rows.length}
              </span>
            </div>
          </div>

          {/* Tabla */}
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
                gridTemplateColumns: "1fr 140px 110px 80px 100px 88px",
                gap: 14,
                padding: "10px 18px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                font: "700 10.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              <span>Documento</span>
              <span>Transacción</span>
              <span>Fecha</span>
              <span style={{ textAlign: "right" }}>Tamaño</span>
              <span style={{ textAlign: "right" }}>Estado</span>
              <span style={{ textAlign: "right" }}>Versiones</span>
            </div>

            {rows.map((d, i) => {
              const ext = extOf(d);
              const extMeta = EXT_META[ext] ?? {
                tone: "neutral" as const,
                label: ext.toUpperCase(),
              };
              const display = deriveDocStatus(d, today);
              const st = DOC_STATUS[display];
              const link = hubDeepLink(d.entity_type);
              return (
                <div
                  key={d.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 140px 110px 80px 100px 88px",
                    gap: 14,
                    alignItems: "center",
                    padding: "11px 18px",
                    borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      minWidth: 0,
                    }}
                  >
                    <Badge tone={extMeta.tone} size="sm">
                      {extMeta.label}
                    </Badge>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            font: "600 12.5px/1.3 var(--f-sans)",
                            color: "var(--ink)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {d.name}
                        </span>
                        <VersionChip n={d.version_no} />
                      </div>
                      <div
                        style={{
                          font: "500 10.5px/1.3 var(--f-sans)",
                          color: "var(--ink-mute)",
                          marginTop: 2,
                        }}
                      >
                        {d.doc_type ? `${d.doc_type} · ` : ""}
                        {folderLabel(d.folder)}
                      </div>
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {link ? (
                      <Link
                        href={link.href}
                        title={`Ir a ${link.label}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          textDecoration: "none",
                          color: "var(--wine)",
                          font: "600 11px/1.2 var(--f-sans)",
                        }}
                      >
                        <span style={{ display: "inline-flex" }}>
                          {Icon.link(13)}
                        </span>
                        {link.label}
                      </Link>
                    ) : (
                      <Badge tone="neutral" size="sm">
                        sin vínculo
                      </Badge>
                    )}
                  </div>
                  <div
                    style={{
                      font: "500 11px/1 var(--f-mono)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    {formatDate(d.created_at)}
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      font: "500 11px/1 var(--f-mono)",
                      color: "var(--ink-mute)",
                    }}
                  >
                    {formatDocSize(d.size_bytes)}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Badge tone={st.tone} size="sm" dot>
                      {st.label}
                    </Badge>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      onClick={() => setHistoryFor(d)}
                      title="Versiones de este documento"
                    >
                      Historial
                    </button>
                  </div>
                </div>
              );
            })}

            {rows.length === 0 && (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  font: "500 13px/1.5 var(--f-sans)",
                  color: "var(--ink-mute)",
                }}
              >
                {q
                  ? `Sin resultados para “${q}”.`
                  : "Sin documentos en esta vista. Sube adjuntos desde el detalle de un envío o cliente — se clasifican solos acá."}
              </div>
            )}
          </div>
        </div>
      </div>

      {historyFor && (
        <VersionHistoryDrawer
          rootId={historyFor.root_id}
          docName={historyFor.name}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}
