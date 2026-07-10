/**
 * Tablero kanban del CRM Kommo (SDD-0078 · vista Tablero).
 *
 * Server component READ-ONLY: replica el LAYOUT del embudo de Kommo (columnas =
 * etapas en orden, tarjetas = leads) para que el founder/asesor lea el pipeline
 * de un vistazo. NO muta nada (ni Kommo ni el espejo). La conversión a cliente
 * vive en la pestaña Asesor (worklist accionable).
 *
 * Marca: el chrome es 100% tokens del Studio (`var(--*)`); lo único que usa el
 * color crudo de Kommo es el ACENTO de la etapa (borde superior + punto), y es
 * DATA real del tenant (no un hex inventado) → sanitizado a #hex. Regla
 * "marca sobre cara": no clonamos el chrome de Kommo, solo el layout.
 *
 * Embudos gigantes: se traen hasta `cap` leads y se muestran las primeras
 * `CARDS_PER_COLUMN` por columna; el resto se cuenta pero no se pinta (aviso
 * "+N más"). Conteo y Σ por columna son sobre lo traído (acotado por `cap`).
 */

import Link from "next/link";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type { KommoLeadRow, KommoPipelineRow, KommoStatusRow } from "@/lib/studio/kommo-types";

const DAY_MS = 86_400_000;
const CARDS_PER_COLUMN = 40;
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

