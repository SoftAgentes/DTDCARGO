"use client";

/**
 * Orquestador client del módulo Estimados (ex-Cotizador · SDD-0011, renombrado en SDD-0061).
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import {
  QUOTE_STATUS_OPTIONS,
  isExpired,
  isUnlinkedWebEstimate,
  quoteDeleteBlockReason,
  statusBadgeTone,
  statusLabel,
  type Quote,
} from "@/lib/studio/quote-types";
import { SERVICE_LABELS } from "@/lib/studio/shipment-types";
import type { QuoteFilters } from "@/lib/studio/quote-queries";
import { ActionMenu } from "@/app/studio/_components/ui/ActionMenu";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";
import { softDeleteQuote } from "../actions";
import { QuoteDrawer } from "./QuoteDrawer";

/**
 * SDD-0300 · Las columnas y el hueco del menú se declaran UNA vez porque ahora
 * la cabecera y la fila tienen que reservar EL MISMO espacio a la derecha. Si
 * se desincronizan, las columnas elásticas (`fr`) se corren y la tabla queda
 * desalineada sin que nada falle ni avise.
 */
const QUOTE_GRID = "130px 1.4fr 140px 1.2fr 80px 110px 110px 110px";
const QUOTE_ACTIONS_PAD = 46;

export function CotizadorClient({
  quotes,
  filters,
}: {
  quotes: Quote[];
  filters: QuoteFilters;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const toast = useToast();
  /** SDD-0300 · el estimado que el usuario pidió eliminar (null = sin diálogo). */
  const [porEliminar, setPorEliminar] = useState<Quote | null>(null);
  const [borrando, startBorrado] = useTransition();

  const hasFilters =
    !!filters.q ||
    filters.status !== "all" ||
    (!!filters.source && filters.source !== "all");

  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const paramsKey = params.toString();
  const [filtersKey, setFiltersKey] = useState(paramsKey);
  if (filtersKey !== paramsKey) {
    setFiltersKey(paramsKey);
    setQ(params.get("q") ?? "");
    setStatus(params.get("status") ?? "");
  }
  const source = params.get("source") ?? "";

  const pushFilters = (next: { q?: string; status?: string; source?: string }) => {
    const s = new URLSearchParams();
    if (next.q && next.q.trim()) s.set("q", next.q.trim());
    if (next.status) s.set("status", next.status);
    if (next.source) s.set("source", next.source);
    const qs = s.toString();
    startTransition(() => {
      router.push(qs ? `/studio/cotizador?${qs}` : "/studio/cotizador");
    });
  };
  const pushFiltersEvent = useEffectEvent(pushFilters);
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => pushFiltersEvent({ q, status, source }), 350);
    return () => clearTimeout(t);
  }, [params, q, source, status]);

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
            style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
          >
            Estimados.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "62ch",
            }}
          >
            Total en vivo con tarifa del catálogo. Aceptada → convierte
            automáticamente a embarque del Tracking.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {/* SDD-0281 · el export ES la vista: viaja con la query string tal
              cual, así que el CSV trae lo que la tabla está mostrando (estado,
              búsqueda y origen incluidos), no la tabla entera. */}
          <a
            href={`/api/studio/comercial/export?tipo=estimados${paramsKey ? `&${paramsKey}` : ""}`}
            className="studio-btn studio-btn-ghost"
            title="Descarga en CSV lo que muestra esta vista"
          >
            Exportar
          </a>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => setShowCreate(true)}
          >
            + Nuevo estimado
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          marginBottom: 16,
          flexWrap: "wrap",
          opacity: isPending ? 0.6 : 1,
          transition: "opacity var(--dur-fast) var(--ease)",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <label className="studio-label" htmlFor="quote-q">
            Buscar
          </label>
          <input
            id="quote-q"
            type="search"
            className="studio-input"
            placeholder="Código, cliente, Shipping Mark, ruta…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 200px" }}>
          <label className="studio-label" htmlFor="quote-status">
            Estado
          </label>
          <select
            id="quote-status"
            className="studio-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              pushFilters({ q, status: e.target.value });
            }}
          >
            <option value="">Todos</option>
            {QUOTE_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {/* SDD-0061: cola de estimados web sin vincular ("web · por revisar"). */}
        <button
          type="button"
          className={`studio-btn studio-btn-sm ${
            source === "web_review" ? "studio-btn-warning" : "studio-btn-ghost"
          }`}
          style={{ height: 38 }}
          aria-pressed={source === "web_review"}
          onClick={() =>
            pushFilters({
              q,
              status,
              source: source === "web_review" ? "" : "web_review",
            })
          }
          title="Estimados capturados de la web que todavía no se vincularon a un cliente"
        >
          Web · por revisar
        </button>
        {(q || status || source) && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ height: 38 }}
            onClick={() => {
              setQ("");
              setStatus("");
              pushFilters({});
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          eyebrow={hasFilters ? "Sin resultados" : "Catálogo vacío"}
          title={
            hasFilters
              ? "Ningún estimado coincide con estos filtros."
              : "Aún no hay estimados."
          }
          description={
            hasFilters
              ? "Prueba ajustar los filtros o limpia la búsqueda."
              : "Crea tu primer estimado. El total se calcula en vivo con la tarifa del catálogo."
          }
          action={
            !hasFilters ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                onClick={() => setShowCreate(true)}
              >
                + Nuevo estimado
              </button>
            ) : null
          }
        />
      ) : (
        <QuotesTable quotes={quotes} onEliminar={setPorEliminar} />
      )}

      {showCreate && (
        <QuoteDrawer mode="create" onClose={() => setShowCreate(false)} />
      )}

      {/* SDD-0300 · Confirmación del borrado. El mensaje nombra el estimado y
          dice la consecuencia REAL: la policy RLS de `quotes` filtra por
          `deleted_at is null`, así que lo borrado desaparece también del portal
          del cliente y sólo vuelve desde la base de datos.

          ⚠️ El error NO se muestra dentro del diálogo, se cierra y va por toast.
          `ConfirmDialog` baja su candado anti-doble-envío en un efecto que
          depende de `[error]`: si el consumidor emite DOS VECES el mismo texto,
          React no re-renderiza, el efecto no corre y el botón confirmar queda
          muerto sin señal (la clase de bug de SDD-0273). Acá el mismo texto se
          repite fácil — "ya se convirtió en un embarque" es constante. */}
      <ConfirmDialog
        open={porEliminar !== null}
        danger
        title="Eliminar estimado"
        message={
          porEliminar
            ? `${porEliminar.quote_code} — ${
                porEliminar.client_name ||
                porEliminar.prospect_name ||
                "sin cliente"
              }. Dejará de verse en el Studio y en el portal del cliente; recuperarlo exige entrar a la base de datos.`
            : ""
        }
        confirmLabel="Eliminar"
        pending={borrando}
        onCancel={() => setPorEliminar(null)}
        onConfirm={() => {
          const quote = porEliminar;
          if (!quote) return;
          startBorrado(async () => {
            const result = await softDeleteQuote(quote.id);
            setPorEliminar(null);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success(`Estimado ${quote.quote_code} eliminado`);
            router.refresh();
          });
        }}
      />
    </div>
  );
}

