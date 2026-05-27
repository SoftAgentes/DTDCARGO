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

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserSupabase } from "@/lib/db/client";
import {
  linkTelegramAccountAction,
  unlinkTelegramAccountAction,
  updateMyPreferencesAction,
  updateMyProfileAction,
} from "@/app/studio/(app)/usuarios/actions";
import type { UserActionState } from "@/lib/studio/user-types";

export type ProfileTab = "profile" | "password" | "prefs";

export interface ProfileModalInitialData {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  locale: string | null;
  timezone: string | null;
  /** HQ operativa del user · fallback para "Cerca tuyo" del Mobile ERP. */
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
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--border)",
          padding: "0 22px",
        }}
      >
        {(["profile", "password", "prefs"] as ProfileTab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              role="tab"
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: "12px 14px",
                background: "transparent",
                border: 0,
                borderBottom: active
                  ? "2px solid var(--wine)"
                  : "2px solid transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                font: `${active ? "700" : "500"} 13px/1 var(--f-sans)`,
                cursor: "pointer",
                marginBottom: -1,
              }}
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
          color: "var(--ink-mute)",
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
        La contraseña debe tener mínimo <strong>12 caracteres</strong>. Mezclá
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
        label="Repetí la nueva contraseña"
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

      {/* HQ operativa · fallback para "Cerca tuyo" del Mobile ERP */}
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
              "Cerca tuyo" del Mobile ERP en escritorio o sin permiso.
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
                style={{ color: "var(--ink-mute)" }}
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

      <p
        style={{
          font: "500 11.5px/1.4 var(--f-sans)",
          color: "var(--ink-mute)",
          margin: 0,
        }}
      >
        Email, push browser y Telegram se disparan automáticamente
        cuando hay un bug crítico nuevo, cambio de estado en tus
        reportes o respuesta del admin. Activá los canales que
        querés recibir.
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
            {pending ? "Guardando…" : "Guardar preferencias"}
          </button>
        }
      />
    </form>
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
    if (typeof window === "undefined") return;
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
        setStatus(sub ? "on" : "off");
      })
      .catch(() => setStatus("off"));
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
      if (sub) await sub.unsubscribe();

      const res = await fetch("/api/studio/push/subscribe", {
        method: "DELETE",
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
          ícono de candado en la URL y volvé a probar.
        </p>
      )}
      {status === "unsupported" && (
        <p
          style={{
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--ink-mute)",
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
    if (linked && waitingConfirm) {
      setWaitingConfirm(false);
      setLinkCode(null);
    }
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
            Tocá este link · vas a abrir Telegram y mandar /start automático:
          </div>
          <a
            href={tgUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              font: "700 12.5px/1 var(--f-mono)",
              color: "var(--wine)",
              wordBreak: "break-all",
            }}
          >
            {tgUrl}
          </a>
          <div
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-mute)",
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
      fg: "var(--ink-mute)",
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
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
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
            color: "var(--ink-mute)",
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
