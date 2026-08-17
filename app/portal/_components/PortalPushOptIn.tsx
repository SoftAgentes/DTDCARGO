"use client";

/**
 * PortalPushOptIn — el cliente activa avisos por notificación (Web Push) para
 * enterarse cuando su asesor responde (SDD-0148 #3b). Calca el flujo del operario
 * (`app/m/_components/PushOptIn`) pero con estilo del portal y sin dependencias del
 * Studio (feedback inline, sin toast).
 *
 * Flujo al activar: Notification.requestPermission() → serviceWorker.ready →
 * pushManager.subscribe(VAPID) → POST /api/portal/push/subscribe.
 * Si el browser no soporta push o no hay VAPID key → no renderiza nada.
 */

import { useCallback, useEffect, useState } from "react";
import { CheckIcon } from "@/components/Icon";

/** Campana inline (el set del portal no tiene BellIcon). */
function Bell({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 004 0"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type PushState =
  | "checking"
  | "unsupported"
  | "default"
  | "denied"
  | "subscribed"
  | "loading";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

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

export function PortalPushOptIn() {
  const [state, setState] = useState<PushState>("checking");

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
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(VAPID_PUBLIC_KEY),
      });
      const res = await fetch("/api/portal/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error(`subscribe ${res.status}`);
      setState("subscribed");
    } catch (err) {
      console.error("[PortalPushOptIn] enable error:", err);
      setState("default");
    }
  }, []);

  const disable = useCallback(async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint ?? null;
      if (sub) await sub.unsubscribe();
      await fetch("/api/portal/push/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      setState("default");
    } catch (err) {
      console.error("[PortalPushOptIn] disable error:", err);
      void refreshState();
    }
  }, [refreshState]);

  if (state === "checking" || state === "unsupported") return null;

  if (state === "subscribed") {
    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-5 flex items-center gap-3">
        <span className="grid place-items-center h-9 w-9 rounded-full bg-[color-mix(in_srgb,var(--color-status-success)_15%,transparent)] text-[color:var(--color-status-success)] shrink-0">
          <CheckIcon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-ink">Notificaciones activadas</div>
          <div className="text-[12px] text-grey-500">Tu navegador te avisará apenas te escribamos.</div>
        </div>
        <button
          type="button"
          onClick={() => void disable()}
          className="text-[12px] font-semibold text-grey-500 hover:text-wine-text shrink-0"
        >
          Desactivar
        </button>
      </div>
    );
  }

  const denied = state === "denied";
  const loading = state === "loading";

  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-5">
      <div className="flex items-start gap-3">
        <span className="grid place-items-center h-9 w-9 rounded-full bg-paper text-wine-text shrink-0">
          <Bell size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-ink">
            Activa las notificaciones
          </div>
          <p className="mt-1 text-[12.5px] text-grey-700 leading-[1.5]">
            {denied
              ? "Las notificaciones están bloqueadas en tu navegador. Actívalas desde la configuración del sitio (candado 🔒 junto a la dirección) para que te avisemos cuando te escribamos."
              : "Actívalas para que tu navegador te avise cuando DTD Cargo te escriba, aunque no tengas el portal abierto. Así no tienes que estar pendiente."}
          </p>
          {!denied && (
            <button
              type="button"
              onClick={() => void enable()}
              disabled={loading}
              aria-busy={loading}
              className="btn btn-ghost mt-3 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait"
            >
              <Bell size={15} />
              {loading ? "Activando…" : "Activar notificaciones"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
