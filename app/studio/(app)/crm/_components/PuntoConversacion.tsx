"use client";

/**
 * SDD-0288 rebanada 1 · el punto del semáforo de conversación.
 *
 * Vive en UN solo componente y lo montan las DOS vistas (Tablero y tabla del
 * Asesor). No es preferencia de estilo: SDD-0256 §4 dejó escrito que un verbo
 * que sale en una sola superficie es peor que no tenerlo, porque el asesor
 * aprende que la pantalla no es de fiar. Un contrato lo verifica
 * (`__tests__/punto-conversacion.test.ts`).
 *
 * ── La forma la pidió el founder ────────────────────────────────────────────
 *
 * *"Algo que prenda en rojo, como si fuera un WhatsApp; un ejemplo son las
 * alertas que tienen un botoncito rojo a la izquierda."* Por eso es un punto
 * sólido al inicio de la fila, no un borde ni un fondo: se lee de un vistazo
 * recorriendo la columna en vertical, que es como se mira un kanban.
 */
import { useSyncExternalStore } from "react";
import {
  colorConversacion,
  conversacionDe,
  etiquetaDesde,
  rotuloConversacion,
  type LeadConMensajes,
} from "@/lib/studio/kommo-conversacion";

let sharedNowMs: number | null = null;
let pendingFrame: number | null = null;
const clockListeners = new Set<() => void>();

function currentClockSnapshot(): number | null {
  return sharedNowMs;
}

function serverClockSnapshot(): null {
  return null;
}

function subscribeClock(listener: () => void): () => void {
  clockListeners.add(listener);
  if (sharedNowMs == null && pendingFrame == null) {
    pendingFrame = window.requestAnimationFrame(() => {
      pendingFrame = null;
      sharedNowMs = Date.now();
      for (const notify of clockListeners) notify();
    });
  }

  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size > 0) return;
    if (pendingFrame != null) window.cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
    sharedNowMs = null;
  };
}

/**
 * Un solo reloj por montaje de las vistas CRM. El snapshot del servidor es
 * `null`, así hidratación no compara dos tiempos distintos; todas las tarjetas
 * reciben el mismo valor en el primer frame del cliente.
 */
function useSharedNowMs(): number | null {
  return useSyncExternalStore(
    subscribeClock,
    currentClockSnapshot,
    serverClockSnapshot,
  );
}

export function PuntoConversacion({
  lead,
  ahoraMs,
  conTexto = false,
}: {
  lead: LeadConMensajes;
  /** Reloj explícito para pruebas/casos deterministas; la UI usa el compartido. */
  ahoraMs?: number;
  /** El Tablero muestra sólo el punto; la tabla tiene sitio para el rótulo. */
  conTexto?: boolean;
}) {
  const sharedNow = useSharedNowMs();
  const resolvedNow = ahoraMs ?? sharedNow;
  if (resolvedNow == null) return null;

  const c = conversacionDe(lead, resolvedNow);
  const color = colorConversacion(c);
  if (!color) return null; // sin conversación → no se pinta nada

  const rotulo = rotuloConversacion(c);
  const urgente = c.estado === "te-escribio";
  const estadoVisible = urgente ? "Nuevo" : "Enviado";
  const detalleVisible =
    conTexto && c.desdeMs != null
      ? `${estadoVisible} · ${etiquetaDesde(c.desdeMs)}`
      : estadoVisible;

  return (
    <span
      title={rotulo}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0,
      }}
    >
      {/* El punto conserva la señal visual; el rótulo adyacente evita depender
          del color o de un `title` que no funciona con teclado/touch. */}
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {/*
        El estado siempre queda visible. En la tabla se agrega la antigüedad;
        en el tablero se usa un rótulo corto para no romper la tarjeta.
      */}
      <span
        aria-hidden="true"
        style={{
          font: "600 10.5px/1 var(--f-mono)",
          color: urgente ? "var(--danger)" : "var(--ink-soft)",
          whiteSpace: "nowrap",
        }}
      >
        {detalleVisible}
      </span>
      <span className="sr-only">{rotulo}</span>
    </span>
  );
}
