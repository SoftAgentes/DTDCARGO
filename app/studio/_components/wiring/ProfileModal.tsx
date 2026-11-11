"use client";

/**
 * ProfileModal — 3 tabs (Datos personales · Contraseña · Preferencias).
 * SDD-0034 + wireup real a user_profiles (SDD-0024).
 *
 * Recibe initial data del user logueado por props (cargada en
 * `app/studio/(app)/layout.tsx` y propagada via WiringProvider).
 *
 * Tabs wireadas:
 *   - Datos personales: useActionState → updateMyProfileAction
 *   - Contraseña: supabase.auth.updateUser({ password }) client-side
 *   - Preferencias: useActionState → updateMyPreferencesAction
 */

import { useActionState, useEffect, useState, useTransition, type CSSProperties, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserSupabase } from "@/lib/db/client";
import {
  getMyDiscordUserIdAction,
  saveMyDiscordUserIdAction,
  linkTelegramAccountAction,
  unlinkTelegramAccountAction,
  updateMyPreferencesAction,
  updateMyProfileAction,
} from "@/app/studio/(app)/usuarios/actions";
import type { UserActionState } from "@/lib/studio/user-types";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";

export type ProfileTab = "profile" | "password" | "prefs";

export interface ProfileModalInitialData {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  locale: string | null;
  timezone: string | null;
  /** HQ operativa del user · fallback para "Cerca de ti" del Mobile ERP. */
  operatingLat: number | null;
  operatingLng: number | null;
  /** Telegram link state · set por webhook /api/telegram/webhook tras /start. */
  telegramChatId: string | null;
  telegramUsername: string | null;
  /** Bot username del tenant (sin @) · NEXT_PUBLIC_TELEGRAM_BOT_USERNAME. */
  telegramBotUsername: string | null;
}

const EMPTY_STATE: UserActionState = {};

