"use client";

/**
 * PortalBackfillSection — adopción del portal (2026-07-11). Embudo compartido
 * arriba + dos pestañas:
 *   1. "Sin invitar" — clientes SIN acceso al portal con email válido: filtrar
 *      (excluir demos), seleccionar e invitar por tandas (correos reales).
 *   2. "Invitados sin entrar" — clientes que YA tienen acceso pero NUNCA
 *      iniciaron sesión (la brecha del embudo entre "Con acceso" y "Entraron"):
 *      reenviarles un enlace mágico fresco por tandas.
 *
 * Ambas mandan correos REALES → tope de 20 por tanda (lo fuerza el server). Solo
 * tokens var(--*).
 */

import {
  useActionState,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Icon } from "@/app/studio/_components/icons";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type {
  PortalInviteCandidate,
  PortalAdoptionStats,
  PortalColdInvitee,
  PortalContactlessClient,
} from "@/lib/studio/client-queries";
import {
  bulkInvitePortalAction,
  bulkResendPortalInviteAction,
  updateClientContactAction,
  portalWhatsAppInviteAction,
  bulkWhatsAppInviteAction,
  type BulkInviteState,
  type ContactCaptureState,
  type WhatsAppBatchState,
} from "../portal-backfill-actions";

const WA_BATCH_MAX = 10;

const MAX_PER_BATCH = 20;

export function actionStateChangedSuccessfully<T extends { ok?: boolean }>(
  baseline: T,
  current: T,
): boolean {
  return baseline !== current && current.ok === true;
}

function pct(n: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((n / total) * 100)}%`;
}

function AdoptionFunnel({ stats }: { stats: PortalAdoptionStats }) {
  const steps = [
    { label: "Clientes", value: stats.totalClients, sub: "total" },
    {
      label: "Con acceso",
      value: stats.withAccess,
      sub: pct(stats.withAccess, stats.totalClients),
    },
    {
      label: "Entraron",
      value: stats.loggedIn,
      sub: pct(stats.loggedIn, stats.totalClients),
    },
    {
      label: "Anunciaron compra",
      value: stats.announced,
      sub: pct(stats.announced, stats.totalClients),
    },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 10,
      }}
    >
      {steps.map((s) => (
        <div
          key={s.label}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              font: "700 9.5px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              font: "800 24px/1.1 var(--f-mono)",
              color: "var(--ink)",
              marginTop: 6,
            }}
          >
            {s.value}
          </div>
          <div
            style={{
              font: "600 11px/1 var(--f-mono)",
              color: "var(--wine-text)",
              marginTop: 3,
            }}
          >
            {s.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Progreso de la campaña de invitación: cuánto del universo con correo válido ya
 * recibió acceso. `withAccess` = ya invitados (tienen client_users); `candidatesWithEmail`
 * = por invitar. El total crece si el equipo captura más correos (pestaña "Sin contacto").
 */
function CampaignProgress({ stats }: { stats: PortalAdoptionStats }) {
  const invited = stats.withAccess;
  const pending = stats.candidatesWithEmail;
  const total = invited + pending;
  if (total <= 0) return null;
  const pctDone = Math.round((invited / total) * 100);

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 9,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            font: "700 10px/1 var(--f-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
          }}
        >
          Campaña de invitación
        </span>
        <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
          <strong style={{ color: "var(--ink)", font: "700 13px/1 var(--f-mono)" }}>
            {invited}
          </strong>{" "}
          de {total} con correo ya invitados ·{" "}
          <strong style={{ color: "var(--wine-text)" }}>{pctDone}%</strong> · faltan{" "}
          <strong style={{ color: "var(--ink)" }}>{pending}</strong>
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={invited}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Progreso de la campaña de invitación al portal"
        style={{
          height: 8,
          borderRadius: "var(--r-pill)",
          background: "var(--bg-elevated)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pctDone}%`,
            height: "100%",
            background: "var(--wine)",
            borderRadius: "var(--r-pill)",
            transition: "width 240ms ease",
          }}
        />
      </div>
    </div>
  );
}

/** Banner del resultado de una tanda (compartido invitar / reenviar). */
function BatchResult({
  state,
  okNoun,
}: {
  state: BulkInviteState;
  okNoun: string;
}) {
  if (!state.ok && !state.error) return null;
  if (state.error) {
    return (
      <div
        role="alert"
        style={{
          font: "600 12.5px/1.5 var(--f-sans)",
          color: "var(--danger)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-sm)",
          padding: "11px 14px",
        }}
      >
        {state.error}
      </div>
    );
  }
  return (
    <div
      role="status"
      style={{
        font: "500 12.5px/1.5 var(--f-sans)",
        color: "var(--ink)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--success)",
        borderRadius: "var(--r-sm)",
        padding: "11px 14px",
      }}
    >
      <strong>{state.invited ?? 0}</strong> {okNoun}.
      {state.emailFailed
        ? ` ${state.emailFailed} con el correo fallido (reinténtalo).`
        : ""}
      {state.failed ? ` ${state.failed} no se pudieron habilitar.` : ""}
      {state.remaining
        ? ` Quedaron ${state.remaining} seleccionados sin procesar — corré de nuevo.`
        : ""}
      {state.details ? (
        <span style={{ color: "var(--ink-soft)" }}> · {state.details}</span>
      ) : null}
    </div>
  );
}

const TABLE_COLS =
  "34px minmax(120px,1.2fr) 92px minmax(130px,1.4fr) 104px 118px";
