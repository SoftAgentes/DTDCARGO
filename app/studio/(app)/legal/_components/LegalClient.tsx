"use client";

/**
 * Vistas de la Capa Legal (SDD-0054 · Slice B + SDD-0067), renderizadas INLINE
 * dentro de Administración → INTERMEDIO (parity Norte `admin-legal.jsx`). Antes
 * eran las dos tabs del módulo suelto `/studio/legal`; el Norte las quiere como
 * dos secciones separadas dentro de Administración:
 *
 *   · <LegalDocsRepo>       — sección "Documentación legal": banner del modo del
 *     gate de facturación DDP, buscador de expediente de defensa (SDD-0070),
 *     hero "Repositorio legal", repositorio versionado (header por doc + histórico
 *     con columna "Cambios" + botón Ver), y card "Pendiente de revisión legal"
 *     (placeholders `[…]` del texto vigente que faltan por definir con abogado).
 *
 *   · <LegalAcceptancesLog> — sección "Aceptaciones T&C": KPIs + búsqueda + filtro
 *     + tabla de acuses + modal de evidencia (con export JSON e imprimible).
 *
 * Read-only: NO publica versiones nuevas — la próxima la traen los abogados como
 * migración (`legal_docs`), y el modal del Portal cambia solo (acceptance-copy).
 * Usa primitivas reales del Studio (Badge, EmptyState, KpiCard, Icon, tokens).
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import type {
  LegalAcceptance,
  LegalDoc,
  LegalSection,
} from "@/lib/studio/legal/types";

/** Etiqueta corta de un doc por key (para badges en la bitácora). */
function shortKey(key: string): string {
  if (key === "tyc") return "T&C";
  if (key === "operador") return "Op.";
  return key;
}

/** Formatea una fecha ISO (`YYYY-MM-DD`) en UTC — sin corrimiento por TZ. Una
 *  `date` de Postgres se parsea como medianoche UTC; formatearla en hora local
 *  VE (−4) corría el día (2026-05-01 se veía "30 abr"). Fijar timeZone lo evita. */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
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

/** La EVIDENCIA se muestra en UTC (igual que el expediente imprimible) — una
 *  hora local sin etiqueta al lado del expediente parece inconsistencia
 *  probatoria. La bitácora general sigue en hora local vía fmtDateTime. */
function fmtDateTimeUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} (UTC)`;
}

// ════════════════════════════════════════════════════════════
// Sección "Documentación legal" (repositorio versionado)
// ════════════════════════════════════════════════════════════

export function LegalDocsRepo({
  docs,
  acceptances,
  gateHardBlock,
}: {
  docs: LegalDoc[];
  acceptances: LegalAcceptance[];
  /** Modo del gate AUT-04 (SDD-0067 · `LEGAL_GATE_HARD_BLOCK` de gate-config). */
  gateHardBlock: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <GateBanner gateHardBlock={gateHardBlock} />
      <DefenseFileSearch />
      <DocsView docs={docs} acceptances={acceptances} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Sección "Aceptaciones T&C" (bitácora consultable)
// ════════════════════════════════════════════════════════════

export function LegalAcceptancesLog({
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
  return (
    <AcceptancesView
      acceptances={acceptances}
      docs={docs}
      currentVersions={currentVersions}
      kpis={kpis}
    />
  );
}

// ════════════════════════════════════════════════════════════
// Banner del modo del gate AUT-04 (SDD-0067 · decisión #6)
// ════════════════════════════════════════════════════════════

function GateBanner({ gateHardBlock }: { gateHardBlock: boolean }) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "12px 14px",
        background: gateHardBlock ? "var(--success-bg)" : "var(--warning-bg)",
        borderRadius: "var(--r-md)",
      }}
    >
      <span
        style={{
          color: gateHardBlock ? "var(--success)" : "var(--warning)",
          display: "flex",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {Icon.shield(15)}
      </span>
      <div style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink)" }}>
        <strong>
          Gate de facturación DDP:{" "}
          {gateHardBlock ? "BLOQUEO DURO activo" : "ADVISORY (no bloquea)"}.
        </strong>{" "}
        {gateHardBlock
          ? "Una factura DDP sin aceptación vigente NO se puede emitir (sin override)."
          : "Si un embarque DDP no tiene aceptación vigente, el operador ve el aviso pero puede emitir igual (queda auditado como override). El flip a bloqueo duro es decisión del founder: 1 línea en lib/studio/legal/gate-config.ts."}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Expediente de defensa · acceso por código de envío (SDD-0070)
// ════════════════════════════════════════════════════════════

function DefenseFileSearch() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const go = () => {
    const c = code.trim();
    if (!c) return;
    router.push(`/studio/legal/expediente/${encodeURIComponent(c)}`);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-end",
        flexWrap: "wrap",
        padding: "14px 16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        <label className="studio-label" htmlFor="defense-code">
          Expediente de defensa
        </label>
        <input
          id="defense-code"
          type="text"
          className="studio-input studio-input-mono"
          placeholder="Código de envío (p. ej. S-2026-0042)"
          value={code}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go();
          }}
        />
      </div>
      <button
        type="button"
        className="studio-btn studio-btn-primary studio-btn-sm"
        onClick={go}
        disabled={!code.trim()}
        style={{
          opacity: code.trim() ? 1 : 0.6,
          cursor: code.trim() ? "pointer" : "not-allowed",
        }}
      >
        Abrir expediente
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Repositorio versionado (hero + docs + pendientes)
// ════════════════════════════════════════════════════════════

type DocGroup = {
  key: string;
  name: string;
  audience: string;
  current: LegalDoc | null;
  versions: LegalDoc[];
};

/** Placeholders `[…]` en el cuerpo vigente → pendientes de revisión de abogado. */
type Placeholder = { doc: string; section: string; text: string };

function collectPlaceholders(groups: DocGroup[]): Placeholder[] {
  const out: Placeholder[] = [];
  for (const g of groups) {
    const cur = g.current;
    if (!cur || !Array.isArray(cur.body)) continue;
    for (const [heading, paragraph] of cur.body) {
      const matches = (paragraph ?? "").match(/\[[^\]]+\]/g);
      if (matches) {
        for (const text of matches) out.push({ doc: g.name, section: heading, text });
      }
    }
  }
  return out;
}

/**
 * Card de un documento (familia de versiones): header + histórico. Sirve para
 * el VIGENTE (badge "Vigente" + Ver + Nueva versión) y para los ARCHIVADOS
 * (badge "Archivado", sin botón de publicar). El histórico es idéntico.
 */
function DocCard({
  doc,
  countFor,
  onView,
}: {
  doc: DocGroup;
  countFor: (key: string, version: string) => number;
  onView: (d: LegalDoc) => void;
}) {
  const cur = doc.current;
  const latest = cur ?? doc.versions[0] ?? null;
  const viewable =
    latest && Array.isArray(latest.body) && latest.body.length > 0
      ? latest
      : null;

  return (
    <div
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
                Archivado
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
            {cur
              ? `Audiencia: ${doc.audience} · en vigor desde ${fmtDate(cur.effective_date)} · ${cur.sections} secciones · ${countFor(doc.key, cur.version)} aceptaciones`
              : `Audiencia: ${doc.audience} · reemplazado por el documento vigente · última versión ${latest?.version ?? "—"}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {viewable && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={() => onView(viewable)}
            >
              <span style={{ display: "inline-flex", marginRight: 4 }}>
                {Icon.eye(13)}
              </span>
              Ver
            </button>
          )}
          {/* Publicar versiones desde la UI no existe (read-only): la próxima
              versión la traen los abogados como migración. Solo en el vigente. */}
          {cur && (
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-sm"
              disabled
              title="La próxima versión la publican los abogados como actualización del repositorio."
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            >
              <span style={{ display: "inline-flex", marginRight: 4 }}>
                {Icon.plus(13)}
              </span>
              Nueva versión
            </button>
          )}
        </div>
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
          <span>Cambios</span>
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
                color: v.status === "vigente" ? "var(--wine)" : "var(--ink)",
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
              {v.change_note ?? `${v.sections} secciones`}
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
}