function QuotesTable({
  quotes,
  onEliminar,
}: {
  quotes: Quote[];
  /** SDD-0300 · abre la confirmación; el borrado lo dispara el padre. */
  onEliminar: (quote: Quote) => void;
}) {
  // Trazabilidad visual · highlight de la row recién creada o mutada
  // (lee ?highlight=Q-2026-XXXX&hl-tone=warm|success del URL, hace scroll
  // condicional y aplica .studio-row-flash-warm/-success). Ver
  // app/studio/CLAUDE.md sección "Trazabilidad visual".
  const flashClassFor = useRowHighlight();
  return (
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
          gridTemplateColumns: QUOTE_GRID,
          gap: 12,
          padding: `var(--s-3) ${QUOTE_ACTIONS_PAD}px var(--s-3) var(--s-5)`,
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          font: "700 10px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
        }}
      >
        <span>Código</span>
        <span>Cliente</span>
        <span>Servicio</span>
        <span>Ruta</span>
        <span style={{ textAlign: "right" }}>CBM</span>
        <span style={{ textAlign: "right" }}>Total</span>
        <span>Estado</span>
        <span>Vigencia</span>
      </div>

      {quotes.map((quote, i) => {
        const expired = isExpired(quote);
        const displayStatus = expired ? "expired" : quote.status;
        // SDD-0300 · motivo por el que este estimado NO se puede borrar, o null.
        const bloqueoBorrado = quoteDeleteBlockReason(quote);
        return (
          /* El menú va FUERA del <Link> (un botón dentro de un enlace no es
             HTML válido y el clic se pelearía con la navegación), pero encima
             de la fila: envoltorio en `position:relative` y menú absoluto en el
             hueco que la cabecera y la fila reservan a la derecha. */
          <div
            key={quote.id}
            style={{
              position: "relative",
              borderTop: i > 0 ? "1px solid var(--border)" : 0,
            }}
          >
            <Link
              href={`/studio/cotizador/${quote.quote_code}`}
              data-row-id={quote.quote_code}
              className={`studio-tracking-row ${flashClassFor(quote.quote_code)}`.trim()}
              style={{
                display: "grid",
                gridTemplateColumns: QUOTE_GRID,
                gap: 12,
                padding: `14px ${QUOTE_ACTIONS_PAD}px 14px 20px`,
                alignItems: "center",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span
                style={{
                  font: "700 12px/1 var(--f-mono)",
                  color: "var(--ink)",
                  letterSpacing: "0.02em",
                }}
              >
                {quote.quote_code}
              </span>
              <div
                style={{
                  font: "500 12px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                }}
              >
                <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {quote.client_name || quote.prospect_name || "—"}
                </div>
                {isUnlinkedWebEstimate(quote) ? (
                  <div style={{ marginTop: 4 }}>
                    <Badge tone="warning" size="sm" dot>
                      Web · sin vincular
                    </Badge>
                  </div>
                ) : (
                  <div
                    style={{
                      font: "600 11px/1 var(--f-mono)",
                      color: "var(--wine-text)",
                      marginTop: 3,
                    }}
                  >
                    {quote.client_markbox}
                  </div>
                )}
              </div>
              <span
                style={{
                  font: "600 11.5px/1 var(--f-sans)",
                  color: "var(--ink)",
                }}
              >
                {SERVICE_LABELS[quote.service].primary}
              </span>
              <span
                style={{
                  font: "500 12px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {quote.origin} → {quote.destination}
              </span>
              <span
                style={{
                  font: "600 12px/1 var(--f-mono)",
                  color: "var(--ink)",
                  textAlign: "right",
                }}
              >
                {quote.cbm != null ? quote.cbm.toFixed(2) : "—"}
              </span>
              <span
                style={{
                  font: "800 13px/1 var(--f-mono)",
                  color: "var(--wine-text)",
                  textAlign: "right",
                }}
              >
                ${Number(quote.total_usd).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span>
                <Badge
                  tone={statusBadgeTone(displayStatus as Quote["status"])}
                  size="sm"
                  dot
                >
                  {statusLabel(displayStatus as Quote["status"])}
                </Badge>
              </span>
              <span
                style={{
                  font: "500 11px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                {quote.valid_until}
              </span>
            </Link>
            <div
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              <ActionMenu
                size="sm"
                ariaLabel={`Acciones de ${quote.quote_code}`}
                items={[
                  {
                    key: "ver",
                    label: "Ver detalle",
                    icon: "eye",
                    href: `/studio/cotizador/${quote.quote_code}`,
                  },
                  { key: "sep", separator: true },
                  {
                    key: "eliminar",
                    label: "Eliminar",
                    icon: "trash",
                    role: "destructive",
                    disabled: bloqueoBorrado !== null,
                    // BTN-01 §6: una opción deshabilitada dice qué falta.
                    disabledReason: bloqueoBorrado
                      ? `No se puede eliminar: ${bloqueoBorrado}.`
                      : undefined,
                    onSelect: () => onEliminar(quote),
                  },
                ]}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