const COLD_COLS =
  "34px minmax(120px,1.2fr) 92px 100px 96px 118px";

/** Número de teléfono formateado o guion. */
function fmtPhone(phone: string): string {
  return phone && phone.trim() ? phone.trim() : "—";
}

/** Pill de filtro/orden segmentado (activo = wine). */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        appearance: "none",
        cursor: "pointer",
        font: `${active ? 700 : 600} 11.5px/1 var(--f-sans)`,
        color: active ? "var(--ink-inv)" : "var(--ink-soft)",
        background: active ? "var(--wine)" : "var(--bg-elevated)",
        border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
        borderRadius: "var(--r-pill)",
        padding: "5px 11px",
      }}
    >
      {children}
    </button>
  );
}

/** Fecha corta es-VE para tooltips (o vacío si inválida). */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Umbral a partir del cual reinvitar por un canal se considera saturación (anti-spam). */
const SPAM_THRESHOLD = 2;

/** Badge compacto de conteo de invitaciones por canal (anti-spam). ≥2 → warning. */
function InviteCountBadge({
  label,
  count,
  title,
}: {
  label: string;
  count: number;
  title?: string;
}) {
  const saturated = count >= SPAM_THRESHOLD;
  const on = count > 0;
  const color = saturated
    ? "var(--warning)"
    : on
      ? "var(--wine)"
      : "var(--ink-soft)";
  return (
    <span
      title={title}
      style={{
        font: "700 10px/1 var(--f-mono)",
        color,
        background: saturated ? "var(--warning-tint, var(--bg-elevated))" : "var(--bg-elevated)",
        border: `1px solid ${saturated ? "var(--warning)" : on ? "var(--wine)" : "var(--border)"}`,
        borderRadius: "var(--r-pill)",
        padding: "2px 6px",
        whiteSpace: "nowrap",
      }}
    >
      {label} ×{count}
    </span>
  );
}