/** Solo dejamos pasar un #hex válido (data de Kommo); si no, sin acento. */
function accentColor(raw: string | null): string {
  return raw && HEX_RE.test(raw) ? raw : "var(--border)";
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

function ageTone(days: number | null): string {
  if (days == null) return "var(--ink-mute)";
  if (days >= 180) return "var(--danger)";
  if (days >= 30) return "var(--warning)";
  return "var(--ink-soft)";
}

export function KommoBoardView({
  pipelines,
  statuses,
  leads,
  realCountByStatus,
  pipelineId,
  subdomain,
  convertedMarkboxByLead,
  valueByLead,
  ownerName,
  boardCap,
}: {
  pipelines: KommoPipelineRow[];
  /** Todas las etapas; se filtran al embudo activo acá. */
  statuses: KommoStatusRow[];
  /** Leads del embudo activo (ya acotados por `boardCap` en la query). */
  leads: KommoLeadRow[];
  /** Conteo REAL de leads por etapa (sin cap) → el header nunca miente. */
  realCountByStatus: Record<number, number>;
  pipelineId: number | null;
  subdomain: string | null;
  convertedMarkboxByLead: Record<number, string>;
  valueByLead: Record<number, number>;
  ownerName: Record<number, string>;
  /** Tope de leads traídos por embudo (para el aviso de recorte). */
  boardCap: number;
}) {
  if (pipelines.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin embudos"
        title="Todavía no hay embudos sincronizados."
        description="Corre el sync de Kommo para traer los embudos y sus etapas al espejo."
      />
    );
  }

  const activeId = pipelineId ?? pipelines[0].id;

  // Etapas del embudo activo, en orden. Excluimos las de sistema won/lost sin
  // leads para no llenar de columnas vacías; si tienen leads, se muestran.
  const cols = statuses
    .filter((s) => s.pipeline_id === activeId)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  const leadsByStatus = new Map<number, KommoLeadRow[]>();
  for (const l of leads) {
    if (l.status_id == null) continue;
    const arr = leadsByStatus.get(l.status_id);
    if (arr) arr.push(l);
    else leadsByStatus.set(l.status_id, [l]);
  }

  const leadValue = (l: KommoLeadRow): number =>
    valueByLead[l.id] ?? (Number(l.price) || 0);

  // ¿Alguna columna trae menos tarjetas que su conteo real? (embudo capado)
  const anyTruncated = cols.some(
    (s) => (realCountByStatus[s.id] ?? 0) > (leadsByStatus.get(s.id)?.length ?? 0),
  );

  return (
    <div>
      {/* Selector de embudo (links · sin JS de cliente) */}
      <div
        role="tablist"
        aria-label="Embudos"
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
      >
        {pipelines.map((p) => {
          const isActive = p.id === activeId;
          return (
            <Link
              key={p.id}
              href={`/studio/kommo?tab=tablero&pipeline=${p.id}`}
              role="tab"
              aria-selected={isActive}
              className="studio-btn studio-btn-sm"
              style={{
                background: isActive ? "var(--bg-elevated)" : "transparent",
                border: isActive ? "1px solid var(--border)" : "1px solid transparent",
                color: isActive ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: isActive ? 700 : 500,
                textDecoration: "none",
              }}
            >
              {p.name ?? `Embudo #${p.id}`}
            </Link>
          );
        })}
      </div>

      {cols.length === 0 ? (
        <EmptyState
          eyebrow="Sin etapas"
          title="Este embudo no tiene etapas en el espejo."
          description="Corre el sync de Kommo o elige otro embudo."
        />
      ) : (
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            paddingBottom: 8,
            alignItems: "flex-start",
          }}
        >
          {cols.map((s) => {
            const colLeads = leadsByStatus.get(s.id) ?? [];
            const realCount = realCountByStatus[s.id] ?? colLeads.length;
            const truncated = realCount > colLeads.length;
            const total = colLeads.reduce((acc, l) => acc + leadValue(l), 0);
            const shown = colLeads.slice(0, CARDS_PER_COLUMN);
            const rest = realCount - shown.length;
            const accent = accentColor(s.color);

            return (
              <section
                key={s.id}
                aria-label={s.name ?? `Etapa #${s.id}`}
                style={{
                  flex: "0 0 268px",
                  width: 268,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderTop: `3px solid ${accent}`,
                  borderRadius: "var(--r-lg)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Header de la columna */}
                <div
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: accent,
                        flex: "0 0 auto",
                      }}
                    />
                    <span
                      style={{
                        font: "700 12.5px/1.2 var(--f-sans)",
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                      title={s.name ?? undefined}
                    >
                      {s.name ?? `Etapa #${s.id}`}
                    </span>
                    <Badge tone="neutral" size="sm">
                      {realCount}
                    </Badge>
                  </div>
                  <div
                    style={{
                      font: "700 12px/1 var(--f-mono)",
                      color: total > 0 ? "var(--ink-soft)" : "var(--ink-mute)",
                      marginTop: 8,
                    }}
                    title={
                      truncated
                        ? "Σ parcial — embudo grande, ver aviso al pie"
                        : "Suma de valor de la columna (facturado ERP si es cliente; si no, price de Kommo)"
                    }
                  >
                    {total > 0 ? `${truncated ? "~" : ""}${fmtUsd(total)}` : "—"}
                  </div>
                </div>

                {/* Tarjetas */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: 10,
                    minHeight: 60,
                  }}
                >
                  {colLeads.length === 0 ? (
                    <span
                      style={{
                        font: "400 12px/1.4 var(--f-sans)",
                        color: "var(--ink-soft)",
                        padding: "var(--s-2) var(--s-1)",
                      }}
                    >
                      Sin leads en esta etapa.
                    </span>
                  ) : (
                    shown.map((l) => {
                      const href = subdomain
                        ? `https://${subdomain}.kommo.com/leads/detail/${l.id}`
                        : null;
                      const days = daysSince(l.kommo_updated_at);
                      const erpVal = valueByLead[l.id];
                      const kommoPrice = Number(l.price) || 0;
                      const markbox = convertedMarkboxByLead[l.id];
                      const owner =
                        l.responsible_user_id != null
                          ? ownerName[l.responsible_user_id]
                          : undefined;
                      const name = l.name || "(sin nombre)";

                      return (
                        <article
                          key={l.id}
                          className="studio-row-hover"
                          style={{
                            background: "var(--bg-base)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--r-md)",
                            padding: "10px 12px",
                          }}
                        >
                          {/* Nombre */}
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir el lead en Kommo (pestaña nueva)"
                              className="studio-link-quiet"
                              style={{
                                display: "block",
                                font: "600 13px/1.3 var(--f-sans)",
                                color: "var(--ink)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {name}
                            </a>
                          ) : (
                            <span
                              style={{
                                display: "block",
                                font: "600 13px/1.3 var(--f-sans)",
                                color: l.name ? "var(--ink)" : "var(--ink-mute)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {name}
                            </span>
                          )}

                          {/* Valor + días */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                              marginTop: 8,
                            }}
                          >
                            {erpVal != null ? (
                              <span
                                style={{ font: "700 12px/1 var(--f-mono)", color: "var(--success)" }}
                                title="Facturado en el ERP (12m)"
                              >
                                {fmtUsd(erpVal)}
                              </span>
                            ) : kommoPrice > 0 ? (
                              <span
                                style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}
                                title="Valor en Kommo"
                              >
                                {fmtUsd(kommoPrice)}
                              </span>
                            ) : (
                              <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-mute)" }}>
                                —
                              </span>
                            )}
                            <span
                              style={{ font: "700 11px/1 var(--f-mono)", color: ageTone(days) }}
                              title={days == null ? "Sin fecha" : `${days} días sin moverse`}
                            >
                              {days == null ? "—" : `${days}d`}
                            </span>
                          </div>

                          {/* Asesor + MARKBOX */}
                          {(owner || markbox) && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                                marginTop: 8,
                              }}
                            >
                              <span
                                style={{
                                  font: "500 11px/1.2 var(--f-sans)",
                                  color: "var(--ink-soft)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {owner ?? ""}
                              </span>
                              {markbox && (
                                <Link
                                  href={`/studio/clientes/${markbox}`}
                                  title="Ver el cliente en el Studio"
                                  style={{ textDecoration: "none", flex: "0 0 auto" }}
                                >
                                  <Badge tone="success" size="sm">
                                    {markbox}
                                  </Badge>
                                </Link>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}

                  {rest > 0 && (
                    <span
                      style={{
                        font: "600 11px/1.2 var(--f-sans)",
                        color: "var(--ink-soft)",
                        textAlign: "center",
                        padding: "var(--s-1) 0",
                      }}
                    >
                      +{rest} más en esta etapa
                    </span>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p
        style={{
          font: "400 11.5px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: 14,
        }}
      >
        Vista de solo lectura del embudo espejado. Valor = facturado en el ERP si el
        lead ya es cliente; si no, el price de Kommo. Para convertir un lead a cliente,
        usa la pestaña <strong>Asesor</strong>.
        {anyTruncated &&
          ` Embudo grande: las columnas con ~ muestran las ${boardCap.toLocaleString(
            "es-VE",
          )} tarjetas más recientes (los conteos son reales).`}
      </p>
    </div>
  );
}
