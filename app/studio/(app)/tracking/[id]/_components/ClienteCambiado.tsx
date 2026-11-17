"use client";

/**
 * SDD-0645 · D1 de Sam (2026-11-16): cuando un embarque cambió de cliente, el
 * cambio tiene que ser «totalmente visible». El Shipping Mark anterior va
 * tachado, el actual al lado con la marca «nuevo», y al pulsarla se explica por
 * qué las etiquetas conservan el código. Debajo, el historial: fecha, quién,
 * anterior → nuevo y el motivo.
 *
 * Se muestra también al equipo de China (SDD-0531): solo lleva Shipping Marks y
 * nombres del equipo. El motivo es texto libre y puede traer un nombre: para
 * China la página no lo manda y aquí se lee «Motivo registrado» (B-1).
 * Los Shipping Marks van en <code>, no en <span>, para no confundirse con el
 * del encabezado.
 */

import { useId, useState } from "react";

export type CambioVisible = {
  fecha: string;
  actor: string;
  anterior: string | null;
  nuevo: string;
  motivo: string | null;
  /** Hay motivo, pero quien mira no puede leerlo (región China, SDD-0531). */
  motivoOculto?: boolean;
};

const MONO = { fontFamily: "var(--f-mono)", fontSize: "inherit", background: "none", padding: 0 } as const;

function fechaCaracas(iso: string, conHora: boolean): string {
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    ...(conHora ? { timeStyle: "short" } : {}),
    timeZone: "America/Caracas",
  }).format(new Date(iso));
}

export function ClienteCambiado({
  shipmentCode,
  cambios,
}: {
  shipmentCode: string;
  /** Del más reciente al más viejo. */
  cambios: CambioVisible[];
}) {
  const [abierto, setAbierto] = useState(false);
  const idExplicacion = useId();
  const ultimo = cambios[0];
  if (!ultimo) return null;

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "var(--s-4) var(--s-5)",
        display: "grid",
        gap: "var(--s-3)",
      }}
    >
      <div className="studio-eyebrow">Cambio de cliente</div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
        {ultimo.anterior && (
          <s style={{ font: "600 14px/1.2 var(--f-mono)", color: "var(--ink-soft)" }}>
            <span className="sr-only">Antes: </span>
            {ultimo.anterior}
          </s>
        )}
        <span aria-hidden="true" style={{ color: "var(--ink-soft)" }}>
          →
        </span>
        <code style={{ font: "700 14px/1.2 var(--f-mono)", color: "var(--ink)", background: "none", padding: 0 }}>
          {ultimo.nuevo}
        </code>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-xs"
          aria-expanded={abierto}
          aria-controls={idExplicacion}
          onClick={() => setAbierto((v) => !v)}
        >
          nuevo
        </button>
      </div>

      {abierto && (
        <p
          id={idExplicacion}
          style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink)", margin: 0 }}
        >
          El código de las etiquetas (<code style={MONO}>{shipmentCode}</code>) se
          mantiene porque ya está impreso en las cajas; el embarque es de{" "}
          <code style={MONO}>{ultimo.nuevo}</code> desde el{" "}
          {fechaCaracas(ultimo.fecha, false)}.
        </p>
      )}

      <div>
        <div className="studio-eyebrow" style={{ marginBottom: "var(--s-2)" }}>
          Historial del cliente
        </div>
        <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: "var(--s-2)" }}>
          {cambios.map((c) => (
            <li key={`${c.fecha}-${c.nuevo}`} style={{ font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink)" }}>
              <span style={{ color: "var(--ink-soft)" }}>{fechaCaracas(c.fecha, true)}</span> · {c.actor} pasó el
              embarque de <code style={MONO}>{c.anterior ?? "sin Shipping Mark"}</code> a{" "}
              <code style={MONO}>{c.nuevo}</code>
              {c.motivo ? (
                <>
                  . Motivo: <q>{c.motivo}</q>
                </>
              ) : c.motivoOculto ? (
                <>. Motivo registrado</>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