export function ProfileModal({
  initialTab,
  initialData,
  onClose,
}: {
  initialTab: ProfileTab;
  initialData: ProfileModalInitialData;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ProfileTab>(initialTab);

  return (
    <ModalShell title="Mi perfil" onClose={onClose} width={620}>
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Secciones del perfil"
        className="studio-tabs"
        style={{ margin: "0 22px" }}
      >
        {(["profile", "password", "prefs"] as ProfileTab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={active}
              data-activa={active ? "true" : undefined}
              onClick={() => setTab(t)}
              className="studio-tab"
            >
              {t === "profile"
                ? "Datos personales"
                : t === "password"
                  ? "Contraseña"
                  : "Preferencias"}
            </button>
          );
        })}
      </div>

      <div
        style={{
          padding: "22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {tab === "profile" && (
          <ProfileTabContent initialData={initialData} onClose={onClose} />
        )}
        {tab === "password" && <PasswordTabContent onClose={onClose} />}
        {tab === "prefs" && (
          <PrefsTabContent initialData={initialData} onClose={onClose} />
        )}
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab · Datos personales
// ─────────────────────────────────────────────────────────────

function ProfileTabContent({
  initialData,
  onClose,
}: {
  initialData: ProfileModalInitialData;
  onClose: () => void;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialData.firstName ?? "");
  const [lastName, setLastName] = useState(initialData.lastName ?? "");
  const [phone, setPhone] = useState(initialData.phone ?? "");
  const [state, formAction, pending] = useActionState(
    updateMyProfileAction,
    EMPTY_STATE,
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      const t = setTimeout(onClose, 800);
      return () => clearTimeout(t);
    }
  }, [state.ok, router, onClose]);

  const displayName =
    [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim() ||
    initialData.email;

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Field
        label="Nombre"
        name="first_name"
        value={firstName}
        onChange={setFirstName}
        error={state.fieldErrors?.first_name}
        placeholder="Sam"
        disabled={pending}
      />
      <Field
        label="Apellido"
        name="last_name"
        value={lastName}
        onChange={setLastName}
        error={state.fieldErrors?.last_name}
        placeholder="Maan"
        disabled={pending}
      />
      <Field
        label="Email"
        name="email"
        value={initialData.email}
        onChange={() => {}}
        type="email"
        disabled
        hint="Tu email de inicio de sesión. No editable desde acá."
      />
      <Field
        label="Teléfono"
        name="phone"
        value={phone}
        onChange={setPhone}
        placeholder="+58 414 …"
        error={state.fieldErrors?.phone}
        disabled={pending}
      />

      <p
        style={{
          font: "500 11.5px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: 0,
        }}
      >
        Saludo en emails: <strong style={{ color: "var(--ink)" }}>Hola {displayName}</strong>.
        Sin nombre cargado, los emails usan tu dirección de correo.
      </p>

      {state.error && (
        <p
          style={{
            font: "600 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: 0,
          }}
        >
          {state.error}
        </p>
      )}
      {state.ok && (
        <p
          style={{
            font: "600 12px/1.4 var(--f-sans)",
            color: "var(--success)",
            margin: 0,
          }}
        >
          Guardado.
        </p>
      )}

      <Footer
        onClose={onClose}
        primary={
          <button
            type="submit"
            className="studio-btn studio-btn-primary"
            disabled={pending}
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        }
      />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab · Contraseña · client-side via supabase.auth.updateUser
// ─────────────────────────────────────────────────────────────

function PasswordTabContent({ onClose }: { onClose: () => void }) {
  const [pw2, setPw2] = useState("");
  const [pw3, setPw3] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const tooShort = pw2.length > 0 && pw2.length < 12;
  const mismatch = pw3.length > 0 && pw2 !== pw3;
  const canSubmit =
    pw2.length >= 12 && pw2 === pw3 && !pending && !success;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const supabase = createBrowserSupabase();
      const { error: updateErr } = await supabase.auth.updateUser({
        password: pw2,
      });
      if (updateErr) {
        setError(`No se pudo cambiar: ${updateErr.message}`);
        return;
      }
      setSuccess(true);
      setTimeout(onClose, 1200);
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div
        style={{
          padding: 12,
          background: "var(--warning-bg)",
          color: "var(--ink)",
          borderRadius: "var(--r-sm)",
          font: "500 12.5px/1.4 var(--f-sans)",
        }}
      >
        La contraseña debe tener mínimo <strong>12 caracteres</strong>. Mezcla
        mayúsculas, minúsculas, números y símbolos.
      </div>

      <Field
        label="Nueva contraseña"
        name="new_password"
        value={pw2}
        onChange={setPw2}
        type="password"
        error={tooShort ? "Mínimo 12 caracteres." : undefined}
        disabled={pending || success}
      />
      <Field
        label="Repite la nueva contraseña"
        name="repeat_password"
        value={pw3}
        onChange={setPw3}
        type="password"
        error={mismatch ? "Las contraseñas no coinciden." : undefined}
        disabled={pending || success}
      />

      {error && (
        <p
          style={{
            font: "600 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
      {success && (
        <p
          style={{
            font: "600 12px/1.4 var(--f-sans)",
            color: "var(--success)",
            margin: 0,
          }}
        >
          Contraseña actualizada. Tu sesión actual sigue activa.
        </p>
      )}

      <Footer
        onClose={onClose}
        primary={
          <button
            type="submit"
            className="studio-btn studio-btn-primary"
            disabled={!canSubmit}
          >
            {pending
              ? "Cambiando…"
              : success
                ? "Cambiada"
                : "Cambiar contraseña"}
          </button>
        }
      />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab · Preferencias · locale + timezone
// ─────────────────────────────────────────────────────────────

const LOCALE_OPTIONS = [
  { value: "es-VE", label: "Español (Venezuela)" },
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
];

function PrefsTabContent({
  initialData,
  onClose,
}: {
  initialData: ProfileModalInitialData;
  onClose: () => void;
}) {
  const [locale, setLocale] = useState(initialData.locale ?? "es-VE");
  const [timezone, setTimezone] = useState(
    initialData.timezone ?? "America/Caracas",
  );
  const [operatingLat, setOperatingLat] = useState(
    initialData.operatingLat != null ? String(initialData.operatingLat) : "",
  );
  const [operatingLng, setOperatingLng] = useState(
    initialData.operatingLng != null ? String(initialData.operatingLng) : "",
  );
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "loading" | "ok" | "denied" | "unavailable" | "error"
  >("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  const captureGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unavailable");
      setGeoError("Browser sin soporte de geolocation.");
      return;
    }
    setGeoStatus("loading");
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOperatingLat(pos.coords.latitude.toFixed(6));
        setOperatingLng(pos.coords.longitude.toFixed(6));
        setGeoStatus("ok");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus("denied");
          setGeoError("Permiso denegado por el navegador.");
        } else {
          setGeoStatus("error");
          setGeoError(err.message || "No se pudo obtener la ubicación.");
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const clearGps = () => {
    setOperatingLat("");
    setOperatingLng("");
    setGeoStatus("idle");
    setGeoError(null);
  };

  // Preferencias de notificación (SDD-0036 Fase 5) · se cargan client-side al
  // abrir (la fila puede no existir → defaults de la DB). Se submitean junto
  // con locale/timezone/GPS via updateMyPreferencesAction (hidden notif_section).
  const telegramLinked = !!initialData.telegramChatId;
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notif, setNotif] = useState({
    channel_inapp: true,
    channel_email: true,
    channel_telegram: false,
    notify_on_state_change: true,
    notify_on_admin_reply: true,
    notify_on_resolved: true,
    notify_on_critical: true,
    notify_on_portal_message: true,
    sound_enabled: true,
  });
  const setNotifField = (k: keyof typeof notif, v: boolean) =>
    setNotif((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createBrowserSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("user_notification_prefs")
          .select(
            "channel_inapp, channel_email, channel_telegram, notify_on_state_change, notify_on_admin_reply, notify_on_resolved, notify_on_critical, notify_on_portal_message, sound_enabled",
          )
          .eq("user_id", user.id)
          .maybeSingle();
        if (active && data) {
          setNotif((prev) => ({ ...prev, ...(data as typeof prev) }));
        }
      } catch {
        // Best-effort: si falla, quedan los defaults (nada roto).
      } finally {
        if (active) setNotifLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const [state, formAction, pending] = useActionState(
    updateMyPreferencesAction,
    EMPTY_STATE,
  );

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(onClose, 800);
      return () => clearTimeout(t);
    }
  }, [state.ok, onClose]);

  return (
    <form
      action={formAction}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div>
        <label className="studio-label">Idioma</label>
        <select
          name="locale"
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          className="studio-input"
          style={{ marginTop: 6 }}
          disabled={pending}
        >
          {LOCALE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <Field
        label="Zona horaria"
        name="timezone"
        value={timezone}
        onChange={setTimezone}
        placeholder="America/Caracas"
        error={state.fieldErrors?.timezone}
        disabled={pending}
        hint="Formato IANA · ej: America/Caracas, Asia/Shanghai, Europe/Madrid."
      />

      {/* HQ operativa · fallback para "Cerca de ti" del Mobile ERP */}
      <div
        style={{
          padding: "12px 14px",
          background: "var(--bg-elevated)",
          borderRadius: 7,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "600 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}>
              HQ operativa (GPS)
            </div>
            <div
              style={{
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 2,
              }}
            >
              Punto de referencia cuando el browser no autoriza geo · habilita
              &quot;Cerca de ti&quot; del Mobile ERP en escritorio o sin permiso.
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={captureGps}
              disabled={pending || geoStatus === "loading"}
              className="studio-btn studio-btn-ghost studio-btn-sm"
              style={{ whiteSpace: "nowrap" }}
            >
              {geoStatus === "loading" ? "Capturando…" : "Capturar GPS aquí"}
            </button>
            {(operatingLat || operatingLng) && (
              <button
                type="button"
                onClick={clearGps}
                disabled={pending}
                className="studio-btn studio-btn-ghost studio-btn-sm"
                style={{ color: "var(--ink-soft)" }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label
              className="studio-label"
              htmlFor="pm-operating_lat"
              style={{ display: "block", marginBottom: 6 }}
            >
              Latitud
            </label>
            <input
              id="pm-operating_lat"
              type="text"
              inputMode="decimal"
              name="operating_lat"
              value={operatingLat}
              onChange={(e) => setOperatingLat(e.target.value)}
              placeholder="10.182650"
              disabled={pending}
              autoComplete="off"
              className="studio-input studio-input-mono"
              style={
                state.fieldErrors?.operating_lat
                  ? { borderColor: "var(--danger)" }
                  : undefined
              }
            />
            {state.fieldErrors?.operating_lat && (
              <p
                style={{
                  font: "600 11px/1.3 var(--f-sans)",
                  color: "var(--danger)",
                  margin: "6px 0 0",
                }}
              >
                {state.fieldErrors.operating_lat}
              </p>
            )}
          </div>
          <div>
            <label
              className="studio-label"
              htmlFor="pm-operating_lng"
              style={{ display: "block", marginBottom: 6 }}
            >
              Longitud
            </label>
            <input
              id="pm-operating_lng"
              type="text"
              inputMode="decimal"
              name="operating_lng"
              value={operatingLng}
              onChange={(e) => setOperatingLng(e.target.value)}
              placeholder="-68.005250"
              disabled={pending}
              autoComplete="off"
              className="studio-input studio-input-mono"
              style={
                state.fieldErrors?.operating_lng
                  ? { borderColor: "var(--danger)" }
                  : undefined
              }
            />
            {state.fieldErrors?.operating_lng && (
              <p
                style={{
                  font: "600 11px/1.3 var(--f-sans)",
                  color: "var(--danger)",
                  margin: "6px 0 0",
                }}
              >
                {state.fieldErrors.operating_lng}
              </p>
            )}
          </div>
        </div>

        {geoStatus === "ok" && (
          <p
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--success)",
              margin: 0,
            }}
          >
            Coordenadas capturadas.
          </p>
        )}
        {geoError && (
          <p
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--danger)",
              margin: 0,
            }}
          >
            {geoError}
          </p>
        )}
      </div>

      {/* Push notifications · sub-section fuera del form porque tiene
          su propio submit (subscribe via fetch directo) */}
      <PushSubscriptionSection />

      {/* Telegram link · sub-section fuera del form (acciones independientes) */}
      <TelegramSection
        initialChatId={initialData.telegramChatId}
        initialUsername={initialData.telegramUsername}
        botUsername={initialData.telegramBotUsername}
      />

      {/* Discord · ID para las menciones en los canales de avisos (SDD-0606) */}
      <DiscordSection />

      {/* Notificaciones · canales + eventos (SDD-0036 Fase 5) */}
      <div
        style={{
          padding: "12px 14px",
          background: "var(--bg-elevated)",
          borderRadius: 7,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{ font: "600 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}
          >
            Notificaciones
          </div>
          <div
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 2,
            }}
          >
            Elige por qué canal y para qué eventos quieres que te avisemos de
            tus reportes. La campanita del Studio está activa por defecto.
          </div>
        </div>

        {notifLoaded && <input type="hidden" name="notif_section" value="1" />}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={NOTIF_SUBLABEL}>Canales</div>
          <PrefCheck
            name="channel_inapp"
            label="Campanita (in-app)"
            checked={notif.channel_inapp}
            onChange={(v) => setNotifField("channel_inapp", v)}
            disabled={pending || !notifLoaded}
          />
          <PrefCheck
            name="channel_email"
            label="Email"
            checked={notif.channel_email}
            onChange={(v) => setNotifField("channel_email", v)}
            disabled={pending || !notifLoaded}
          />
          <PrefCheck
            name="channel_telegram"
            label="Telegram"
            checked={telegramLinked && notif.channel_telegram}
            onChange={(v) => setNotifField("channel_telegram", v)}
            disabled={pending || !notifLoaded || !telegramLinked}
            hint={
              telegramLinked
                ? undefined
                : "Conecta tu Telegram arriba para activarlo."
            }
          />
          <div
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            El push del navegador se administra en su sección de arriba.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={NOTIF_SUBLABEL}>Eventos</div>
          <PrefCheck
            name="notify_on_state_change"
            label="Cambio de estado de mi reporte"
            checked={notif.notify_on_state_change}
            onChange={(v) => setNotifField("notify_on_state_change", v)}
            disabled={pending || !notifLoaded}
          />
          <PrefCheck
            name="notify_on_admin_reply"
            label="Respuesta del admin"
            checked={notif.notify_on_admin_reply}
            onChange={(v) => setNotifField("notify_on_admin_reply", v)}
            disabled={pending || !notifLoaded}
          />
          <PrefCheck
            name="notify_on_resolved"
            label="Mi reporte fue resuelto"
            checked={notif.notify_on_resolved}
            onChange={(v) => setNotifField("notify_on_resolved", v)}
            disabled={pending || !notifLoaded}
          />
          <PrefCheck
            name="notify_on_critical"
            label="Bug crítico nuevo (para admins)"
            checked={notif.notify_on_critical}
            onChange={(v) => setNotifField("notify_on_critical", v)}
            disabled={pending || !notifLoaded}
          />
          <PrefCheck
            name="notify_on_portal_message"
            label="Mensaje nuevo de un cliente (Soporte del portal)"
            checked={notif.notify_on_portal_message}
            onChange={(v) => setNotifField("notify_on_portal_message", v)}
            disabled={pending || !notifLoaded}
          />
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <PrefCheck
            name="sound_enabled"
            label="Sonido al recibir una notificación"
            checked={notif.sound_enabled}
            onChange={(v) => setNotifField("sound_enabled", v)}
            disabled={pending || !notifLoaded}
          />
        </div>
      </div>

      {state.error && (
        <p
          style={{
            font: "600 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: 0,
          }}
        >
          {state.error}
        </p>
      )}
      {state.ok && (
        <p
          style={{
            font: "600 12px/1.4 var(--f-sans)",
            color: "var(--success)",
            margin: 0,
          }}
        >
          Guardado.
        </p>
      )}

      <Footer
        onClose={onClose}
        primary={
          <button
            type="submit"
            className="studio-btn studio-btn-primary"
            disabled={pending}
          >
            {pending ? "Guardando…" : "Guardar preferencias"}
          </button>
        }
      />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Notificaciones · toggles de canal/evento (SDD-0036 Fase 5)
// ─────────────────────────────────────────────────────────────

const NOTIF_SUBLABEL: CSSProperties = {
  font: "700 10px/1 var(--f-sans)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  // --ink-soft (no --ink-mute): pasa WCAG AA sobre --bg-elevated y espeja el
  // .eyebrow del sistema (tokens.css). --ink-mute daba ~2.4:1 (falla).
  color: "var(--ink-soft)",
};

function PrefCheck({
  name,
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled && !checked ? 0.6 : 1,
      }}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ marginTop: 1, accentColor: "var(--wine)", cursor: "inherit" }}
      />
      <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span
          style={{ font: "500 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}
        >
          {label}
        </span>
        {hint && (
          <span
            style={{
              font: "500 11px/1.3 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// Push subscription section (sub-component de Preferencias)
// ─────────────────────────────────────────────────────────────

type PushStatus =
  | "loading"
  | "unsupported"
  | "blocked" // Notification.permission === "denied"
  | "off" // permitido pero sin subscription
  | "on" // subscribed
  | "pending" // mid-transition (toggle)
  | "error";

function PushSubscriptionSection() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check estado inicial al mount
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || typeof window === "undefined") return;
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("blocked");
        return;
      }

      // Estado real: hay subscription registrada?
      navigator.serviceWorker
        .getRegistration("/sw.js")
        .then((reg) => reg?.pushManager.getSubscription() ?? null)
        .then((sub) => {
          if (!cancelled) setStatus(sub ? "on" : "off");
        })
        .catch(() => {
          if (!cancelled) setStatus("off");
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnable = async () => {
    setErrorMsg(null);
    setStatus("pending");
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setErrorMsg("VAPID public key no configurada en env.");
        setStatus("error");
        return;
      }

      // 1. Permiso
      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
      }
      if (perm !== "granted") {
        setStatus("blocked");
        return;
      }

      // 2. Registrar SW (idempotente)
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // 3. Pedir subscription
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
        });
      }

      // 4. POST al endpoint
      const res = await fetch("/api/studio/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setStatus("on");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  const handleDisable = async () => {
    setErrorMsg(null);
    setStatus("pending");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      // Capturamos el endpoint ANTES de desuscribir para desactivar SOLO este
      // dispositivo (multi-dispositivo, SDD-0146): si el user tiene otro
      // dispositivo activo, su push sigue vivo.
      const endpoint = sub?.endpoint ?? null;
      if (sub) await sub.unsubscribe();

      const res = await fetch("/api/studio/push/subscribe", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setStatus("off");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-elevated)",
        borderRadius: 7,
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
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              font: "600 12.5px/1.2 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            Notificaciones push del navegador
          </div>
          <div
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 2,
            }}
          >
            Recibí avisos en tiempo real cuando hay un bug crítico nuevo o
            cuando el admin responde tu reporte.
          </div>
        </div>
        <PushStatusBadge status={status} />
      </div>

      {status === "off" && (
        <button
          type="button"
          onClick={handleEnable}
          className="studio-btn studio-btn-primary studio-btn-sm"
          style={{ alignSelf: "flex-start" }}
        >
          Activar notificaciones
        </button>
      )}
      {status === "on" && (
        <button
          type="button"
          onClick={handleDisable}
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ alignSelf: "flex-start" }}
        >
          Desactivar push
        </button>
      )}
      {status === "blocked" && (
        <p
          style={{
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--warning)",
            margin: 0,
          }}
        >
          El navegador bloqueó las notificaciones. Habilitalas desde el
          ícono de candado en la URL y vuelve a probar.
        </p>
      )}
      {status === "unsupported" && (
        <p
          style={{
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Este navegador no soporta Web Push (probablemente Safari iOS sin
          PWA o un browser muy viejo).
        </p>
      )}
      {errorMsg && (
        <p
          style={{
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: 0,
          }}
        >
          {errorMsg}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Telegram section (sub-component de Preferencias)
// ─────────────────────────────────────────────────────────────

function TelegramSection({
  initialChatId,
  initialUsername,
  botUsername,
}: {
  initialChatId: string | null;
  initialUsername: string | null;
  botUsername: string | null;
}) {
  const router = useRouter();
  const [chatId, setChatId] = useState(initialChatId);
  const [username, setUsername] = useState(initialUsername);
  const [pendingLink, startLinking] = useTransition();
  const [pendingUnlink, startUnlinking] = useTransition();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitingConfirm, setWaitingConfirm] = useState(false);

  const linked = !!chatId;
  const tgUrl =
    linkCode && botUsername
      ? `https://t.me/${botUsername}?start=${linkCode}`
      : null;

  const handleLink = () => {
    setError(null);
    setLinkCode(null);
    startLinking(async () => {
      const result = await linkTelegramAccountAction();
      if (!result.ok || !result.linkCode) {
        setError(result.error ?? "No se pudo generar el código.");
        return;
      }
      setLinkCode(result.linkCode);
      setWaitingConfirm(true);
    });
  };

  const handleUnlink = () => {
    setError(null);
    startUnlinking(async () => {
      const result = await unlinkTelegramAccountAction();
      if (!result.ok) {
        setError(result.error ?? "No se pudo desconectar.");
        return;
      }
      setChatId(null);
      setUsername(null);
      setLinkCode(null);
      setWaitingConfirm(false);
      router.refresh();
    });
  };

  // Poll periódico (cada 4s) cuando esperando confirm webhook
  // Refresca sólo el chat_id del user actual via re-fetch via router.refresh
  useEffect(() => {
    if (!waitingConfirm || linked) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [waitingConfirm, linked, router]);

  // Si en algún refresh el chat_id apareció (vía webhook), salimos del waiting
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && linked && waitingConfirm) {
        setWaitingConfirm(false);
        setLinkCode(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [linked, waitingConfirm]);

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-elevated)",
        borderRadius: 7,
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
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              font: "600 12.5px/1.2 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            Notificaciones por Telegram
          </div>
          <div
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 2,
            }}
          >
            Recibí los mismos avisos que por email, en tu chat de Telegram.
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 20,
            padding: "0 8px",
            background: linked ? "var(--success-bg)" : "var(--bg-base)",
            color: linked ? "var(--success)" : "var(--ink-soft)",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {linked ? "conectado" : "no conectado"}
        </span>
      </div>

      {linked && username && (
        <div
          style={{
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Cuenta: <strong style={{ color: "var(--ink)" }}>@{username}</strong>
        </div>
      )}

      {!linked && !linkCode && (
        <button
          type="button"
          onClick={handleLink}
          disabled={pendingLink || !botUsername}
          className="studio-btn studio-btn-primary studio-btn-sm"
          style={{ alignSelf: "flex-start" }}
          title={
            botUsername
              ? undefined
              : "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME no configurado en env"
          }
        >
          {pendingLink ? "Generando código…" : "Conectar Telegram"}
        </button>
      )}

      {linkCode && tgUrl && (
        <div
          style={{
            padding: "10px 12px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              font: "600 11.5px/1.3 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            Toca este link · vas a abrir Telegram y mandar /start automático:
          </div>
          <a
            href={tgUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              font: "700 12.5px/1 var(--f-mono)",
              color: "var(--wine-text)",
              wordBreak: "break-all",
            }}
          >
            {tgUrl}
          </a>
          <div
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            Código: <code style={{ font: "700 11px/1 var(--f-mono)" }}>{linkCode}</code>
            {waitingConfirm && " · esperando confirmación…"}
          </div>
        </div>
      )}

      {linked && (
        <button
          type="button"
          onClick={handleUnlink}
          disabled={pendingUnlink}
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ alignSelf: "flex-start" }}
        >
          {pendingUnlink ? "Desconectando…" : "Desconectar Telegram"}
        </button>
      )}

      {!botUsername && (
        <p
          style={{
            font: "500 11px/1.4 var(--f-sans)",
            color: "var(--warning)",
            margin: 0,
          }}
        >
          Bot no configurado · setear <code>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> en
          Vercel. Ver runbook docs/runbooks/setup-telegram-bot.md.
        </p>
      )}
      {error && (
        <p
          style={{
            font: "500 11px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function PushStatusBadge({ status }: { status: PushStatus }) {
  const config: Record<PushStatus, { label: string; bg: string; fg: string }> = {
    loading: { label: "…", bg: "var(--bg-base)", fg: "var(--ink-soft)" },
    unsupported: {
      label: "no soportado",
      bg: "var(--bg-base)",
      fg: "var(--ink-soft)",
    },
    blocked: {
      label: "bloqueado",
      bg: "var(--warning-bg, #FBF1DF)",
      fg: "var(--warning, #B8893A)",
    },
    off: {
      label: "inactivo",
      bg: "var(--bg-base)",
      fg: "var(--ink-soft)",
    },
    on: {
      label: "activo",
      bg: "var(--success-bg, #E5F4ED)",
      fg: "var(--success, #1F8A5B)",
    },
    pending: {
      label: "…",
      bg: "var(--bg-base)",
      fg: "var(--ink-soft)",
    },
    error: {
      label: "error",
      bg: "var(--danger-bg, #FCEDED)",
      fg: "var(--danger, #A8323E)",
    },
  };
  const c = config[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 8px",
        background: c.bg,
        color: c.fg,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {c.label}
    </span>
  );
}

/**
 * Convierte base64url (formato VAPID) a Uint8Array para pushManager.subscribe.
 * Standard helper.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes shared
// ─────────────────────────────────────────────────────────────

export function ModalShell({
  title,
  onClose,
  width = 560,
  children,
}: {
  title: string;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(panelRef, { onClose, pending: false });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: width,
          maxHeight: "92dvh",
          overflowY: "auto",
          background: "var(--bg-surface)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            className="studio-display"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="studio-btn studio-btn-ghost studio-btn-xs"
            style={{ color: "var(--ink-soft)" }}
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  disabled,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "password";
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label
        className="studio-label"
        htmlFor={`pm-${name}`}
        style={{ display: "block", marginBottom: 6 }}
      >
        {label}
      </label>
      <input
        id={`pm-${name}`}
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={
          type === "password"
            ? "new-password"
            : name === "email"
              ? "email"
              : "off"
        }
        className="studio-input"
        style={error ? { borderColor: "var(--danger)" } : undefined}
      />
      {error && (
        <p
          style={{
            font: "600 11.5px/1.3 var(--f-sans)",
            color: "var(--danger)",
            margin: "6px 0 0",
          }}
        >
          {error}
        </p>
      )}
      {hint && !error && (
        <p
          style={{
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "6px 0 0",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function Footer({
  onClose,
  primary,
}: {
  onClose: () => void;
  primary: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        marginTop: 4,
      }}
    >
      <button
        type="button"
        className="studio-btn studio-btn-ghost"
        onClick={onClose}
      >
        Cancelar
      </button>
      {primary}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Discord section (sub-component de Preferencias) · SDD-0606
//
// En Discord no hay chat privado: los avisos por persona son una mención en el
// canal. Acá cada quien pega su ID de usuario de Discord. Se lee al abrir (no
// viaja en el layout) para no depender de que la columna ya exista.
// ─────────────────────────────────────────────────────────────

function DiscordSection() {
  const [loaded, setLoaded] = useState(false);
  const [disponible, setDisponible] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startSaving] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getMyDiscordUserIdAction()
      .then((res) => {
        if (cancelled) return;
        setDisponible(res.disponible);
        setSaved(res.discordUserId);
        setValue(res.discordUserId ?? "");
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setDisponible(false);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const linked = !!saved;
  const dirty = value.trim() !== (saved ?? "");

  const save = (next: string) => {
    setError(null);
    setJustSaved(false);
    startSaving(async () => {
      const fd = new FormData();
      fd.set("discord_user_id", next);
      const res = await saveMyDiscordUserIdAction(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar.");
        return;
      }
      setSaved(res.discordUserId ?? null);
      setValue(res.discordUserId ?? "");
      setJustSaved(true);
    });
  };

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-elevated)",
        borderRadius: 7,
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
          gap: 12,
        }}
      >
        <div>
          <div style={{ font: "600 12.5px/1.2 var(--f-sans)", color: "var(--ink)" }}>
            Menciones en Discord
          </div>
          <div
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 2,
            }}
          >
            Los avisos que son para ti te mencionan en el canal del equipo. Sin tu
            ID, el aviso no te suena.
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 20,
            padding: "0 8px",
            background: linked ? "var(--success-bg)" : "var(--bg-base)",
            color: linked ? "var(--success)" : "var(--ink-soft)",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {!loaded ? "cargando…" : linked ? "enlazado" : "sin enlazar"}
        </span>
      </div>

      {loaded && !disponible ? (
        <div style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          Todavía no se puede guardar el ID desde aquí. Se activa cuando el
          administrador termine de preparar Discord.
        </div>
      ) : (
        <>
          <label
            htmlFor="profile-discord-user-id"
            className="studio-label"
            style={{ margin: 0 }}
          >
            Tu ID de usuario de Discord
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              id="profile-discord-user-id"
              className="studio-input studio-input-mono"
              inputMode="numeric"
              autoComplete="off"
              placeholder="123456789012345678"
              maxLength={20}
              value={value}
              disabled={!loaded || pending}
              onChange={(e) => {
                setValue(e.target.value.replace(/[^0-9]/g, ""));
                setJustSaved(false);
              }}
              aria-describedby="profile-discord-user-id-hint"
              style={{ flex: "1 1 200px", minWidth: 0 }}
            />
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-sm"
              disabled={!loaded || pending || !dirty}
              aria-busy={pending}
              onClick={() => save(value.trim())}
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
            {linked && (
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                disabled={pending}
                onClick={() => save("")}
              >
                Quitar
              </button>
            )}
          </div>
          <div
            id="profile-discord-user-id-hint"
            style={{ font: "500 11px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}
          >
            En Discord: Ajustes › Avanzado › activa «Modo desarrollador». Luego haz
            clic derecho sobre tu nombre y elige «Copiar ID de usuario». Es un
            número de 17 a 20 dígitos, no tu nombre de usuario.
          </div>
        </>
      )}

      <div role="status" aria-live="polite" style={{ minHeight: 0 }}>
        {justSaved && (
          <span style={{ font: "600 11.5px/1.4 var(--f-sans)", color: "var(--success)" }}>
            {saved ? "ID guardado" : "ID quitado"}
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
