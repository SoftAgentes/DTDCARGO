"use client";

/**
 * <AdminClient> — panel de administración del No-Olvidar (SDD-0025).
 *
 * 4 secciones: recuperaciones (aprobar/rechazar/ejecutar M-of-N), configuración
 * del módulo, versiones de KEK (+ rotar), y bitácora de acceso. Todas las
 * escrituras pasan por server actions que re-chequean admin en el server.
 *
 * Solo tokens var(--*). Copy en tuteo VE.
 */

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import {
  approveRecoveryAction,
  executeRecoveryAction,
  rejectRecoveryAction,
  rotateKekAction,
  updateNoOlvidarConfigAction,
} from "../../actions";
import {
  formatLastAccess,
  actionBadgeTone,
  actionLabel,
  kekStatusBadgeTone,
  recoveryStatusBadgeTone,
  recoveryStatusLabel,
  type NoOlvidarAccessLog,
  type NoOlvidarActionState,
  type NoOlvidarAuditAction,
  type NoOlvidarConfig,
  type NoOlvidarKekVersion,
  type NoOlvidarRecoveryRequest,
} from "@/lib/studio/no-olvidar-types";

export function AdminClient({
  requests,
  kekVersions,
  accessLog,
  config,
}: {
  currentUserId: string;
  requests: NoOlvidarRecoveryRequest[];
  kekVersions: NoOlvidarKekVersion[];
  accessLog: NoOlvidarAccessLog[];
  config: NoOlvidarConfig | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Section title="Recuperaciones" hint="Custodial M-of-N: dos admins aprueban antes de ejecutar el reset.">
        {requests.length === 0 ? (
          <Muted>No hay pedidos de recuperación.</Muted>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {requests.map((r) => (
              <RecoveryRow key={r.id} r={r} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Configuración" hint="Política de sesión, lockout y defensas de revelado.">
        <ConfigForm config={config} />
      </Section>

      <Section title="Llave maestra (KEK)" hint="Rotar re-envuelve el DEK de todos los items. Operación cara.">
        <KekPanel versions={kekVersions} />
      </Section>

      <Section title="Bitácora de acceso" hint="Registro inmutable (append-only). Últimos 40 eventos.">
        <AccessLogTable rows={accessLog} />
      </Section>
    </div>
  );
}

// ─── Recuperaciones ──────────────────────────────────────────

function RecoveryRow({ r }: { r: NoOlvidarRecoveryRequest }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [showExecute, setShowExecute] = useState(false);

  async function approve() {
    setBusy(true);
    setErr(null);
    const res = await approveRecoveryAction(r.id);
    setBusy(false);
    if (res.ok) router.refresh();
    else setErr(res.error ?? "No se pudo aprobar.");
  }

  const canApprove = r.status === "pending";
  const canExecute = r.status === "approved";
  const open = r.status === "pending" || r.status === "approved";

  return (
    <div style={{ padding: "12px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ font: "500 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>{r.reason}</span>
          <span style={{ font: "500 11.5px/1 var(--f-sans)", color: "var(--ink-mute)" }}>
            {formatLastAccess(r.created_at)} · solicitante {r.requester_user_id.slice(0, 8)}… · {r.approvals.length}/{r.approvals_required} aprobaciones
          </span>
        </div>
        <Badge tone={recoveryStatusBadgeTone(r.status)}>{recoveryStatusLabel(r.status)}</Badge>
      </div>

      {open && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canApprove && (
            <button type="button" onClick={approve} disabled={busy} className="studio-btn studio-btn-primary">
              {busy ? "Aprobando…" : "Aprobar"}
            </button>
          )}
          {canExecute && (
            <button type="button" onClick={() => setShowExecute((v) => !v)} className="studio-btn studio-btn-primary">
              Ejecutar reset
            </button>
          )}
          <button type="button" onClick={() => setShowReject((v) => !v)} className="studio-btn studio-btn-ghost">
            Rechazar
          </button>
        </div>
      )}

      {err && <span style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--danger)" }}>{err}</span>}
      {showReject && <RejectForm recoveryId={r.id} onDone={() => { setShowReject(false); router.refresh(); }} />}
      {showExecute && <ExecuteForm recoveryId={r.id} onDone={() => { setShowExecute(false); router.refresh(); }} />}
    </div>
  );
}

function RejectForm({ recoveryId, onDone }: { recoveryId: string; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState<NoOlvidarActionState, FormData>(rejectRecoveryAction, {});
  useEffect(() => { if (state.ok) onDone(); }, [state.ok, onDone]);
  return (
    <form action={formAction} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <input type="hidden" name="recovery_id" value={recoveryId} />
      <input name="reason" placeholder="Motivo del rechazo (opcional)" style={inlineInput} />
      <button type="submit" disabled={isPending} className="studio-btn studio-btn-ghost">
        {isPending ? "Rechazando…" : "Confirmar rechazo"}
      </button>
      <ErrorAlert state={state} compact />
    </form>
  );
}

function ExecuteForm({ recoveryId, onDone }: { recoveryId: string; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState<NoOlvidarActionState, FormData>(executeRecoveryAction, {});
  useEffect(() => { if (state.ok) onDone(); }, [state.ok, onDone]);
  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: "var(--r-sm)", background: "var(--surface-sel)" }}>
      <input type="hidden" name="recovery_id" value={recoveryId} />
      <span style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
        Nueva master password para el solicitante (mín. 12 caracteres, 3 de 4 tipos). Se la comunicas por un canal seguro y él la cambia al entrar.
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="master_password" type="text" minLength={12} required placeholder="Nueva master password" style={{ ...inlineInput, fontFamily: "var(--font-mono)" }} />
        <button type="submit" disabled={isPending} className="studio-btn studio-btn-primary">
          {isPending ? "Ejecutando…" : "Ejecutar recuperación"}
        </button>
      </div>
      <ErrorAlert state={state} compact />
    </form>
  );
}

// ─── Configuración ───────────────────────────────────────────

function ConfigForm({ config }: { config: NoOlvidarConfig | null }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<NoOlvidarActionState, FormData>(updateNoOlvidarConfigAction, {});
  useEffect(() => { if (state.ok) router.refresh(); }, [state.ok, router]);

  if (!config) return <Muted>La configuración aún no existe (¿migraciones sin aplicar?).</Muted>;

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <NumField label="Aprobaciones requeridas" name="recovery_approvals_required" value={config.recovery_approvals_required} min={1} max={5} />
        <NumField label="Timeout de sesión (min)" name="session_timeout_minutes" value={config.session_timeout_minutes} min={1} max={480} />
        <NumField label="Intentos antes de lockout" name="failed_attempts_lockout" value={config.failed_attempts_lockout} min={1} max={20} />
        <NumField label="Duración lockout (min)" name="lockout_minutes" value={config.lockout_minutes} min={1} max={1440} />
        <NumField label="Auto-limpiar clipboard (s)" name="clipboard_clear_seconds" value={config.clipboard_clear_seconds} min={5} max={300} />
        <NumField label="Auto-ocultar revelado (s)" name="reveal_auto_hide_seconds" value={config.reveal_auto_hide_seconds} min={1} max={60} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
        <ToggleField label="Exigir 2FA" name="require_2fa" checked={config.require_2fa} />
        <ToggleField label="Hold-to-reveal" name="hold_to_reveal" checked={config.hold_to_reveal} />
        <ToggleField label="Ocultar al perder foco" name="blur_on_window_blur" checked={config.blur_on_window_blur} />
        <ToggleField label="Watermark forense" name="forensic_watermark" checked={config.forensic_watermark} />
        <ToggleField label="Bloquear copiar (evento)" name="block_copy_event" checked={config.block_copy_event} />
        <ToggleField label="Revelado char-by-char" name="char_by_char_reveal" checked={config.char_by_char_reveal} />
      </div>

      <ErrorAlert state={state} compact />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={isPending} className="studio-btn studio-btn-primary">
          {isPending ? "Guardando…" : "Guardar configuración"}
        </button>
      </div>
    </form>
  );
}

// ─── KEK ─────────────────────────────────────────────────────

function KekPanel({ versions }: { versions: NoOlvidarKekVersion[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function rotate() {
    if (!window.confirm("¿Rotar la KEK? Re-envuelve el DEK de TODOS los items. No deshacible.")) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await rotateKekAction();
    setBusy(false);
    if (res.ok) {
      setMsg(`KEK rotada. ${res.itemsReencrypted ?? 0} items re-envueltos.`);
      router.refresh();
    } else {
      setErr(res.error ?? "No se pudo rotar la KEK.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {versions.length === 0 ? (
        <Muted>No hay versiones de KEK (¿KEK sin crear? — runbook §2).</Muted>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {versions.map((v) => (
            <div key={v.version} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
              <span style={{ font: "700 13px/1 var(--font-mono)", color: "var(--ink)" }}>v{v.version}</span>
              <Badge tone={kekStatusBadgeTone(v.status)} size="sm">{v.status}</Badge>
              <span style={{ font: "500 11.5px/1 var(--f-sans)", color: "var(--ink-mute)", marginLeft: "auto" }}>
                activada {formatLastAccess(v.activated_at)}
              </span>
            </div>
          ))}
        </div>
      )}
      {msg && <span style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--success)" }}>{msg}</span>}
      {err && <span style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--danger)" }}>{err}</span>}
      <div>
        <button type="button" onClick={rotate} disabled={busy} className="studio-btn studio-btn-ghost">
          {busy ? "Rotando…" : "Rotar KEK"}
        </button>
      </div>
    </div>
  );
}

// ─── Bitácora ────────────────────────────────────────────────

function AccessLogTable({ rows }: { rows: NoOlvidarAccessLog[] }) {
  if (rows.length === 0) return <Muted>Sin eventos registrados.</Muted>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {rows.map((row) => (
        <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <Badge tone={actionBadgeTone(row.action as NoOlvidarAuditAction)} size="sm">
            {actionLabel(row.action as NoOlvidarAuditAction)}
          </Badge>
          <span style={{ font: "500 11.5px/1 var(--f-sans)", color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.user_id.slice(0, 8)}… {row.item_id ? `· item ${row.item_id.slice(0, 8)}…` : ""}
          </span>
          <span style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-mute)", marginLeft: "auto", whiteSpace: "nowrap" }}>
            {row.ip_address ?? "—"} · {formatLastAccess(row.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Primitivas locales ──────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <h2 className="studio-display" style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}>{title}</h2>
        {hint && <span style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-mute)", margin: 0 }}>{children}</p>;
}

function NumField({ label, name, value, min, max }: { label: string; name: string; value: number; min: number; max: number }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ font: "600 12px/1 var(--f-sans)", color: "var(--ink-mute)" }}>{label}</span>
      <input
        name={name}
        type="number"
        defaultValue={value}
        min={min}
        max={max}
        style={{ padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-sel)", color: "var(--ink)", font: "400 14px/1 var(--f-sans)" }}
      />
    </label>
  );
}

function ToggleField({ label, name, checked }: { label: string; name: string; checked: boolean }) {
  // Controlado + hidden on/off: un checkbox desmarcado NO se envía en FormData,
  // y la action lee "ausente" como "sin cambio" → sin esto no se podría APAGAR.
  const [on, setOn] = useState(checked);
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0" }}>
      <input type="hidden" name={name} value={on ? "on" : "off"} />
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
      <span style={{ font: "500 13px/1 var(--f-sans)", color: "var(--ink)" }}>{label}</span>
    </label>
  );
}

const inlineInput: React.CSSProperties = {
  flex: "1 1 200px",
  minWidth: 160,
  padding: "8px 10px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--border)",
  background: "var(--surface-sel)",
  color: "var(--ink)",
  font: "400 13px/1 var(--f-sans)",
};
