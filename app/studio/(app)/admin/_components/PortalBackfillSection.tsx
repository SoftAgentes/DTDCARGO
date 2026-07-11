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
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
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
  type BulkInviteState,
  type ContactCaptureState,
} from "../portal-backfill-actions";

const MAX_PER_BATCH = 20;

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
              color: "var(--wine)",
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
          <strong style={{ color: "var(--wine)" }}>{pctDone}%</strong> · faltan{" "}
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
        ? ` ${state.emailFailed} con el correo fallido (reintentá).`
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

/** Badge compacto de conteo de invitaciones por canal (anti-spam). */
function InviteCountBadge({
  label,
  count,
  title,
}: {
  label: string;
  count: number;
  title?: string;
}) {
  const on = count > 0;
  return (
    <span
      title={title}
      style={{
        font: "700 10px/1 var(--f-mono)",
        color: on ? "var(--wine)" : "var(--ink-mute)",
        background: "var(--bg-elevated)",
        border: `1px solid ${on ? "var(--wine)" : "var(--border)"}`,
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
    `Entra directo a tu cuenta con este enlace (es de un solo uso y vence pronto):`,
    link,
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
          style={{ font: "600 11.5px/1.2 var(--f-mono)", color: "var(--wine)" }}
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
            font: "500 12px/1.3 var(--f-mono)",
            color: c.phone ? "var(--ink-soft)" : "var(--ink-mute)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {fmtPhone(c.phone)}
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
              style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-mute)" }}
            >
              sin teléfono
            </span>
          )}
        </span>
      </div>
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
              entra con un clic, es de un solo uso y vence pronto.
            </span>
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
  const [state, formAction, pending] = useActionState<BulkInviteState, FormData>(
    bulkInvitePortalAction,
    {},
  );

  useEffect(() => {
    if (state.ok) setSelected(new Set());
  }, [state.ok]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.markbox.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [candidates, search]);

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
              color: "var(--ink-mute)",
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
                    ? `Último correo: ${fmtDate(c.lastEmailInviteAt)}`
                    : "Invitaciones por correo"
                }
              />
              <InviteCountBadge
                label="WA"
                count={c.whatsappInvites}
                title={
                  c.lastWhatsappInviteAt
                    ? `Último WhatsApp: ${fmtDate(c.lastWhatsappInviteAt)}`
                    : "Invitaciones por WhatsApp"
                }
              />
            </span>
          )}
        </span>
        <code
          style={{ font: "600 11.5px/1.2 var(--f-mono)", color: "var(--wine)" }}
        >
          {c.markbox || "—"}
        </code>
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
            ) : (
              <button
                type="button"
                onClick={genWhatsApp}
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
              style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-mute)" }}
            >
              sin teléfono
            </span>
          )}
        </span>
      </div>
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

  useEffect(() => {
    if (state.ok) setSelected(new Set());
  }, [state.ok]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cold;
    return cold.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.markbox.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [cold, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));

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
      if (allFilteredSelected) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
      return next;
    });

  const selectedIds = [...selected];
  const willProcess = Math.min(selectedIds.length, MAX_PER_BATCH);

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

        {filtered.length === 0 ? (
          <div
            style={{
              padding: "20px",
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-mute)",
              textAlign: "center",
            }}
          >
            Nada coincide con tu búsqueda.
          </div>
        ) : (
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {filtered.map((c, i) => (
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
        style={{ font: "600 11.5px/1.2 var(--f-mono)", color: "var(--wine)" }}
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
              color: "var(--ink-mute)",
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