/** wa.me con el mensaje de invitación pre-armado (o sin destino si no hay teléfono). */
function buildWaHref(raw: string | null, name: string | null, link: string): string {
  const saludo = name ? ` ${name}` : "";
  const msg = [
    `Hola${saludo}, te damos acceso a tu portal de DTD Cargo: ahí ves tus envíos, tus facturas y tu Shipping Mark.`,
    ``,
    `Ábrelo aquí y toca "Entrar a mi portal":`,
    link,
    ``,
    `Es personal y de un solo uso — no lo reenvíes a nadie.`,
    ``,
    `Si también te llegó por correo y no lo ves, revisa la carpeta de spam.`,
    ``,
    `Con Confianza, de China a tu puerta.`,
  ].join("\n");
  return raw
    ? `https://wa.me/${raw}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

/** Toolbar compartida: búsqueda + contador + botón submit. */
function BatchToolbar({
  search,
  setSearch,
  placeholder,
  selectedCount,
  totalCount,
  willProcess,
  overflow,
  pending,
  submitLabel,
  loadingLabel,
  selectedIds,
  formAction,
}: {
  search: string;
  setSearch: (v: string) => void;
  placeholder: string;
  selectedCount: number;
  totalCount: number;
  willProcess: number;
  overflow: number;
  pending: boolean;
  submitLabel: string;
  loadingLabel: string;
  selectedIds: string[];
  formAction: (formData: FormData) => void;
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-2)",
          flex: "1 1 240px",
          minWidth: 200,
          maxWidth: 420,
          height: 34,
          padding: "0 10px",
          background: "var(--bg-elevated)",
          borderRadius: "var(--r-sm)",
        }}
      >
        <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
          {Icon.search(13)}
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          aria-label="Buscar"
          style={{
            flex: 1,
            height: "100%",
            border: 0,
            background: "transparent",
            font: "500 12.5px/1 var(--f-sans)",
            color: "var(--ink)",
          }}
        />
      </div>

      <span
        style={{
          font: "600 12px/1 var(--f-mono)",
          color: "var(--ink-soft)",
          marginLeft: "auto",
        }}
      >
        {selectedCount} seleccionados · {totalCount} en lista
      </span>

      <form action={formAction}>
        <input type="hidden" name="client_ids" value={selectedIds.join(",")} />
        <button
          type="submit"
          disabled={pending || selectedIds.length === 0}
          className="studio-btn studio-btn-primary studio-btn-sm"
        >
          {pending
            ? loadingLabel
            : `${submitLabel} ${willProcess}${overflow > 0 ? ` (de ${selectedIds.length})` : ""}`}
        </button>
      </form>
    </div>
  );
}

/** Fila de candidato: checkbox (invitar por correo en lote) + invitar por WhatsApp 1×1. */
function CandidateRow({
  c,
  on,
  onToggle,
  first,
}: {
  c: PortalInviteCandidate;
  on: boolean;
  onToggle: () => void;
  first: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [waHref, setWaHref] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function genWhatsApp() {
    setErr(null);
    setWaHref(null);
    setPending(true);
    try {
      const res = await portalWhatsAppInviteAction(c.id);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setWaHref(buildWaHref(res.whatsappRaw, res.name, res.link));
    } catch {
      setErr("No se pudo generar el enlace. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  const stop = (e: MouseEvent) => e.stopPropagation();

  // Editar cliente inline (corregir teléfono/correo mal importados) — reusa la action
  // de captura de contacto (update parcial de email/phone, no toca el resto del cliente).
  const [editing, setEditing] = useState(false);
  const [editEmail, setEditEmail] = useState(c.email);
  const [editPhone, setEditPhone] = useState(c.phone);
  const [editState, editAction, editPending] = useActionState<
    ContactCaptureState,
    FormData
  >(updateClientContactAction, {});
  const [editBaseline, setEditBaseline] = useState(editState);
  const isEditing =
    editing && !actionStateChangedSuccessfully(editBaseline, editState);

  function openEdit(e: MouseEvent) {
    stop(e);
    setEditEmail(c.email);
    setEditPhone(c.phone);
    setEditBaseline(editState);
    setEditing((v) => !v);
  }

  return (
    <div
      style={{
        borderTop: first ? 0 : "1px solid var(--border)",
        background: on ? "var(--wine-tint)" : "transparent",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "grid",
          gridTemplateColumns: TABLE_COLS,
          gap: "var(--s-3)",
          padding: "11px 20px",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={on}
          onChange={onToggle}
          onClick={stop}
          aria-label={`Seleccionar ${c.name}`}
          style={{ cursor: "pointer", width: 15, height: 15 }}
        />
        <span
          style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}
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
            {c.name || "—"}
          </span>
          {c.isLikelyDemo && (
            <span
              title="Parece cliente de prueba — revísalo antes de invitar"
              style={{
                flexShrink: 0,
                font: "700 9px/1 var(--f-sans)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--warning)",
                background: "var(--warning-tint, var(--bg-elevated))",
                border: "1px solid var(--warning)",
                borderRadius: "var(--r-pill)",
                padding: "2px 6px",
              }}
            >
              demo?
            </span>
          )}
        </span>
        <code
          style={{ font: "600 11.5px/1.2 var(--f-mono)", color: "var(--wine-text)" }}
        >
          {c.markbox || "—"}
        </code>
        <span
          style={{
            font: "500 12px/1.3 var(--f-mono)",
            color: "var(--ink-soft)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {c.email}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          <span
            style={{
              font: "500 12px/1.3 var(--f-mono)",
              color: c.phone ? "var(--ink-soft)" : "var(--ink-mute)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fmtPhone(c.phone)}
          </span>
          <button
            type="button"
            onClick={openEdit}
            title="Actualizar cliente (correo / teléfono)"
            aria-label={`Actualizar ${c.name}`}
            style={{
              flexShrink: 0,
              appearance: "none",
              cursor: "pointer",
              border: "1px solid var(--border)",
              background: isEditing ? "var(--wine-tint)" : "var(--bg-elevated)",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              font: "600 11px/1 var(--f-sans)",
              padding: "3px 6px",
            }}
          >
            ✎
          </button>
        </span>
        {/* Celda WhatsApp — no togglea la selección al interactuar. */}
        <span onClick={stop} style={{ cursor: "default" }}>
          {c.phone ? (
            waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="studio-btn studio-btn-primary studio-btn-xs"
              >
                Abrir WhatsApp →
              </a>
            ) : (
              <button
                type="button"
                onClick={genWhatsApp}
                disabled={pending}
                className="studio-btn studio-btn-ghost studio-btn-xs"
              >
                {pending ? "Generando…" : "WhatsApp"}
              </button>
            )
          ) : (
            <span
              title="Sin teléfono — captúralo para invitar por WhatsApp"
              style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-soft)" }}
            >
              sin teléfono
            </span>
          )}
        </span>
      </div>
      {isEditing && (
        <form
          action={editAction}
          onClick={stop}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "0 20px 12px 54px",
          }}
        >
          <input type="hidden" name="client_id" value={c.id} />
          <input
            name="email"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            placeholder="correo@cliente.com"
            aria-label="Correo"
            className="studio-input studio-input-mono"
            style={{ height: 30, minWidth: 200, font: "500 12px/1 var(--f-mono)" }}
          />
          <input
            name="phone"
            type="tel"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            placeholder="+58 4XX…"
            aria-label="Teléfono"
            className="studio-input studio-input-mono"
            style={{ height: 30, minWidth: 150, font: "500 12px/1 var(--f-mono)" }}
          />
          <button
            type="submit"
            disabled={editPending}
            className="studio-btn studio-btn-primary studio-btn-xs"
          >
            {editPending ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={editPending}
            className="studio-btn studio-btn-ghost studio-btn-xs"
          >
            Cancelar
          </button>
          {editState.error && (
            <span style={{ font: "600 11.5px/1.4 var(--f-sans)", color: "var(--danger)" }}>
              {editState.error}
            </span>
          )}
        </form>
      )}
      {(waHref || err) && (
        <div style={{ padding: "0 20px 10px 54px" }}>
          {err ? (
            <span
              style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--danger)" }}
            >
              {err}
            </span>
          ) : (
            <span
              style={{
                font: "500 11.5px/1.45 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              Se abre WhatsApp con el enlace listo. Envíaselo <b>solo al cliente</b>:
              es de un solo uso y vale por 72 horas.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Lista de enlaces de WhatsApp para VARIOS seleccionados a la vez: genera los enlaces
 * (provisiona + magic-link) y los muestra para abrir chat por chat o copiar todo.
 * WhatsApp no se automatiza en lote — esto solo prepara la lista para mandar rápido.
 */
function WhatsAppBatchPanel({ selectedIds }: { selectedIds: string[] }) {
  const [state, formAction, pending] = useActionState<WhatsAppBatchState, FormData>(
    bulkWhatsAppInviteAction,
    {},
  );
  const [copied, setCopied] = useState(false);
  const items = state.items ?? [];
  const willProcess = Math.min(selectedIds.length, WA_BATCH_MAX);
  const overflow = selectedIds.length - WA_BATCH_MAX;

  async function copyList() {
    const text = items
      .map(
        (it) =>
          `${it.name ?? "Cliente"} (+${it.whatsappRaw ?? "—"}): ${buildWaHref(it.whatsappRaw, it.name, it.link)}`,
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard bloqueado — el usuario puede copiar a mano de los enlaces de abajo */
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <form action={formAction}>
          <input type="hidden" name="client_ids" value={selectedIds.join(",")} />
          <button
            type="submit"
            disabled={pending || selectedIds.length === 0}
            className="studio-btn studio-btn-dark studio-btn-sm"
          >
            {pending
              ? "Generando enlaces…"
              : `Enlaces WhatsApp ${willProcess}${overflow > 0 ? ` (de ${selectedIds.length})` : ""}`}
          </button>
        </form>
        <span style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          Prepara los enlaces de los seleccionados con teléfono (máx {WA_BATCH_MAX}) para
          abrirlos uno por uno. Vencen pronto — mándalos ya.
        </span>
      </div>

      {state.error && (
        <span style={{ font: "600 12px/1.4 var(--f-sans)", color: "var(--danger)" }}>
          {state.error}
        </span>
      )}

      {state.ok && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
              {items.length} enlace{items.length === 1 ? "" : "s"} listo
              {items.length === 1 ? "" : "s"}
              {state.skipped ? ` · ${state.skipped} sin teléfono/correo` : ""}
              {state.remaining ? ` · ${state.remaining} sin procesar (corre de nuevo)` : ""}
            </span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={copyList}
                className="studio-btn studio-btn-ghost studio-btn-xs"
              >
                {copied ? "✓ Copiado" : "Copiar lista"}
              </button>
            )}
          </div>
          {items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((it) => (
                <div
                  key={it.clientId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "6px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span style={{ minWidth: 0, display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span
                      style={{
                        font: "600 12.5px/1.3 var(--f-sans)",
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {it.name || "Cliente"}
                    </span>
                    <span style={{ font: "500 11.5px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                      +{it.whatsappRaw ?? "—"}
                    </span>
                  </span>
                  <a
                    href={buildWaHref(it.whatsappRaw, it.name, it.link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="studio-btn studio-btn-primary studio-btn-xs"
                    style={{ flexShrink: 0 }}
                  >
                    Abrir WhatsApp →
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pestaña 1: sin invitar (candidatos) ─────────────────────────────
function InviteCandidatesPanel({
  candidates,
}: {
  candidates: PortalInviteCandidate[];
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlyPhone, setOnlyPhone] = useState(false);
  const [state, formAction, pending] = useActionState<BulkInviteState, FormData>(
    bulkInvitePortalAction,
    {},
  );
  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    if (state.ok) setSelected(new Set());
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = candidates;
    if (onlyPhone) list = list.filter((c) => c.phone);
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.markbox.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [candidates, search, onlyPhone]);

  // "Seleccionar todos" IGNORA los posibles demo (protección del masivo): nunca
  // los agarra en bloque; hay que marcarlos uno por uno a propósito.
  const selectableFiltered = useMemo(
    () => filtered.filter((c) => !c.isLikelyDemo),
    [filtered],
  );
  const demoInList = useMemo(
    () => candidates.filter((c) => c.isLikelyDemo).length,
    [candidates],
  );
  const allFilteredSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((c) => selected.has(c.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected)
        selectableFiltered.forEach((c) => next.delete(c.id));
      else selectableFiltered.forEach((c) => next.add(c.id));
      return next;
    });

  const selectedIds = [...selected];
  const willProcess = Math.min(selectedIds.length, MAX_PER_BATCH);

  if (candidates.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin candidatos con correo"
        title="No hay clientes con email pendientes de invitar."
        description="Todos los que tienen correo válido ya recibieron acceso. Los que faltan no tienen correo — captúralo primero."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Aviso: correos reales */}
      <div
        style={{
          font: "500 12.5px/1.5 var(--f-sans)",
          color: "var(--ink)",
          background: "var(--warning-tint, var(--bg-elevated))",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--warning)",
          borderRadius: "var(--r-sm)",
          padding: "11px 14px",
        }}
      >
        Invita por <strong>correo</strong> (selección + tandas de{" "}
        <strong>{MAX_PER_BATCH}</strong>) o por <strong>WhatsApp</strong> 1×1 (los
        que tienen teléfono) — genera el enlace y lo abres en su chat. Ambos mandan
        acceso <strong>real</strong>.
        {demoInList > 0 ? (
          <>
            {" "}
            Marcamos <strong>{demoInList}</strong> como posible demo (badge{" "}
            <em>demo?</em>): <strong>no</strong> entran en “seleccionar todos” —
            márcalos a mano solo si de verdad quieres invitarlos.
          </>
        ) : null}
      </div>

      <BatchResult state={state} okNoun="invitados con correo" />

      <BatchToolbar
        search={search}
        setSearch={setSearch}
        placeholder="Buscar / excluir por nombre, Shipping Mark o correo…"
        selectedCount={selected.size}
        totalCount={candidates.length}
        willProcess={willProcess}
        overflow={selectedIds.length - MAX_PER_BATCH}
        pending={pending}
        submitLabel="Invitar"
        loadingLabel="Invitando…"
        selectedIds={selectedIds}
        formAction={formAction}
      />

      <WhatsAppBatchPanel selectedIds={selectedIds} />

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
        <Chip active={!onlyPhone} onClick={() => setOnlyPhone(false)}>
          Todos
        </Chip>
        <Chip active={onlyPhone} onClick={() => setOnlyPhone(true)}>
          Con teléfono
        </Chip>
      </div>

      {/* Tabla de candidatos */}
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
            gridTemplateColumns: TABLE_COLS,
            gap: "var(--s-3)",
            padding: "var(--s-3) var(--s-5)",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
            font: "700 10px/1 var(--f-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            alignItems: "center",
          }}
        >
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleAllFiltered}
            aria-label="Seleccionar todos los visibles"
            style={{ cursor: "pointer", width: 15, height: 15 }}
          />
          <span>Cliente</span>
          <span>Shipping Mark</span>
          <span>Correo</span>
          <span>Teléfono</span>
          <span>WhatsApp</span>
        </div>

        {filtered.length === 0 ? (
          <div
            style={{
              padding: "20px",
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              textAlign: "center",
            }}
          >
            Nada coincide con tu búsqueda.
          </div>
        ) : (
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {filtered.map((c, i) => (
              <CandidateRow
                key={c.id}
                c={c}
                on={selected.has(c.id)}
                onToggle={() => toggle(c.id)}
                first={i === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Fila del checklist de fríos: badges de conteo por canal + reenviar por WhatsApp. */
function ColdRow({
  c,
  on,
  onToggle,
  first,
}: {
  c: PortalColdInvitee;
  on: boolean;
  onToggle: () => void;
  first: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [waHref, setWaHref] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function genWhatsApp() {
    setErr(null);
    setWaHref(null);
    setConfirming(false);
    setPending(true);
    try {
      const res = await portalWhatsAppInviteAction(c.id);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setWaHref(buildWaHref(res.whatsappRaw, res.name, res.link));
    } catch {
      setErr("No se pudo generar el enlace. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  // Guardia anti-spam: si ya se le mandó WhatsApp ≥2 veces, pide confirmación.
  const needsConfirm = c.whatsappInvites >= SPAM_THRESHOLD;
  function onWhatsAppClick() {
    if (needsConfirm && !confirming) {
      setConfirming(true);
      return;
    }
    void genWhatsApp();
  }

  const stop = (e: MouseEvent) => e.stopPropagation();

  // Editar cliente inline (corregir teléfono/correo) — reusa la action de captura.
  const [editing, setEditing] = useState(false);
  const [editEmail, setEditEmail] = useState(c.email);
  const [editPhone, setEditPhone] = useState(c.phone);
  const [editState, editAction, editPending] = useActionState<
    ContactCaptureState,
    FormData
  >(updateClientContactAction, {});
  const [editBaseline, setEditBaseline] = useState(editState);
  const isEditing =
    editing && !actionStateChangedSuccessfully(editBaseline, editState);
  function openEdit(e: MouseEvent) {
    stop(e);
    setEditEmail(c.email);
    setEditPhone(c.phone);
    setEditBaseline(editState);
    setEditing((v) => !v);
  }

  const age =
    c.daysCold <= 0
      ? "hoy"
      : c.daysCold === 1
        ? "hace 1 día"
        : `hace ${c.daysCold} días`;
  const stale = c.daysCold >= 7;
  const totalInvites = c.emailInvites + c.whatsappInvites;

  return (
    <div
      style={{
        borderTop: first ? 0 : "1px solid var(--border)",
        background: on ? "var(--wine-tint)" : "transparent",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "grid",
          gridTemplateColumns: COLD_COLS,
          gap: "var(--s-3)",
          padding: "10px 20px",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={on}
          onChange={onToggle}
          onClick={stop}
          aria-label={`Seleccionar ${c.name}`}
          style={{ cursor: "pointer", width: 15, height: 15 }}
        />
        <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span
            style={{
              font: "600 12.5px/1.3 var(--f-sans)",
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.name || "—"}
          </span>
          {totalInvites > 0 && (
            <span style={{ display: "flex", gap: 5 }}>
              <InviteCountBadge
                label="✉"
                count={c.emailInvites}
                title={
                  c.lastEmailInviteAt
                    ? `Último correo: ${fmtDate(c.lastEmailInviteAt)}${c.lastEmailInviteBy ? ` · por ${c.lastEmailInviteBy}` : " · automático"}`
                    : "Invitaciones por correo"
                }
              />
              <InviteCountBadge
                label="WA"
                count={c.whatsappInvites}
                title={
                  c.lastWhatsappInviteAt
                    ? `Último WhatsApp: ${fmtDate(c.lastWhatsappInviteAt)}${c.lastWhatsappInviteBy ? ` · por ${c.lastWhatsappInviteBy}` : ""}`
                    : "Invitaciones por WhatsApp"
                }
              />
            </span>
          )}
        </span>
        <code
          style={{ font: "600 11.5px/1.2 var(--f-mono)", color: "var(--wine-text)" }}
        >
          {c.markbox || "—"}
        </code>
        <span
          style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}
        >
          <span
            style={{
              font: "500 12px/1.3 var(--f-mono)",
              color: c.phone ? "var(--ink-soft)" : "var(--ink-mute)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fmtPhone(c.phone)}
          </span>
          <button
            type="button"
            onClick={openEdit}
            title="Actualizar cliente (correo / teléfono)"
            aria-label={`Actualizar ${c.name}`}
            style={{
              flexShrink: 0,
              appearance: "none",
              cursor: "pointer",
              border: "1px solid var(--border)",
              background: isEditing ? "var(--wine-tint)" : "var(--bg-elevated)",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              font: "600 11px/1 var(--f-sans)",
              padding: "3px 6px",
            }}
          >
            ✎
          </button>
        </span>
        <span
          title={`Invitado ${age}, sin abrir`}
          style={{
            font: "500 12px/1.3 var(--f-sans)",
            color: stale ? "var(--warning)" : "var(--ink-soft)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {age}
        </span>
        <span onClick={stop} style={{ cursor: "default" }}>
          {c.phone ? (
            waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="studio-btn studio-btn-primary studio-btn-xs"
              >
                Abrir WhatsApp →
              </a>
            ) : confirming ? (
              <span style={{ display: "inline-flex", gap: 5 }}>
                <button
                  type="button"
                  onClick={() => void genWhatsApp()}
                  disabled={pending}
                  className="studio-btn studio-btn-warning studio-btn-xs"
                >
                  {pending ? "Generando…" : "Reenviar igual"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="studio-btn studio-btn-ghost studio-btn-xs"
                >
                  Cancelar
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={onWhatsAppClick}
                disabled={pending}
                className="studio-btn studio-btn-ghost studio-btn-xs"
              >
                {pending
                  ? "Generando…"
                  : c.whatsappInvites > 0
                    ? "Reenviar WA"
                    : "WhatsApp"}
              </button>
            )
          ) : (
            <span
              title="Sin teléfono — captúralo para invitar por WhatsApp"
              style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-soft)" }}
            >
              sin teléfono
            </span>
          )}
        </span>
      </div>
      {isEditing && (
        <form
          action={editAction}
          onClick={stop}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "0 20px 12px 54px",
          }}
        >
          <input type="hidden" name="client_id" value={c.id} />
          <input
            name="email"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            placeholder="correo@cliente.com"
            aria-label="Correo"
            className="studio-input studio-input-mono"
            style={{ height: 30, minWidth: 200, font: "500 12px/1 var(--f-mono)" }}
          />
          <input
            name="phone"
            type="tel"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            placeholder="+58 4XX…"
            aria-label="Teléfono"
            className="studio-input studio-input-mono"
            style={{ height: 30, minWidth: 150, font: "500 12px/1 var(--f-mono)" }}
          />
          <button
            type="submit"
            disabled={editPending}
            className="studio-btn studio-btn-primary studio-btn-xs"
          >
            {editPending ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={editPending}
            className="studio-btn studio-btn-ghost studio-btn-xs"
          >
            Cancelar
          </button>
          {editState.error && (
            <span style={{ font: "600 11.5px/1.4 var(--f-sans)", color: "var(--danger)" }}>
              {editState.error}
            </span>
          )}
        </form>
      )}
      {(waHref || err || confirming) && (
        <div style={{ padding: "0 20px 10px 54px" }}>
          {err ? (
            <span
              style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--danger)" }}
            >
              {err}
            </span>
          ) : confirming ? (
            <span
              style={{ font: "500 11.5px/1.45 var(--f-sans)", color: "var(--warning)" }}
            >
              Ya le enviaste WhatsApp <b>{c.whatsappInvites}</b>{" "}
              {c.whatsappInvites === 1 ? "vez" : "veces"}
              {c.lastWhatsappInviteAt
                ? ` (último: ${fmtDate(c.lastWhatsappInviteAt)})`
                : ""}
              . Evita saturarlo — ¿reenviar igual?
            </span>
          ) : (
            <span
              style={{
                font: "500 11.5px/1.45 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              Se abre WhatsApp con el enlace listo. Envíaselo <b>solo al cliente</b>.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pestaña 2: invitados sin entrar (fríos) ─────────────────────────
function ColdInviteesPanel({ cold }: { cold: PortalColdInvitee[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState<BulkInviteState, FormData>(
    bulkResendPortalInviteAction,
    {},
  );
  const [coldFilter, setColdFilter] = useState<
    "all" | "phone" | "noWa" | "saturated"
  >("all");
  const [coldSort, setColdSort] = useState<"oldest" | "least" | "most">("oldest");
  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    if (state.ok) setSelected(new Set());
  }

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cold;
    return cold.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.markbox.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [cold, search]);

  // Filtro rápido + orden (priorizar a quién nudgear).
  const shown = useMemo(() => {
    let list = searched;
    if (coldFilter === "phone") list = list.filter((c) => c.phone);
    else if (coldFilter === "noWa") list = list.filter((c) => c.whatsappInvites === 0);
    else if (coldFilter === "saturated")
      list = list.filter(
        (c) => Math.max(c.emailInvites, c.whatsappInvites) >= SPAM_THRESHOLD,
      );
    const arr = [...list];
    const total = (c: PortalColdInvitee) => c.emailInvites + c.whatsappInvites;
    if (coldSort === "least") arr.sort((a, b) => total(a) - total(b) || b.daysCold - a.daysCold);
    else if (coldSort === "most") arr.sort((a, b) => total(b) - total(a) || b.daysCold - a.daysCold);
    else arr.sort((a, b) => b.daysCold - a.daysCold); // más viejos
    return arr;
  }, [searched, coldFilter, coldSort]);

  const allFilteredSelected =
    shown.length > 0 && shown.every((c) => selected.has(c.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) shown.forEach((c) => next.delete(c.id));
      else shown.forEach((c) => next.add(c.id));
      return next;
    });

  const selectedIds = [...selected];
  const willProcess = Math.min(selectedIds.length, MAX_PER_BATCH);

  // Guardia anti-spam: seleccionados que ya recibieron ≥2 correos.
  const saturatedSelected = cold.filter(
    (c) => selected.has(c.id) && c.emailInvites >= SPAM_THRESHOLD,
  ).length;

  if (cold.length === 0) {
    return (
      <EmptyState
        eyebrow="Nadie quedó frío"
        title="Todos los invitados abrieron su enlace al menos una vez."
        description="Cuando invites a más clientes, los que no abran su invitación aparecerán acá para reenviárselo."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          font: "500 12.5px/1.5 var(--f-sans)",
          color: "var(--ink)",
          background: "var(--warning-tint, var(--bg-elevated))",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--warning)",
          borderRadius: "var(--r-sm)",
          padding: "11px 14px",
        }}
      >
        Estos clientes tienen invitación pero <strong>nunca abrieron su
        enlace</strong>. Reenvíales por <strong>correo</strong> (selección + tandas
        de <strong>{MAX_PER_BATCH}</strong>) o por <strong>WhatsApp</strong> 1×1. Los
        badges <em>✉/WA</em> muestran cuántas veces ya se les invitó por cada canal —
        <strong> no los satures</strong>.
      </div>

      <BatchResult state={state} okNoun="reenviados" />

      {saturatedSelected > 0 && (
        <div
          role="alert"
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--warning)",
            background: "var(--warning-tint, var(--bg-elevated))",
            border: "1px solid var(--warning)",
            borderRadius: "var(--r-sm)",
            padding: "10px 13px",
          }}
        >
          <strong>{saturatedSelected}</strong> de los seleccionados ya recibieron{" "}
          <strong>{SPAM_THRESHOLD}+ correos</strong>. Reenviar de nuevo puede leerse
          como spam — revisa los badges <em>✉</em> antes de continuar.
        </div>
      )}

      <BatchToolbar
        search={search}
        setSearch={setSearch}
        placeholder="Buscar por nombre, Shipping Mark o correo…"
        selectedCount={selected.size}
        totalCount={cold.length}
        willProcess={willProcess}
        overflow={selectedIds.length - MAX_PER_BATCH}
        pending={pending}
        submitLabel="Reenviar"
        loadingLabel="Reenviando…"
        selectedIds={selectedIds}
        formAction={formAction}
      />

      {/* Filtro rápido + orden */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <Chip active={coldFilter === "all"} onClick={() => setColdFilter("all")}>
            Todos
          </Chip>
          <Chip active={coldFilter === "phone"} onClick={() => setColdFilter("phone")}>
            Con teléfono
          </Chip>
          <Chip active={coldFilter === "noWa"} onClick={() => setColdFilter("noWa")}>
            Nunca por WhatsApp
          </Chip>
          <Chip
            active={coldFilter === "saturated"}
            onClick={() => setColdFilter("saturated")}
          >
            Saturados ({SPAM_THRESHOLD}+)
          </Chip>
        </div>
        <div
          style={{
            display: "flex",
            gap: 5,
            flexWrap: "wrap",
            marginLeft: "auto",
            alignItems: "center",
          }}
        >
          <span style={{ font: "600 10px/1 var(--f-sans)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
            Orden
          </span>
          <Chip active={coldSort === "oldest"} onClick={() => setColdSort("oldest")}>
            Más viejos
          </Chip>
          <Chip active={coldSort === "least"} onClick={() => setColdSort("least")}>
            Menos invitados
          </Chip>
          <Chip active={coldSort === "most"} onClick={() => setColdSort("most")}>
            Más invitados
          </Chip>
        </div>
      </div>

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
            gridTemplateColumns: COLD_COLS,
            gap: "var(--s-3)",
            padding: "var(--s-3) var(--s-5)",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
            font: "700 10px/1 var(--f-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            alignItems: "center",
          }}
        >
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleAllFiltered}
            aria-label="Seleccionar todos los visibles"
            style={{ cursor: "pointer", width: 15, height: 15 }}
          />
          <span>Cliente</span>
          <span>Shipping Mark</span>
          <span>Teléfono</span>
          <span>Invitado</span>
          <span>WhatsApp</span>
        </div>

        {shown.length === 0 ? (
          <div
            style={{
              padding: "20px",
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              textAlign: "center",
            }}
          >
            Nada coincide con el filtro o la búsqueda.
          </div>
        ) : (
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {shown.map((c, i) => (
              <ColdRow
                key={c.id}
                c={c}
                on={selected.has(c.id)}
                onToggle={() => toggle(c.id)}
                first={i === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pestaña 3: sin contacto (captura de correo/teléfono) ────────────
const CONTACT_COLS = "minmax(130px,1.2fr) 100px minmax(150px,1.4fr) 130px 86px";

/** Una fila editable: carga correo/teléfono de un cliente sin contacto. */
function ContactCaptureRow({
  client,
  first,
}: {
  client: PortalContactlessClient;
  first: boolean;
}) {
  const [email, setEmail] = useState(client.email);
  const [phone, setPhone] = useState(client.phone);
  const [state, formAction, pending] = useActionState<
    ContactCaptureState,
    FormData
  >(updateClientContactAction, {});

  const saved = state.ok === true;
  const dirty = email.trim() !== client.email || phone.trim() !== client.phone;

  return (
    <form
      action={formAction}
      style={{
        display: "grid",
        gridTemplateColumns: CONTACT_COLS,
        gap: "var(--s-3)",
        padding: "9px 20px",
        borderTop: first ? 0 : "1px solid var(--border)",
        alignItems: "center",
        background: saved ? "var(--success-tint, var(--bg-elevated))" : "transparent",
      }}
    >
      <input type="hidden" name="client_id" value={client.id} />
      <span
        style={{
          font: "600 12.5px/1.3 var(--f-sans)",
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {client.name || "—"}
      </span>
      <code
        style={{ font: "600 11.5px/1.2 var(--f-mono)", color: "var(--wine-text)" }}
      >
        {client.markbox || "—"}
      </code>
      <input
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="correo@cliente.com"
        aria-label={`Correo de ${client.name}`}
        className="studio-input studio-input-mono"
        style={{ height: 30, font: "500 12px/1 var(--f-mono)" }}
      />
      <input
        name="phone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+58 4XX…"
        aria-label={`Teléfono de ${client.name}`}
        className="studio-input studio-input-mono"
        style={{ height: 30, font: "500 12px/1 var(--f-mono)" }}
      />
      <button
        type="submit"
        disabled={pending || (!dirty && !saved)}
        className="studio-btn studio-btn-ghost studio-btn-xs"
        title={state.error ?? undefined}
        style={{ justifySelf: "start" }}
      >
        {pending
          ? "Guardando…"
          : saved && !dirty
            ? "✓ Guardado"
            : state.error
              ? "Reintentar"
              : "Guardar"}
      </button>
    </form>
  );
}

function ContactlessPanel({ clients }: { clients: PortalContactlessClient[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.markbox.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q),
    );
  }, [clients, search]);

  if (clients.length === 0) {
    return (
      <EmptyState
        eyebrow="Todos con contacto"
        title="Ningún cliente quedó sin correo válido."
        description="Cuando llegue un cliente sin correo, aparecerá acá para capturarle el contacto y volverlo invitable."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          font: "500 12.5px/1.5 var(--f-sans)",
          color: "var(--ink)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--wine)",
          borderRadius: "var(--r-sm)",
          padding: "11px 14px",
        }}
      >
        Estos clientes no tienen correo válido, así que <strong>no se pueden
        invitar</strong>. Cárgales el correo (o teléfono) y, al guardar con un
        correo válido, pasan a la pestaña <strong>Sin invitar</strong>. Esto{" "}
        <strong>no</strong> manda correos.
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-2)",
          maxWidth: 420,
          height: 34,
          padding: "0 10px",
          background: "var(--bg-elevated)",
          borderRadius: "var(--r-sm)",
        }}
      >
        <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
          {Icon.search(13)}
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, Shipping Mark o teléfono…"
          aria-label="Buscar cliente sin contacto"
          style={{
            flex: 1,
            height: "100%",
            border: 0,
            background: "transparent",
            font: "500 12.5px/1 var(--f-sans)",
            color: "var(--ink)",
          }}
        />
      </div>

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
            gridTemplateColumns: CONTACT_COLS,
            gap: "var(--s-3)",
            padding: "var(--s-3) var(--s-5)",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
            font: "700 10px/1 var(--f-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            alignItems: "center",
          }}
        >
          <span>Cliente</span>
          <span>Shipping Mark</span>
          <span>Correo</span>
          <span>Teléfono</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div
            style={{
              padding: "20px",
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              textAlign: "center",
            }}
          >
            Nada coincide con tu búsqueda.
          </div>
        ) : (
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {filtered.map((c, i) => (
              <ContactCaptureRow key={c.id} client={c} first={i === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type Tab = "invite" | "cold" | "contact";

export function PortalBackfillSection({
  candidates,
  stats,
  coldInvitees,
  contactlessClients,
}: {
  candidates: PortalInviteCandidate[];
  stats: PortalAdoptionStats | null;
  coldInvitees: PortalColdInvitee[];
  contactlessClients: PortalContactlessClient[];
}) {
  const [tab, setTab] = useState<Tab>("invite");

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "invite", label: "Sin invitar", count: candidates.length },
    { id: "cold", label: "Invitados sin entrar", count: coldInvitees.length },
    { id: "contact", label: "Sin contacto", count: contactlessClients.length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {stats && <AdoptionFunnel stats={stats} />}
      {stats && <CampaignProgress stats={stats} />}
      {stats && stats.withoutEmail > 0 && (
        <div
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            padding: "10px 13px",
          }}
        >
          <strong style={{ color: "var(--ink)" }}>{stats.withoutEmail}</strong>{" "}
          clientes sin acceso NO tienen correo válido → no aparecen abajo. El
          equipo debe capturarles el correo (o teléfono) para poder invitarlos.
        </div>
      )}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Adopción del portal"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {tabs.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              style={{
                appearance: "none",
                border: 0,
                background: "transparent",
                cursor: "pointer",
                padding: "9px 14px",
                marginBottom: -1,
                borderBottom: `2px solid ${on ? "var(--wine)" : "transparent"}`,
                font: `${on ? 700 : 600} 12.5px/1 var(--f-sans)`,
                color: on ? "var(--ink)" : "var(--ink-soft)",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {t.label}
              <span
                style={{
                  font: "700 10.5px/1 var(--f-mono)",
                  color: on ? "var(--wine)" : "var(--ink-mute)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-pill)",
                  padding: "2px 7px",
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "invite" ? (
        <InviteCandidatesPanel candidates={candidates} />
      ) : tab === "cold" ? (
        <ColdInviteesPanel cold={coldInvitees} />
      ) : (
        <ContactlessPanel clients={contactlessClients} />
      )}
    </div>
  );
}
