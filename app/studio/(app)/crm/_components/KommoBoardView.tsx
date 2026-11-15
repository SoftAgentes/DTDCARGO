import { BILLING_UNAVAILABLE, billingStatus, formatAnnualUsd, sumAnnualBilling, type AnnualBillingRead } from "@/lib/shared/annual-billing";
/**
 * Tablero kanban del CRM Kommo (SDD-0078 · vista Tablero).
 *
 * Server component que replica el LAYOUT del embudo de Kommo (columnas = etapas
 * en orden, tarjetas = leads) para que el founder/asesor lea el pipeline de un
 * vistazo. La conversión a cliente vive en la pestaña Asesor.
 *
 * Cada tarjeta trae el MISMO control de etapa que la fila del worklist
 * (`<StageControl variant="card">`, Fase 4 · SDD-0256). Nació de sólo lectura y
 * eso fue un error de uso: el kanban es donde uno mueve cosas, así que el asesor
 * clickeaba una tarjeta que no hacía nada. Sigue sin arrastrar — el menú
 * "Mover a…" cubre el mismo verbo con una fracción del riesgo.
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
import { PuntoConversacion } from "./PuntoConversacion";
import type { OwnerSlice } from "@/lib/studio/kommo-analytics";
import type { StaleOp } from "@/lib/studio/kommo-writeback";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  stageTargets,
  type KommoLeadRow,
  type KommoPipelineRow,
  type KommoStatusRow,
} from "@/lib/studio/kommo-types";
import { LeadActionsButton } from "./LeadActionsButton";
import { StageControl } from "./StageControl";
import { fmtUsd } from "@/lib/money";

const DAY_MS = 86_400_000;
const CARDS_PER_COLUMN = 40;
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

/** Solo dejamos pasar un #hex válido (data de Kommo); si no, sin acento. */
function accentColor(raw: string | null): string {
  return raw && HEX_RE.test(raw) ? raw : "var(--border)";
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

/**
 * SDD-0288 — la antigüedad CEDE el rojo.
 *
 * Antes ≥180 días pintaba `--danger`. Ahora el rojo lo tiene "te escribió",
 * que es lo único accionable ahora mismo. Dos cosas distintas no pueden
 * compartir el color más fuerte: si el Tablero pinta rojo por antigüedad y rojo
 * por sin-atender, el asesor no puede saber cuál está mirando.
 *
 * La antigüedad no se borra — baja a ámbar y conserva su `title`.
 */
function ageTone(days: number | null): string {
  if (days == null) return "var(--ink-mute)";
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
  convertedAvailable,
  billingAvailable,
  ownerName,
  pendingOpsByLead,
  staleOpsByLead,
  asesores,
  canEdit,
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
  valueByLead: Record<number, AnnualBillingRead>;
  convertedAvailable: boolean;
  billingAvailable: boolean;
  ownerName: Record<number, string>;
  /** leadId → ops encoladas que todavía no llegaron a Kommo ("en camino"). */
  pendingOpsByLead: Record<number, string[]>;
  /** leadId → órdenes que el chequeo optimista frenó (SDD-0256 · A1). */
  staleOpsByLead: Record<number, StaleOp[]>;
  /** Asesores del espejo — el drawer los ofrece para reasignar. */
  asesores: OwnerSlice[];
  /** ¿Puede mover, o sólo mirar? Deriva de moduleEditDenial en la página. */
  canEdit: boolean;
  /** Tope de leads traídos por embudo (para el aviso de recorte). */
  boardCap: number;
}) {
  if (pipelines.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin embudos"
        title="Todavía no hay embudos sincronizados."
        description="Corre la sincronización para traer los embudos y sus etapas al espejo."
      />
    );
  }

  // SDD-0288 — reloj único para todas las tarjetas del render. Server
  // component: se fija acá y la derivada lo recibe, en vez de que cada tarjeta
  // llame a Date.now() y una columna quede medio segundo desfasada de la otra.
  const ahoraMs = Date.now();

  const activeId = pipelineId ?? pipelines[0].id;

  // Etapas del embudo activo, en orden. Excluimos las de sistema won/lost sin
  // leads para no llenar de columnas vacías; si tienen leads, se muestran.
  const cols = statuses
    .filter((s) => s.pipeline_id === activeId)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  // Destinos válidos del embudo activo (sin la bandeja de entrada). Se calcula
  // una vez para todo el tablero; cada columna le quita su propia etapa, que
  // como destino no significa nada.
  const targets = stageTargets(statuses, activeId);

  const leadsByStatus = new Map<number, KommoLeadRow[]>();
  for (const l of leads) {
    if (l.status_id == null) continue;
    const arr = leadsByStatus.get(l.status_id);
    if (arr) arr.push(l);
    else leadsByStatus.set(l.status_id, [l]);
  }



  // ¿Alguna columna trae menos tarjetas que su conteo real? (embudo capado)
  const anyTruncated = cols.some(
    (s) => (realCountByStatus[s.id] ?? 0) > (leadsByStatus.get(s.id)?.length ?? 0),
  );

  return (
    <div>
      {/* Selector de embudo (links · sin JS de cliente) */}
      {/* SDD-0603 tramo 5d: la clase única de pestañas; el activo va con
          relleno de tinta (BD-037). El margen va en el envoltorio. */}
      <div style={{ marginBottom: 16 }}>
        <div role="tablist" aria-label="Embudos" className="studio-tabs">
          {pipelines.map((p) => {
            const isActive = p.id === activeId;
            return (
              <Link
                key={p.id}
                href={`/studio/crm?tab=tablero&pipeline=${p.id}`}
                role="tab"
                aria-selected={isActive}
                data-activa={isActive ? "true" : undefined}
                className="studio-tab"
              >
                {p.name ?? `Embudo #${p.id}`}
              </Link>
            );
          })}
        </div>
      </div>

      {cols.length === 0 ? (
        <EmptyState
          eyebrow="Sin etapas"
          title="Este embudo no tiene etapas en el espejo."
          description="Corre la sincronización o elige otro embudo."
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
            const converted = colLeads.filter((l) => convertedMarkboxByLead[l.id]);
            const erp = !convertedAvailable ? BILLING_UNAVAILABLE : sumAnnualBilling(converted.map((l) => ({ key: convertedMarkboxByLead[l.id], billing: billingAvailable ? valueByLead[l.id] ?? BILLING_UNAVAILABLE : BILLING_UNAVAILABLE })));
            const nominal = colLeads.filter((l) => !convertedMarkboxByLead[l.id]).reduce((n, l) => n + (Number(l.price) || 0), 0);
            const shown = colLeads.slice(0, CARDS_PER_COLUMN);
            const rest = realCount - shown.length;
            const accent = accentColor(s.color);
            const colTargets = targets.filter((t) => t.id !== s.id);

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
                      color: "var(--ink-soft)",
                      lineHeight: 1.5,
                      marginTop: 8,
                    }}
                    title={
                      truncated
                        ? "Σ parcial — embudo grande, ver aviso al pie"
                        : "Facturación ERP atribuida a las tarjetas; valor nominal CRM separado"
                    }
                  >
                    <div>{truncated ? "Tarjetas cargadas · " : ""}ERP: {formatAnnualUsd(erp.subtotalUsd)}</div>
                    <div style={{ font: "500 11px/1.4 var(--f-sans)" }}>{billingStatus(erp)}</div>
                    {convertedAvailable && <div>Valor nominal CRM: {fmtUsd(nominal)}</div>}
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
                      const erpVal = !convertedAvailable ? BILLING_UNAVAILABLE
                        : convertedMarkboxByLead[l.id] ? (billingAvailable ? valueByLead[l.id] ?? BILLING_UNAVAILABLE : BILLING_UNAVAILABLE)
                        : undefined;
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
                          {/* Nombre, con el punto del semáforo a la IZQUIERDA
                              (la forma la pidió el founder: "un botoncito rojo
                              a la izquierda", como una notificación). */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <PuntoConversacion lead={l} ahoraMs={ahoraMs} />
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir la ficha completa (pestaña nueva)"
                              className="studio-link-quiet"
                              style={{
                                display: "block",
                                // flex item: sin esto el ellipsis deja de
                                // funcionar (min-width:auto por default).
                                minWidth: 0,
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
                                // flex item: sin esto el ellipsis deja de
                                // funcionar (min-width:auto por default).
                                minWidth: 0,
                                font: "600 13px/1.3 var(--f-sans)",
                                color: l.name ? "var(--ink)" : "var(--ink-soft)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {name}
                            </span>
                          )}
                          </div>

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
                                style={{ font: "700 12px/1 var(--f-mono)", color: erpVal.state === "completo" ? "var(--success)" : "var(--ink-soft)" }}
                                title={billingStatus(erpVal)}
                              >
                                {formatAnnualUsd(erpVal.subtotalUsd)}
                      <small style={{ display: "block", lineHeight: 1.4, font: "500 11px/1.4 var(--f-sans)", marginTop: 5 }}>{billingStatus(erpVal)}</small>
                              </span>
                            ) : kommoPrice > 0 ? (
                              <span
                                style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}
                                title="Valor en el CRM"
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

                          {/* Mover de etapa. Siempre visible, no sólo al pasar
                              el mouse: si el verbo se esconde, el asesor
                              concluye que el tablero no hace nada. */}
                          {canEdit && (
                            <div
                              style={{
                                marginTop: 8,
                                paddingTop: 8,
                                borderTop: "1px solid var(--border)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              {colTargets.length > 0 && (
                                <StageControl
                                  leadId={l.id}
                                  stages={colTargets}
                                  variant="card"
                                  canEdit={canEdit}
                                  enCamino={(pendingOpsByLead[l.id] ?? []).includes(
                                    "patch_stage",
                                  )}
                                />
                              )}
                              {/* El resto de los verbos, en la MISMA superficie.
                                  Que la etapa se mueva desde la tarjeta y el
                                  asesor haya que cambiarlo en otra pantalla es
                                  el mismo error de media milla, una capa más
                                  arriba. */}
                              <LeadActionsButton
                                lead={{
                                  id: l.id,
                                  name: l.name || "(sin nombre)",
                                  ownerId: l.responsible_user_id,
                                }}
                                asesores={asesores}
                                staleOps={staleOpsByLead[l.id] ?? []}
                                canEdit={canEdit}
                                variant="card"
                              />
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
        {canEdit ? (
          <>
            Mover una tarjeta de etapa manda la orden al CRM; la tarjeta dice{" "}
            <strong>En camino</strong> hasta que el CRM confirma y vuelve espejada.{" "}
          </>
        ) : (
          <>Vista de lectura: tu rol no mueve leads en el CRM. </>
        )}
        Valor =
        facturado en el ERP si el lead ya es cliente; si no, el valor del CRM. Para
        convertir un lead a cliente, usa la pestaña <strong>Asesor</strong>.
        {anyTruncated &&
          ` Embudo grande: las columnas con ~ muestran las ${boardCap.toLocaleString(
            "es-VE",
          )} tarjetas más recientes (los conteos son reales).`}
      </p>
    </div>
  );
}
