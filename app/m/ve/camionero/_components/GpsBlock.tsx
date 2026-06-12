"use client";

/**
 * GpsBlock — toggle GPS live del camión (Sprint 3 v3 · plan v3).
 *
 * Toggle on/off persistido en localStorage. Cuando está on:
 *  - `navigator.geolocation.watchPosition` recibe updates del SO.
 *  - Cada update (throttled a 30s mínimo) POST a `/api/m/tms/ping`.
 *  - Si el endpoint responde 429, ignoramos · próximo intento es esperar.
 *  - El badge muestra last-ping age en vivo.
 *
 * Cuando está off · warning overlay rojo. CTA "Llegué" del PodModal queda
 * disabled hasta que el operario lo reactive (handoff regla de seguridad
 * para que toda entrega tenga ubicación trazable).
 *
 * Exportamos también `useGpsLiveState` para que el PodModal sepa si el
 * GPS está on y pueda obtener una posición fresca al confirmar.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "dtd_op_gps_camionero";
const PING_THROTTLE_MS = 30_000; // alineado con rate-limit del endpoint

type GpsStatus =
  | "off"           // toggle off por el operario
  | "on"            // toggle on + recibiendo updates
  | "denied"        // permission denied
  | "unavailable"   // SO sin GPS o error técnico
  | "no_position"   // toggle on pero todavía no llegó la primera posición
  ;

export type GpsSnapshot = {
  status: GpsStatus;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  /** Último timestamp de update del SO (ms). */
  lastUpdatedAt: number | null;
  /** Último timestamp de ping exitoso al server (ms). */
  lastSentAt: number | null;
};

const initialSnapshot: GpsSnapshot = {
  status: "off",
  lat: null,
  lng: null,
  accuracy_m: null,
  lastUpdatedAt: null,
  lastSentAt: null,
};

const GpsContext = createContext<{
  snapshot: GpsSnapshot;
  toggle: () => void;
} | null>(null);

export function useGpsLiveState(): GpsSnapshot {
  const ctx = useContext(GpsContext);
  if (!ctx) {
    // Sin provider, devolvemos snapshot 'off' default para no romper
    return initialSnapshot;
  }
  return ctx.snapshot;
}

export function GpsLiveProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<GpsSnapshot>(initialSnapshot);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const sendingRef = useRef<boolean>(false);

  // Helper: parar el watch
  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  // Helper: enviar ping al server (throttled)
  const sendPing = useCallback(
    async (lat: number, lng: number, accuracy_m: number | null) => {
      const now = Date.now();
      if (now - lastSentRef.current < PING_THROTTLE_MS) return;
      if (sendingRef.current) return;
      sendingRef.current = true;
      try {
        const res = await fetch("/api/m/tms/ping", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lat, lng, accuracy_m, source: "watch" }),
        });
        if (res.ok) {
          lastSentRef.current = now;
          setSnapshot((s) => ({ ...s, lastSentAt: now }));
        } else if (res.status === 429) {
          // Rate limit · próximo tick re-intentará
        } else if (res.status === 412) {
          // Sin truck linkeado · log silent y no spamear
          console.warn("[GpsBlock] sin truck linkeado");
        }
      } catch (err) {
        console.error("[GpsBlock] ping error", err);
      } finally {
        sendingRef.current = false;
      }
    },
    [],
  );

  // Helper: arrancar el watch
  const startWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setSnapshot((s) => ({ ...s, status: "unavailable" }));
      return;
    }
    setSnapshot((s) => ({ ...s, status: "no_position" }));
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy_m = pos.coords.accuracy ?? null;
        setSnapshot({
          status: "on",
          lat,
          lng,
          accuracy_m,
          lastUpdatedAt: Date.now(),
          lastSentAt: lastSentRef.current || null,
        });
        void sendPing(lat, lng, accuracy_m);
      },
      (err) => {
        console.warn("[GpsBlock] watch error", err);
        setSnapshot((s) => ({
          ...s,
          status:
            err.code === 1 /* PERMISSION_DENIED */
              ? "denied"
              : "unavailable",
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 15_000,
      },
    );
    watchIdRef.current = id;
  }, [sendPing]);

  const toggle = useCallback(() => {
    setSnapshot((prev) => {
      const nextOn = prev.status === "off" || prev.status === "denied" || prev.status === "unavailable";
      try {
        localStorage.setItem(STORAGE_KEY, nextOn ? "on" : "off");
      } catch {
        /* ignore */
      }
      if (nextOn) {
        // Arrancar watch fuera del setter (efecto async)
        setTimeout(() => startWatch(), 0);
        return { ...prev, status: "no_position" };
      } else {
        stopWatch();
        return { ...initialSnapshot, status: "off" };
      }
    });
  }, [startWatch, stopWatch]);

  // Auto-start si localStorage tenía 'on'. startWatch llama setState
  // internamente, lo cual es la intención (transición de status off →
  // no_position al arrancar).
  useEffect(() => {
    if (typeof window === "undefined") return;
    let saved = "off";
    try {
      saved = localStorage.getItem(STORAGE_KEY) ?? "off";
    } catch {
      /* ignore */
    }
    if (saved === "on") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startWatch();
    }
    return stopWatch;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GpsContext.Provider value={{ snapshot, toggle }}>
      {children}
    </GpsContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// GpsBlock · UI visible en el header del camionero
// ─────────────────────────────────────────────────────────────

export function GpsBlock() {
  const ctx = useContext(GpsContext);
  if (!ctx) {
    throw new Error("GpsBlock debe estar dentro de <GpsLiveProvider>.");
  }
  const { snapshot, toggle } = ctx;

  const isOn = snapshot.status === "on" || snapshot.status === "no_position";
  const lastUpdateLabel = snapshot.lastUpdatedAt
    ? formatAgo(snapshot.lastUpdatedAt)
    : null;

  return (
    <div
      style={{
        padding: 10,
        background: isOn ? "var(--success-bg)" : "var(--danger-bg)",
        border: `1px solid ${isOn ? "var(--success)" : "var(--danger)"}`,
        borderRadius: "var(--r-md)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: isOn ? "var(--success)" : "var(--danger)",
          flexShrink: 0,
          animation: isOn ? "gps-pulse 1.6s ease-in-out infinite" : undefined,
        }}
      />
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes gps-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.5); }
          }
        }
      `}</style>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "800 11px/1 var(--f-sans)",
            color: isOn ? "var(--success)" : "var(--danger)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          GPS {isOn ? "activo" : "apagado"}
        </div>
        <div
          style={{
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 2,
          }}
        >
          {snapshot.status === "on" && lastUpdateLabel
            ? `Última posición ${lastUpdateLabel}`
            : snapshot.status === "no_position"
              ? "Buscando posición…"
              : snapshot.status === "denied"
                ? "Permiso denegado · activa GPS en el navegador"
                : snapshot.status === "unavailable"
                  ? "Sin GPS disponible"
                  : "Enciéndelo antes de salir a la ruta"}
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={isOn}
        style={{
          width: 44,
          height: 24,
          padding: 2,
          borderRadius: 999,
          background: isOn ? "var(--success)" : "var(--ink-mute)",
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
          transition: "background var(--dur) var(--ease)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "block",
            width: 20,
            height: 20,
            background: "#FFFFFF",
            borderRadius: "50%",
            transform: isOn ? "translateX(20px)" : "translateX(0)",
            transition: "transform var(--dur) var(--ease)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        />
      </button>
    </div>
  );
}

function formatAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "ahora";
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min}min`;
  const hr = Math.floor(min / 60);
  return `hace ${hr}h`;
}
