"use client";

/**
 * SDD-0645 · D1 de Sam (2026-11-16): cuando un embarque cambió de cliente, el
 * cambio tiene que ser «totalmente visible». El Shipping Mark anterior va
 * tachado, el actual al lado con la marca «nuevo», y al pulsarla se explica por
 * qué las etiquetas conservan el código. Debajo, el historial: fecha, quién,
 * anterior → nuevo y el motivo.
 *
 * Solo Shipping Marks y nombres del equipo: sin nombres de clientes, así que se
 * muestra también al equipo de China (SDD-0531).
 */

import { useId, useState } from "react";

export type CambioVisible = {
  fecha: string;
  actor: string;
  anterior: string | null;
  nuevo: string;
  motivo: string | null;
};

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
        <span style={{ font: "700 14px/1.2 var(--f-mono)", color: "var(--ink)" }}>{ultimo.nuevo}</span>
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
          El código de las etiquetas (<span style={{ fontFamily: "var(--f-mono)" }}>{shipmentCode}</span>) se
          mantiene porque ya está impreso en las cajas; el embarque es de{" "}
          <span style={{ fontFamily: "var(--f-mono)" }}>{ultimo.nuevo}</span> desde el{" "}
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
              embarque de <span style={{ fontFamily: "var(--f-mono)" }}>{c.anterior ?? "sin Shipping Mark"}</span> a{" "}
              <span style={{ fontFamily: "var(--f-mono)" }}>{c.nuevo}</span>
              {c.motivo && (
                <>
                  . Motivo: <q>{c.motivo}</q>
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
