"use client";

/**
 * NotificationsClient · config de avisos al cliente (SDD-0156 · Slice B).
 *
 * Una fila editable por evento del journey (canal · cuándo · texto · visibilidad).
 * Scope: reglas por defecto del tenant, o override para un cliente puntual. Cada
 * fila es un form con su server action (upsert). Los eventos de Slice D (máquinas
 * paralelas) se muestran informativos hasta que se cablee su gancho.
 */
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CLIENT_JOURNEY_EVENTS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_ANCHORS,
  TEMPLATE_KEYS,
  DEFAULT_EVENT_COPY,
  formatOffset,
  type ClientNotificationRule,
  type JourneyEventDef,
  type NotificationChannel,
  type NotificationAnchor,
} from "@/lib/studio/notifications/client-notification-types";
import {
  upsertRuleAction,
  deleteRuleAction,
  restoreDefaultsAction,
  type RuleActionState,
} from "../actions";

interface ClientLite {
  id: string;
  markbox: string | null;
  name: string | null;
}
interface Props {
  defaultRules: ClientNotificationRule[];
  overrideRules: ClientNotificationRule[];
  clients: ClientLite[];
  selectedClientId: string | null;
}

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  email: "Solo correo",
  push: "Solo push",
  both: "Correo + push",
  none: "Silenciar",
};
const ANCHOR_LABEL: Record<NotificationAnchor, string> = {
  event: "el hito ocurre",
  eta: "el ETA de la naviera",
  etd: "la salida (ETD)",
};

const SLICE_A = CLIENT_JOURNEY_EVENTS.filter((e) => e.slice === "A");
const SLICE_D = CLIENT_JOURNEY_EVENTS.filter((e) => e.slice === "D" && e.gancho !== "pendiente");
// Catalogados sin gancho (SDD-0543 `carga_en_camino`): no van con los que «ya
// disparan», porque todavía nada los emite.
const SIN_GANCHO = CLIENT_JOURNEY_EVENTS.filter((e) => e.gancho === "pendiente");