function DocsView({
  docs,
  acceptances,
}: {
  docs: LegalDoc[];
  acceptances: LegalAcceptance[];
}) {
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

  // Aceptaciones por (key, version) — para el contador del subtítulo (Norte).
  const countFor = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of acceptances) {
      for (const d of a.docs) m.set(`${d.key}@${d.version}`, (m.get(`${d.key}@${d.version}`) ?? 0) + 1);
    }
    return (key: string, version: string) => m.get(`${key}@${version}`) ?? 0;
  }, [acceptances]);

  const placeholders = useMemo(() => collectPlaceholders(groups), [groups]);

  // Separar lo que el cliente FIRMA hoy (con versión vigente) del historial:
  // familias sin vigente = documentos reemplazados → sección plegada aparte.
  const vigentes = useMemo(() => groups.filter((g) => g.current), [groups]);
  const archivados = useMemo(() => groups.filter((g) => !g.current), [groups]);

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
      {/* Hero · Repositorio legal. Fondo navy estable en ambos temas
          (--bg-sidebar no invierte); texto con tokens de sidebar (siempre
          claros sobre navy). Único gradiente de marca permitido. */}
      <div
        style={{
          background:
            "linear-gradient(135deg, var(--bg-sidebar) 0%, #1F3055 100%)",
          borderRadius: "var(--r-lg)",
          padding: 20,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: "var(--r-md)",
            background: "var(--wine)",
            color: "var(--wine-soft)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {Icon.doc(22)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "700 10.5px/1 var(--f-sans)",
              color: "var(--wine-soft)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Repositorio legal
          </div>
          <div
            style={{
              font: "800 18px/1.1 var(--f-display)",
              color: "var(--ink-side)",
              marginTop: 6,
            }}
          >
            Documentos versionados
          </div>
          <div
            style={{
              marginTop: 8,
              font: "500 12px/1.5 var(--f-sans)",
              color: "var(--ink-side-soft)",
              maxWidth: "60ch",
            }}
          >
            Cada documento tiene una versión vigente con fecha de entrada en
            vigor. El cliente acepta siempre la{" "}
            <b style={{ color: "var(--ink-side)" }}>versión vigente</b>, y cada
            aceptación queda atada a esa versión en el registro.
          </div>
        </div>
      </div>

      {/* Documento(s) VIGENTE(s) = lo que el cliente firma hoy. */}
      {vigentes.map((doc) => (
        <DocCard
          key={doc.key}
          doc={doc}
          countFor={countFor}
          onView={setViewing}
        />
      ))}

      {/* Pendiente de revisión legal · placeholders [...] del texto vigente. */}
      {placeholders.length > 0 && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderLeft: "3px solid var(--warning)",
            borderRadius: "var(--r-lg)",
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span style={{ color: "var(--warning)", display: "flex" }}>
              {Icon.warn(17)}
            </span>
            <div
              style={{
                font: "800 14px/1.2 var(--f-display)",
                color: "var(--ink)",
                flex: 1,
              }}
            >
              Pendiente de revisión legal
            </div>
            <Badge tone="warning" size="sm">
              {placeholders.length}
            </Badge>
          </div>
          <div
            style={{
              font: "500 12px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              marginBottom: 12,
            }}
          >
            Campos sin definir en el texto vigente. Requieren validación de un
            abogado antes de publicar la versión final.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {placeholders.map((p, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  background: "var(--warning-bg)",
                  borderRadius: "var(--r-sm)",
                }}
              >
                <div
                  style={{
                    font: "600 11px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {p.doc} · {p.section}
                </div>
                <code
                  style={{
                    font: "600 12px/1.4 var(--f-mono)",
                    color: "var(--ink)",
                    wordBreak: "break-word",
                  }}
                >
                  {p.text}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Versiones anteriores · familias sin vigente (reemplazadas por el
          documento vigente). Plegadas para no competir con lo que se firma hoy. */}
      {archivados.length > 0 && (
        <details
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              userSelect: "none",
            }}
          >
            <span
              style={{
                font: "700 13px/1.2 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              Versiones anteriores
            </span>
            <Badge tone="neutral" size="sm">
              {archivados.length}
            </Badge>
            <span
              style={{
                marginLeft: "auto",
                font: "500 11.5px/1.3 var(--f-sans)",
                color: "var(--ink-mute)",
              }}
            >
              Documentos reemplazados por el vigente — el cliente ya no los firma
            </span>
          </summary>
          <div
            style={{
              padding: "0 16px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {archivados.map((doc) => (
              <DocCard
                key={doc.key}
                doc={doc}
                countFor={countFor}
                onView={setViewing}
              />
            ))}
          </div>
        </details>
      )}

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

      {viewing && <DocModal doc={viewing} onClose={() => setViewing(null)} />}
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
// Aceptaciones · bitácora consultable
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
          const hay = [a.acceptance_code, a.client_markbox, a.quote_code, a.ip]
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
          eyebrow={
            acceptances.length === 0 ? "Sin aceptaciones" : "Sin resultados"
          }
          title={
            acceptances.length === 0
              ? "Todavía no hay aceptaciones registradas."
              : "Ninguna aceptación coincide con el filtro."
          }
          description={
            acceptances.length === 0
              ? "Cuando un cliente acepte los T&C de un estimado, el acuse aparecerá acá (inmutable y auditado)."
              : "Prueba ajustar la búsqueda o el filtro de documento."
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
              className="studio-tracking-row studio-row-btn"
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
          <EvidenceRow k="Fecha / hora" v={fmtDateTimeUtc(a.accepted_at)} />
          <EvidenceRow k="IP" v={a.ip ?? "—"} />
          {/* v2 (SDD-0067): user agent + declaración de comerciante (ambos
              dentro del hash) + atadura forense a la factura (metadato). */}
          <EvidenceRow k="User agent" v={a.user_agent ?? "—"} />
          <EvidenceRow
            k="Declaración de comerciante"
            v={a.merchant_declaration ? "Sí (cláusula 1.4)" : "No"}
          />
          <EvidenceRow k="Factura asociada" v={a.invoice_id ?? "—"} />
          <EvidenceRow k="Hash" v={a.hash ?? "—"} />
        </div>

        {/* Export del expediente (SDD-0067): JSON para el abogado + vista
            imprimible ("PDF" = imprimir del navegador). Ambos admin-only. */}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <a
            className="studio-btn studio-btn-ghost studio-btn-sm"
            href={`/api/studio/legal/evidence/${encodeURIComponent(a.acceptance_code)}`}
            download
          >
            <span style={{ display: "inline-flex", marginRight: 4 }}>
              {Icon.download(13)}
            </span>
            Descargar JSON
          </a>
          <a
            className="studio-btn studio-btn-primary studio-btn-sm"
            href={`/studio/legal/evidencia/${encodeURIComponent(a.acceptance_code)}`}
            target="_blank"
            rel="noopener"
          >
            <span style={{ display: "inline-flex", marginRight: 4 }}>
              {Icon.doc(13)}
            </span>
            Imprimir expediente
          </a>
        </div>
      </div>
    </div>
  );
}
