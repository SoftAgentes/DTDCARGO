"use client";

/**
 * SDD-0157 — Pestaña "Recuperación": la base warm de Kommo (contactos con
 * teléfono, deduplicados) cruzada contra los clientes del ERP, lista para
 * tocarla por WhatsApp en tandas manuales (máx 10, links wa.me con guion
 * prellenado) o exportarla a CSV para SMS. READ-ONLY: el registro del toque se
 * hace en Kommo (nota/tarea del asesor).
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState, useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { downloadTextFile } from "@/app/studio/_components/ui/download";
import {
  buildRecoveryWaLink,
  RECOVERY_TEMPLATES,
  RECOVERY_WA_BATCH_MAX,
  type RecoveryFilters,
  type RecoveryRow,
  type RecoverySegment,
} from "@/lib/studio/crm-recovery";
import { exportRecoverySmsCsvAction } from "../actions";

const GRID = "36px 1.7fr 1fr 64px 56px 140px";
const AGE_OPTIONS = [30, 90, 180, 365] as const;

export type RecoveryCounts = {
  total: number;
  clientes: number;
  interesados: number;
  noPhone: number;
  noPhoneWithEmail: number;
  deduped: number;
  fetched: number;
  cap: number;
};

function ageTone(days: number | null): string {
  if (days == null) return "var(--ink-mute)";
  if (days >= 180) return "var(--danger)";
  if (days >= 30) return "var(--warning)";
  return "var(--ink-soft)";
}

export function RecoveryTab({
  rows,
  counts,
  filters,
  totalFiltered,
  listCap,
}: {
  rows: RecoveryRow[];
  counts: RecoveryCounts;
  filters: RecoveryFilters;
  totalFiltered: number;
  listCap: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // ── Filtros → URL (rseg/raged/rq/rsort, siempre con tab=recuperacion) ──
  const [q, setQ] = useState(filters.q ?? "");
  const [querySource, setQuerySource] = useState(filters.q);
  if (querySource !== filters.q) {
    setQuerySource(filters.q);
    setQ(filters.q ?? "");
  }

  const pushFilters = (next: Partial<Record<"rseg" | "raged" | "rq" | "rsort", string>>) => {
    const cur = {
      rseg: params.get("rseg") ?? "",
      raged: params.get("raged") ?? "",
      rq: params.get("rq") ?? "",
      rsort: params.get("rsort") ?? "",
      ...next,
    };
    const s = new URLSearchParams();
    s.set("tab", "recuperacion");
    if (cur.rseg) s.set("rseg", cur.rseg);
    if (cur.raged) s.set("raged", cur.raged);
    if (cur.rq.trim()) s.set("rq", cur.rq.trim());
    if (cur.rsort) s.set("rsort", cur.rsort);
    startTransition(() => router.push(`/studio/crm?${s.toString()}`));
  };
  const pushFiltersEvent = useEffectEvent(pushFilters);
  useEffect(() => {
    if (q === (params.get("rq") ?? "")) return;
    const t = setTimeout(() => pushFiltersEvent({ rq: q }), 350);
    return () => clearTimeout(t);
  }, [params, q]);

  const hasFilters =
    Boolean(filters.segment) || Boolean(filters.agedDays) || Boolean(filters.q);

  // ── Guiones editables por segmento (el link usa el del segmento de la fila) ──
  const [templates, setTemplates] = useState<Record<RecoverySegment, string>>({
    cliente: RECOVERY_TEMPLATES.cliente,
    interesado: RECOVERY_TEMPLATES.interesado,
  });

  // ── Selección de tanda (máx 10) + panel de links ──
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batch, setBatch] = useState<
    { contactId: number; name: string; phone: string; link: string }[] | null
  >(null);
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < RECOVERY_WA_BATCH_MAX) next.add(id);
      return next;
    });
  };

  const buildBatch = () => {
    const items: { contactId: number; name: string; phone: string; link: string }[] = [];
    for (const r of rows) {
      if (!selected.has(r.contactId)) continue;
      const link = buildRecoveryWaLink(r, templates[r.segment]);
      if (link) items.push({ contactId: r.contactId, name: r.name, phone: r.phone, link });
    }
    setBatch(items);
  };

  const copyBatch = async () => {
    if (!batch) return;
    const text = batch.map((b) => `${b.name} — ${b.phone}\n${b.link}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success(`Lista de ${batch.length} contactos copiada`);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await exportRecoverySmsCsvAction({
        rseg: params.get("rseg") ?? undefined,
        raged: params.get("raged") ?? undefined,
        rq: params.get("rq") ?? undefined,
        rsort: params.get("rsort") ?? undefined,
      });
      if (res.csv != null) {
        downloadTextFile("recuperacion-sms.csv", res.csv);
        toast.success(`CSV con ${res.count} contactos descargado`);
      } else {
        toast.error(res.error ?? "No se pudo generar el CSV.");
      }
    } finally {
      setExporting(false);
    }
  };

  const kpis = useMemo(
    () => [
      { n: counts.total, label: "Con teléfono" },
      { n: counts.clientes, label: "Ya son clientes" },
      { n: counts.interesados, label: "Interesados" },
      { n: counts.noPhone, label: "Sin teléfono", sub: `${counts.noPhoneWithEmail} con email` },
    ],
    [counts],
  );

  return (
    <div>
      {/* Intro + export */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            font: "400 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "68ch",
          }}
        >
          La base warm del CRM: contactos con teléfono (una persona = una
          fila), cruzados con los clientes del ERP. Selecciona hasta{" "}
          {RECOVERY_WA_BATCH_MAX} y genera la tanda de WhatsApp con el guion del
          segmento; el resto sale por CSV para SMS. Registra cada toque en la ficha
          del contacto (nota o tarea) — esta pantalla no escribe nada.
        </p>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={exportCsv}
          disabled={exporting || totalFiltered === 0}
        >
          {exporting ? "Generando…" : `Exportar SMS (CSV · ${totalFiltered})`}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {kpis.map((k) => (
          <div
            key={k.label}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              padding: "var(--s-3) var(--s-4)",
              minWidth: 120,
            }}
          >
            <div style={{ font: "800 20px/1 var(--f-mono)", color: "var(--ink)" }}>
              {k.n.toLocaleString("es-VE")}
            </div>
            <div
              style={{
                font: "600 10.5px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 4,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {k.label}
            </div>
            {"sub" in k && k.sub ? (
              <div style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-mute)", marginTop: 2 }}>
                {k.sub}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 220px", minWidth: 200 }}>
          <label className="studio-label" htmlFor="rec-q">
            Buscar contacto
          </label>
          <input
            id="rec-q"
            type="search"
            className="studio-input"
            placeholder="Nombre, teléfono o Shipping Mark…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 170px" }}>
          <label className="studio-label" htmlFor="rec-seg">
            Segmento
          </label>
          <select
            id="rec-seg"
            className="studio-input"
            value={filters.segment ?? ""}
            onChange={(e) => pushFilters({ rseg: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="cliente">Ya es cliente</option>
            <option value="interesado">Interesado</option>
          </select>
        </div>
        <div style={{ flex: "0 0 150px" }}>
          <label className="studio-label" htmlFor="rec-aged">
            Antigüedad
          </label>
          <select
            id="rec-aged"
            className="studio-input"
            value={filters.agedDays != null ? String(filters.agedDays) : ""}
            onChange={(e) => pushFilters({ raged: e.target.value })}
          >
            <option value="">Cualquiera</option>
            {AGE_OPTIONS.map((d) => (
              <option key={d} value={String(d)}>{`> ${d} días`}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: "0 0 150px" }}>
          <label className="studio-label" htmlFor="rec-sort">
            Orden
          </label>
          <select
            id="rec-sort"
            className="studio-input"
            value={filters.sort ?? "oldest"}
            onChange={(e) => pushFilters({ rsort: e.target.value })}
          >
            <option value="oldest">Más fríos primero</option>
            <option value="recent">Recientes primero</option>
          </select>
        </div>
        {hasFilters && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ height: 38 }}
            onClick={() =>
              startTransition(() => router.push("/studio/crm?tab=recuperacion"))
            }
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Guiones editables */}
      <details
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "var(--s-3) var(--s-4)",
          marginBottom: 14,
        }}
      >
        <summary
          style={{
            font: "700 12px/1 var(--f-sans)",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          Guiones de la tanda (editables · {"{nombre}"} se reemplaza solo)
        </summary>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          {(["cliente", "interesado"] as const).map((seg) => (
            <div key={seg}>
              <label className="studio-label" htmlFor={`rec-tpl-${seg}`}>
                {seg === "cliente" ? "Ya es cliente (recompra)" : "Interesado (reactivación)"}
              </label>
              <textarea
                id={`rec-tpl-${seg}`}
                className="studio-input"
                rows={4}
                style={{ resize: "vertical", font: "400 12.5px/1.45 var(--f-sans)" }}
                value={templates[seg]}
                onChange={(e) =>
                  setTemplates((prev) => ({ ...prev, [seg]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      </details>

      {/* Toolbar de tanda */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-sm"
          disabled={selected.size === 0}
          onClick={buildBatch}
        >
          Generar tanda de WhatsApp ({selected.size}/{RECOVERY_WA_BATCH_MAX})
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={() => {
              setSelected(new Set());
              setBatch(null);
            }}
          >
            Quitar selección
          </button>
        )}
      </div>

      {/* Panel de la tanda */}
      {batch && batch.length > 0 && (
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "var(--s-4)",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ font: "700 12.5px/1 var(--f-sans)", color: "var(--ink)" }}>
              Tanda lista · {batch.length} contactos — abre cada chat y registra el
              toque en la ficha
            </span>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-xs"
              onClick={copyBatch}
            >
              Copiar lista
            </button>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
            {batch.map((b) => (
              <li key={b.contactId} style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                {b.name} · {b.phone}{" "}
                <a
                  href={b.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--wine-text)", fontWeight: 700 }}
                  onClick={() =>
                    setOpened((prev) => new Set(prev).add(b.contactId))
                  }
                >
                  Abrir WhatsApp →
                </a>
                {opened.has(b.contactId) && (
                  <Badge tone="success" size="sm">
                    Abierto
                  </Badge>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Tabla */}
      <div style={{ opacity: isPending ? 0.6 : 1, transition: "opacity var(--dur-fast) var(--ease)" }}>
        {rows.length === 0 ? (
          <EmptyState
            eyebrow={hasFilters ? "Sin resultados" : "Sin contactos"}
            title={
              hasFilters
                ? "Ningún contacto coincide con estos filtros."
                : "No hay contactos con teléfono en el espejo."
            }
            description={
              hasFilters
                ? "Prueba ajustar los filtros o limpia la búsqueda."
                : "Corre la sincronización para poblar el espejo de contactos."
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
            <div style={{ overflowX: "auto" }}>
              <div role="table" aria-label="Contactos de recuperación" style={{ minWidth: 700 }}>
                <div
                  role="row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: GRID,
                    gap: 12,
                    padding: "var(--s-3) var(--s-5)",
                    background: "var(--bg-elevated)",
                    borderBottom: "1px solid var(--border)",
                    font: "700 10px/1 var(--f-sans)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                  }}
                >
                  <span role="columnheader" aria-label="Seleccionar" />
                  <span role="columnheader">Contacto</span>
                  <span role="columnheader">Segmento</span>
                  <span role="columnheader" style={{ textAlign: "right" }}>
                    Días
                  </span>
                  <span role="columnheader" style={{ textAlign: "center" }}>
                    Email
                  </span>
                  <span role="columnheader" style={{ textAlign: "right" }}>
                    Acción
                  </span>
                </div>

                {rows.map((r, i) => {
                  const checked = selected.has(r.contactId);
                  const atCap = !checked && selected.size >= RECOVERY_WA_BATCH_MAX;
                  const quickLink = buildRecoveryWaLink(r, templates[r.segment]);
                  return (
                    <div
                      key={r.contactId}
                      role="row"
                      className="studio-row-hover"
                      style={{
                        display: "grid",
                        gridTemplateColumns: GRID,
                        gap: 12,
                        padding: "var(--s-3) var(--s-5)",
                        borderTop: i > 0 ? "1px solid var(--border)" : 0,
                        alignItems: "center",
                      }}
                    >
                      <span role="cell">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar a ${r.name}`}
                          checked={checked}
                          disabled={atCap}
                          onChange={() => toggle(r.contactId)}
                        />
                      </span>
                      <span role="cell" style={{ minWidth: 0, overflow: "hidden" }}>
                        <span
                          style={{
                            display: "block",
                            font: "600 13px/1.3 var(--f-sans)",
                            color: "var(--ink)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.name}
                        </span>
                        <span
                          style={{
                            display: "block",
                            font: "500 11.5px/1.3 var(--f-mono)",
                            color: "var(--ink-soft)",
                          }}
                        >
                          {r.phone}
                        </span>
                      </span>
                      <span role="cell">
                        {r.segment === "cliente" ? (
                          <Badge tone="success" size="sm">
                            {r.markbox ?? "Cliente"}
                          </Badge>
                        ) : (
                          <Badge tone="info" size="sm">
                            Interesado
                          </Badge>
                        )}
                      </span>
                      <span
                        role="cell"
                        style={{
                          font: "700 12px/1 var(--f-mono)",
                          color: ageTone(r.days),
                          textAlign: "right",
                        }}
                        title={r.days == null ? "Sin fecha" : `${r.days} días sin actividad`}
                      >
                        {r.days == null ? "—" : r.days}
                      </span>
                      <span
                        role="cell"
                        style={{
                          textAlign: "center",
                          font: "600 12px/1 var(--f-sans)",
                          color: r.email ? "var(--success)" : "var(--ink-mute)",
                        }}
                        title={r.email ?? "Sin email"}
                      >
                        {r.email ? "✓" : "—"}
                      </span>
                      <span role="cell" style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        {opened.has(r.contactId) && (
                          <Badge tone="success" size="sm">
                            Abierto
                          </Badge>
                        )}
                        {quickLink ? (
                          <a
                            href={quickLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="studio-btn studio-btn-dark studio-btn-xs"
                            onClick={() =>
                              setOpened((prev) => new Set(prev).add(r.contactId))
                            }
                          >
                            WhatsApp →
                          </a>
                        ) : (
                          <span style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-mute)" }}>
                            Nº no usable
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <p
        style={{
          font: "400 11.5px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: 14,
        }}
      >
        Mostrando {Math.min(rows.length, listCap)} de {totalFiltered} contactos del
        filtro · universo: {counts.total.toLocaleString("es-VE")} con teléfono (
        {counts.deduped} duplicados colapsados
        {counts.fetched >= counts.cap
          ? ` · ⚠️ la query pegó el tope de ${counts.cap.toLocaleString("es-VE")} contactos`
          : ""}
        ) · los {counts.noPhone} sin teléfono no entran a esta campaña (
        {counts.noPhoneWithEmail} tienen email → campaña de correo). Datos
        espejados · solo lectura.
      </p>
    </div>
  );
}