export function NotificationsClient({
  defaultRules,
  overrideRules,
  clients,
  selectedClientId,
}: Props) {
  const router = useRouter();
  const overrideMode = !!selectedClientId;

  const defaultByEvent = useMemo(
    () => indexByEvent(defaultRules),
    [defaultRules],
  );
  const overrideByEvent = useMemo(
    () => indexByEvent(overrideRules),
    [overrideRules],
  );

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}>
      <header>
        <h1
          style={{
            font: "700 22px/1.2 var(--font-sans, 'Archivo')",
            color: "var(--ink)",
            margin: "0 0 6px",
          }}
        >
          Notificaciones al cliente
        </h1>
        <p
          style={{
            font: "400 13.5px/1.55 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: 720,
          }}
        >
          Por cada momento del viaje China → Venezuela decide{" "}
          <strong style={{ color: "var(--ink)" }}>por qué canal</strong> avisar,{" "}
          <strong style={{ color: "var(--ink)" }}>cuándo</strong> (al instante o con
          un corrimiento) y si el estado se{" "}
          <strong style={{ color: "var(--ink)" }}>muestra u oculta</strong> en el
          portal. Ejemplo: en aduana, ocultar “llegó” y disparar el cobro anticipado.
        </p>
      </header>

      {/* Scope switcher */}
      <ScopeSwitcher
        clients={clients}
        selectedClientId={selectedClientId}
        onChange={(id) =>
          router.push(id ? `/studio/admin/notificaciones?client=${id}` : "/studio/admin/notificaciones")
        }
      />

      {overrideMode && (
        <div
          style={{
            background: "var(--bg-subtle, var(--neutral-bg))",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "var(--s-3) var(--s-4)",
            font: "500 12.5px/1.5 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
          }}
        >
          Editando overrides de{" "}
          <strong style={{ color: "var(--ink)" }}>
            {selectedClient?.markbox ?? "cliente"}
            {selectedClient?.name ? ` · ${selectedClient.name}` : ""}
          </strong>
          . Los eventos sin override usan la regla por defecto del negocio.
        </div>
      )}

      {/* Reglas editables (Slice A) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        {SLICE_A.map((ev) => (
          <RuleRow
            key={ev.key}
            event={ev}
            defaultRule={defaultByEvent.get(ev.key) ?? null}
            overrideRule={overrideByEvent.get(ev.key) ?? null}
            overrideMode={overrideMode}
            selectedClientId={selectedClientId}
          />
        ))}
      </div>

      {!overrideMode && <RestoreDefaults />}

      {/* Slice D (informativo) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
        <h2
          style={{
            font: "600 13px/1.2 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            margin: "var(--s-2) 0 0",
          }}
        >
          Próximamente · máquinas paralelas
        </h2>
        <p
          style={{
            font: "400 12px/1.5 var(--font-sans, 'Archivo')",
            color: "var(--ink-mute, var(--ink-soft))",
            margin: 0,
            maxWidth: 720,
          }}
        >
          Estos avisos (consolidado, ETA de la naviera, recepción en Venezuela)
          se configuran igual y ya disparan desde su gancho en la operación. El
          “va llegando” respecto al ETA vive acá.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {SLICE_D.map((ev) => (
            <span
              key={ev.key}
              title={ev.hint}
              style={{
                font: "500 11.5px/1 var(--font-sans, 'Archivo')",
                color: "var(--ink-soft)",
                background: "var(--neutral-bg)",
                border: "1px dashed var(--border-strong)",
                borderRadius: 999,
                padding: "6px 12px",
              }}
            >
              {ev.label}
            </span>
          ))}
        </div>
        {SIN_GANCHO.length > 0 ? (
          <>
            <p
              style={{
                font: "400 12px/1.5 var(--font-sans, 'Archivo')",
                color: "var(--ink-mute, var(--ink-soft))",
                margin: "var(--s-2) 0 0",
                maxWidth: 720,
              }}
            >
              Catalogados pero <strong>todavía sin gancho</strong>: se pueden configurar,
              pero nada los dispara hasta que se cablee su disparo.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {SIN_GANCHO.map((ev) => (
                <span
                  key={ev.key}
                  title={ev.hint}
                  style={{
                    font: "500 11.5px/1 var(--font-sans, 'Archivo')",
                    color: "var(--ink-mute, var(--ink-soft))",
                    background: "transparent",
                    border: "1px dashed var(--border-strong)",
                    borderRadius: 999,
                    padding: "6px 12px",
                  }}
                >
                  {ev.label} · aún no dispara
                </span>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Scope switcher ───────────────────────────────────────────
function ScopeSwitcher({
  clients,
  selectedClientId,
  onChange,
}: {
  clients: ClientLite[];
  selectedClientId: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={!selectedClientId}
        style={pillStyle(!selectedClientId)}
      >
        Por defecto (todos)
      </button>
      <span style={{ color: "var(--ink-mute, var(--ink-soft))", font: "500 12px/1 var(--font-sans)" }}>
        o override para un cliente:
      </span>
      <select
        value={selectedClientId ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        style={{
          font: "500 12.5px/1 var(--font-sans, 'Archivo')",
          color: "var(--ink)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 8,
          padding: "8px 10px",
          minWidth: 220,
        }}
      >
        <option value="">— elegir cliente —</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.markbox ?? "s/markbox"}
            {c.name ? ` · ${c.name}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Fila de regla ────────────────────────────────────────────
function RuleRow({
  event,
  defaultRule,
  overrideRule,
  overrideMode,
  selectedClientId,
}: {
  event: JourneyEventDef;
  defaultRule: ClientNotificationRule | null;
  overrideRule: ClientNotificationRule | null;
  overrideMode: boolean;
  selectedClientId: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<RuleActionState, FormData>(
    upsertRuleAction,
    {},
  );

  // Baseline: en override mode, el override si existe; si no, el default como
  // punto de partida (marcado "heredado"). En default mode, el default.
  const base = overrideMode ? overrideRule ?? defaultRule : defaultRule;
  const inherited = overrideMode && !overrideRule;

  const [channel, setChannel] = useState<NotificationChannel>(
    (base?.channel as NotificationChannel) ?? "none",
  );
  const [anchor, setAnchor] = useState<NotificationAnchor>(
    (base?.anchor as NotificationAnchor) ?? "event",
  );
  const initOffset = offsetToParts(base?.offset_minutes ?? 0);
  const [offsetValue, setOffsetValue] = useState(initOffset.value);
  const [offsetUnit, setOffsetUnit] = useState(initOffset.unit);
  const [offsetDir, setOffsetDir] = useState(initOffset.dir);
  const [visible, setVisible] = useState(base?.visible_in_portal ?? true);
  const [active, setActive] = useState(base?.active ?? true);
  const [templateKey, setTemplateKey] = useState(base?.template_key ?? "");
  const [customOpen, setCustomOpen] = useState(
    !!(base?.custom_title || base?.custom_body),
  );
  const [customTitle, setCustomTitle] = useState(base?.custom_title ?? "");
  const [customBody, setCustomBody] = useState(base?.custom_body ?? "");

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const offsetMinutes = partsToMinutes(offsetValue, offsetUnit, offsetDir);
  const defaultCopy = DEFAULT_EVENT_COPY[event.key];

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "var(--s-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3)",
        opacity: pending ? 0.6 : 1,
        transition: "opacity var(--dur-fast, 180ms)",
      }}
    >
      <input type="hidden" name="trigger_event" value={event.key} />
      <input type="hidden" name="offset_minutes" value={String(offsetMinutes)} />
      {overrideRule?.id && <input type="hidden" name="id" value={overrideRule.id} />}
      {!overrideRule?.id && defaultRule?.id && !overrideMode && (
        <input type="hidden" name="id" value={defaultRule.id} />
      )}
      {selectedClientId && (
        <input type="hidden" name="client_id" value={selectedClientId} />
      )}
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="anchor" value={anchor} />
      <input type="hidden" name="template_key" value={templateKey} />
      {visible && <input type="hidden" name="visible_in_portal" value="on" />}
      {active && <input type="hidden" name="active" value="on" />}
      {customOpen && (
        <>
          <input type="hidden" name="custom_title" value={customTitle} />
          <input type="hidden" name="custom_body" value={customBody} />
        </>
      )}

      {/* Encabezado del evento */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <div style={{ font: "600 14px/1.3 var(--font-sans, 'Archivo')", color: "var(--ink)" }}>
            {event.label}
          </div>
          <div style={{ font: "400 11.5px/1.4 var(--font-sans)", color: "var(--ink-soft)" }}>
            {event.hint}
          </div>
        </div>
        {inherited && (
          <span
            style={{
              font: "500 10.5px/1 var(--font-sans)",
              color: "var(--ink-soft)",
              background: "var(--neutral-bg)",
              borderRadius: 999,
              padding: "5px 9px",
              whiteSpace: "nowrap",
            }}
          >
            heredado del default
          </span>
        )}
      </div>

      {/* Controles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", alignItems: "flex-end" }}>
        <Field label="Canal">
          <select value={channel} onChange={(e) => setChannel(e.target.value as NotificationChannel)} style={selectStyle}>
            {NOTIFICATION_CHANNELS.map((c) => (
              <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
            ))}
          </select>
        </Field>

        {channel !== "none" && (
          <>
            <Field label="Cuándo">
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="number"
                  min={0}
                  value={offsetValue}
                  onChange={(e) => setOffsetValue(Math.max(0, Number.parseInt(e.target.value || "0", 10)))}
                  style={{ ...selectStyle, width: 64 }}
                  aria-label="cantidad"
                />
                <select value={offsetUnit} onChange={(e) => setOffsetUnit(e.target.value as OffsetUnit)} style={selectStyle} aria-label="unidad">
                  <option value="min">min</option>
                  <option value="hour">horas</option>
                  <option value="day">días</option>
                </select>
                <select value={offsetDir} onChange={(e) => setOffsetDir(e.target.value as OffsetDir)} style={selectStyle} aria-label="dirección">
                  <option value="after">después de</option>
                  <option value="before">antes de</option>
                </select>
                <select value={anchor} onChange={(e) => setAnchor(e.target.value as NotificationAnchor)} style={selectStyle} aria-label="ancla">
                  {NOTIFICATION_ANCHORS.map((a) => (
                    <option key={a} value={a}>{ANCHOR_LABEL[a]}</option>
                  ))}
                </select>
              </div>
              <div style={{ font: "400 10.5px/1.3 var(--font-mono, 'JetBrains Mono')", color: "var(--ink-soft)", marginTop: 4 }}>
                {formatOffset(offsetMinutes)} · respecto a {ANCHOR_LABEL[anchor]}
              </div>
            </Field>

            <Toggle label="Visible en el portal" checked={visible} onChange={setVisible} />
          </>
        )}

        <Toggle label="Activa" checked={active} onChange={setActive} />
      </div>

      {/* Texto */}
      {channel !== "none" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "center", flexWrap: "wrap" }}>
            <Field label="Texto">
              <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} style={selectStyle}>
                <option value="">Default del evento</option>
                {TEMPLATE_KEYS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={() => setCustomOpen((v) => !v)}
              style={{ ...pillStyle(customOpen), marginTop: 18 }}
            >
              {customOpen ? "Quitar texto propio" : "Escribir texto propio"}
            </button>
          </div>
          {!customOpen && defaultCopy && !templateKey && (
            <div style={{ font: "400 11.5px/1.5 var(--font-sans)", color: "var(--ink-soft)" }}>
              “{defaultCopy.title}” — {defaultCopy.body}
            </div>
          )}
          {customOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Título del aviso"
                style={{ ...selectStyle, width: "100%" }}
              />
              <textarea
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                placeholder="Cuerpo del aviso"
                rows={2}
                style={{ ...selectStyle, width: "100%", resize: "vertical" }}
              />
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
        <div style={{ font: "500 11.5px/1.4 var(--font-sans)", color: state.error ? "var(--danger)" : "var(--success)" }}>
          {state.error ? state.error : state.ok ? "Guardado ✓" : ""}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {overrideMode && overrideRule?.id && (
            <RemoveOverride ruleId={overrideRule.id} />
          )}
          <button type="submit" disabled={pending} style={primaryBtn(pending)}>
            {pending ? "Guardando…" : overrideMode ? "Guardar override" : "Guardar"}
          </button>
        </div>
      </div>
    </form>
  );
}

