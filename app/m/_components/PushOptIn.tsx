"use client";

/**
 * PushOptIn — toggle de Web Push para el operario (Sprint 4 v3).
 *
 * Item de menú que muestra el estado del push y deja activarlo/desactivarlo.
 * Pensado para vivir dentro del SettingsMenu (VE) y del MenuModal (CN).
 *
 * Flow al activar:
 *  1. Notification.requestPermission()
 *  2. navigator.serviceWorker.ready → pushManager.subscribe(applicationServerKey)
 *  3. POST /api/m/push/subscribe con el subscription serializado
 *
 * Estados:
 *  - "unsupported"  · el browser no soporta push (iOS < 16.4 standalone, etc)
 *  - "default"      · soportado pero no pidió permiso aún
 *  - "denied"       · permiso denegado (no se puede revertir desde JS)
 *  - "subscribed"   · activo
 *  - "loading"      · en transición
 *
 * Sin VAPID public key en env → "unsupported" (no se puede suscribir).
 */

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";

type PushState =
  | "checking"
  | "unsupported"
  | "default"
  | "denied"
  | "subscribed"
  | "loading";

/** ES / 中文 · CN es bilingüe, VE es-only (pasa "es" o default). */
export type PushLang = "es" | "cn";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function tt(lang: PushLang, es: string, cn: string): string {
  return lang === "cn" ? cn : es;
}

/** base64url → ArrayBuffer (formato que pide applicationServerKey). */
function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC_KEY
  );
}

export function PushOptIn({
  lang = "es",
}: {
  /** Idioma del label · CN lo pasa para no romper el modo 中文. Default es. */
  lang?: PushLang;
}) {
  const [state, setState] = useState<PushState>("checking");
  // ToastProvider siempre presente en /m (app/m/layout.tsx) · feedback
  // garantizado sin depender de que el consumer pase un callback.
  const toast = useToast();

  // Estado inicial post-mount
  const refreshState = useCallback(async () => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "default");
    } catch {
      setState("default");
    }
  }, []);

  useEffect(() => {
    // Sincroniza con sistemas externos (Notification.permission +
    // pushManager.getSubscription) · setState async es la intención.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshState();
  }, [refreshState]);

  const enable = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) return;
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        toast.error(
          tt(lang, "Permiso de notificaciones no concedido", "通知权限未授予"),
        );
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(VAPID_PUBLIC_KEY),
      });

      const res = await fetch("/api/m/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        throw new Error(`subscribe ${res.status}`);
      }
      setState("subscribed");
      toast.success(tt(lang, "Notificaciones activadas", "通知已开启"));
    } catch (err) {
      console.error("[PushOptIn] enable error:", err);
      setState("default");
      toast.error(tt(lang, "No se pudo activar notificaciones", "无法开启通知"));
    }
  }, [lang, toast]);

  const disable = useCallback(async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint ?? null;
      if (sub) await sub.unsubscribe();
      await fetch("/api/m/push/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      setState("default");
      toast.success(tt(lang, "Notificaciones desactivadas", "通知已关闭"));
    } catch (err) {
      console.error("[PushOptIn] disable error:", err);
      void refreshState();
    }
  }, [lang, toast, refreshState]);

  // No render si no soportado · evita ruido en browsers sin push
  if (state === "checking" || state === "unsupported") return null;

  const label =
    state === "subscribed"
      ? tt(lang, "Notificaciones activas", "通知已开启")
      : state === "denied"
        ? tt(lang, "Notificaciones bloqueadas", "通知被屏蔽")
        : state === "loading"
          ? tt(lang, "Procesando…", "处理中…")
          : tt(lang, "Activar notificaciones", "开启通知");

  const isOn = state === "subscribed";
  const disabled = state === "loading" || state === "denied";

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        if (disabled) return;
        if (isOn) void disable();
        else void enable();
      }}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        minHeight: 40,
        padding: "10px",
        background: "transparent",
        border: "none",
        borderRadius: "var(--r-sm)",
        color: state === "denied" ? "var(--ink-mute)" : "var(--ink)",
        font: "600 12.5px/1.2 var(--f-sans)",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          color: isOn ? "var(--success)" : "var(--ink-soft)",
          flexShrink: 0,
        }}
      >
        {/* Bell icon · color shift (gris→verde) comunica el on-state */}
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none">
          <path
            d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 004 0"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block" }}>{label}</span>
        {state === "denied" && (
          <span
            style={{
              display: "block",
              font: "500 11px/1.3 var(--f-sans)",
              color: "var(--ink-mute)",
              marginTop: 2,
            }}
          >
            {tt(lang, "Activá desde el navegador", "请在浏览器设置中开启")}
          </span>
        )}
      </span>
    </button>
  );
}
