"use client";

/**
 * PushOptInBanner — descubrimiento del recordatorio diario en la 1ª visita a
 * /m/erp/bitacora (SDD-0146 · Fase 5). El módulo no puede quedar mudo: invita a
 * activar el push (channel_push default OFF · no molestar) con guía iOS (el push
 * en iPhone solo funciona con la PWA agregada a la pantalla de inicio) y menciona
 * Telegram como respaldo. Best-effort: si algo falla, empuja a Telegram sin ruido.
 *
 * Solo tokens var(--*). es-VE, tuteo, cero anglicismos.
 */

import { useEffect, useState } from "react";

type Status =
  | "hidden"
  | "prompt"
  | "ios-install" // iOS sin PWA instalada: no puede recibir push todavía
  | "enabling"
  | "on"
  | "blocked"
  | "unsupported"
  | "error";

const DISMISS_KEY = "bitacora:push-banner-dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushOptInBanner() {
  const [status, setStatus] = useState<Status>("hidden");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado inicial (client-only para no romper hidratación).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    // iOS: el push solo existe con la PWA instalada (display-mode standalone).
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isIOS && !standalone) {
      setStatus("ios-install");
      return;
    }
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("blocked");
      return;
    }

    // ¿Ya está suscrito en esta PWA? Entonces no molestamos.
    navigator.serviceWorker
      .getRegistration("/m/sw.js")
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .then((sub) => setStatus(sub ? "hidden" : "prompt"))
      .catch(() => setStatus("prompt"));
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // best-effort
    }
    setStatus("hidden");
  };

  const enable = async () => {
    setErrorMsg(null);
    setStatus("enabling");
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setErrorMsg("El push no está configurado todavía.");
        setStatus("error");
        return;
      }
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("blocked");
        return;
      }
      const reg = await navigator.serviceWorker.register("/m/sw.js", {
        scope: "/m/",
      });
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            publicKey,
          ) as unknown as ArrayBuffer,
        });
      }
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
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        // best-effort
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  if (status === "hidden" || status === "on") return null;

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--wine)",
        borderRadius: "var(--r-md)",
        marginBottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              font: "800 13px/1.2 var(--f-display)",
              color: "var(--ink)",
            }}
          >
            Activa el recordatorio diario
          </div>
          <div
            style={{
              font: "500 11.5px/1.45 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 4,
            }}
          >
            Recibe a las 8am un resumen de tus tareas del día en este teléfono.
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          style={{
            background: "transparent",
            border: 0,
            color: "var(--ink-mute)",
            font: "700 11px/1 var(--f-sans)",
            cursor: "pointer",
            padding: 4,
            flexShrink: 0,
          }}
        >
          Ahora no
        </button>
      </div>

      {status === "prompt" && (
        <button
          type="button"
          onClick={enable}
          className="studio-btn studio-btn-primary studio-btn-sm"
          style={{ alignSelf: "flex-start" }}
        >
          Activar recordatorio
        </button>
      )}
      {status === "enabling" && (
        <div style={{ font: "600 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          Activando…
        </div>
      )}
      {status === "ios-install" && (
        <div
          style={{
            font: "500 11.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          En iPhone, primero toca <strong>Compartir</strong> y{" "}
          <strong>Agregar a pantalla de inicio</strong>; abre DTD desde ese ícono
          para poder recibir los avisos.
        </div>
      )}
      {status === "blocked" && (
        <div style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--warning)" }}>
          El navegador bloqueó los avisos. Actívalos desde los ajustes del sitio y
          vuelve a probar.
        </div>
      )}
      {status === "unsupported" && (
        <div style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          Este navegador no soporta avisos push.
        </div>
      )}
      {status === "error" && errorMsg && (
        <div style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--danger)" }}>
          {errorMsg}
        </div>
      )}

      <div
        style={{
          font: "500 11px/1.45 var(--f-sans)",
          color: "var(--ink-soft)",
          borderTop: "1px solid var(--border)",
          paddingTop: 8,
        }}
      >
        ¿Prefieres Telegram? Conéctalo desde tu perfil en el Studio y recibe el
        mismo recordatorio ahí.
      </div>
    </div>
  );
}