function RemoveOverride({ ruleId }: { ruleId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<RuleActionState, FormData>(
    deleteRuleAction,
    {},
  );
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);
  return (
    <form action={(fd) => startTransition(() => formAction(fd))}>
      <input type="hidden" name="id" value={ruleId} />
      <button type="submit" disabled={pending} style={ghostBtn(pending)}>
        {pending ? "…" : "Quitar override"}
      </button>
    </form>
  );
}

function RestoreDefaults() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<RuleActionState, FormData>(
    restoreDefaultsAction,
    {},
  );
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);
  return (
    <form action={(fd) => startTransition(() => formAction(fd))}>
      <button type="submit" disabled={pending} style={ghostBtn(pending)}>
        {pending ? "Restaurando…" : "Restaurar reglas por defecto faltantes"}
      </button>
    </form>
  );
}

// ── Presentacionales ─────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ font: "600 10.5px/1 var(--font-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingBottom: 6 }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, flexShrink: 0,
          background: checked ? "var(--success)" : "var(--neutral-bg)",
          border: `1px solid ${checked ? "var(--success)" : "var(--border-strong)"}`,
          borderRadius: 11, padding: 0, position: "relative", cursor: "pointer",
          transition: "background var(--dur-fast) var(--ease)",
        }}
      >
        <span aria-hidden style={{ position: "absolute", top: 1, left: checked ? 19 : 1, width: 18, height: 18, borderRadius: "50%", background: "var(--bg-surface)", boxShadow: "var(--shadow-xs)", transition: "left var(--dur-fast) var(--ease)" }} />
      </button>
      <span style={{ font: "500 12px/1 var(--font-sans)", color: "var(--ink)" }}>{label}</span>
    </label>
  );
}

// ── estilos + helpers de offset ──────────────────────────────
const selectStyle: React.CSSProperties = {
  font: "500 12.5px/1 var(--font-sans, 'Archivo')",
  color: "var(--ink)",
  background: "var(--bg-surface)",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  padding: "8px 10px",
};
function pillStyle(activePill: boolean): React.CSSProperties {
  return {
    font: "600 12px/1 var(--font-sans, 'Archivo')",
    color: activePill ? "#fff" : "var(--ink)",
    background: activePill ? "var(--wine)" : "var(--bg-surface)",
    border: `1px solid ${activePill ? "var(--wine)" : "var(--border-strong)"}`,
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
  };
}
function primaryBtn(pending: boolean): React.CSSProperties {
  return {
    font: "600 12.5px/1 var(--font-sans, 'Archivo')",
    color: "#fff",
    background: "var(--wine)",
    border: "1px solid var(--wine)",
    borderRadius: 8,
    padding: "9px 16px",
    cursor: pending ? "wait" : "pointer",
  };
}
function ghostBtn(pending: boolean): React.CSSProperties {
  return {
    font: "500 12px/1 var(--font-sans, 'Archivo')",
    color: "var(--ink-soft)",
    background: "transparent",
    border: "1px solid var(--border-strong)",
    borderRadius: 8,
    padding: "9px 14px",
    cursor: pending ? "wait" : "pointer",
  };
}

type OffsetUnit = "min" | "hour" | "day";
type OffsetDir = "after" | "before";
function indexByEvent(rules: ClientNotificationRule[]): Map<string, ClientNotificationRule> {
  const m = new Map<string, ClientNotificationRule>();
  for (const r of rules) m.set(r.trigger_event, r);
  return m;
}
function offsetToParts(minutes: number): { value: number; unit: OffsetUnit; dir: OffsetDir } {
  const dir: OffsetDir = minutes < 0 ? "before" : "after";
  const abs = Math.abs(minutes);
  if (abs === 0) return { value: 0, unit: "min", dir: "after" };
  if (abs % (60 * 24) === 0) return { value: abs / (60 * 24), unit: "day", dir };
  if (abs % 60 === 0) return { value: abs / 60, unit: "hour", dir };
  return { value: abs, unit: "min", dir };
}
function partsToMinutes(value: number, unit: OffsetUnit, dir: OffsetDir): number {
  const factor = unit === "day" ? 60 * 24 : unit === "hour" ? 60 : 1;
  const mag = Math.max(0, value) * factor;
  return dir === "before" ? -mag : mag;
}
