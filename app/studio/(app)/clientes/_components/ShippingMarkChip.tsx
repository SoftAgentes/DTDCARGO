"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import type {
  MarkboxHistoryEntry,
  RenameMarkboxActionState,
} from "@/lib/studio/markbox-history-types";
import { renombrarMarkboxAction } from "../actions";

/**
 * El Shipping Mark en la CABECERA de la ficha, no en una tarjeta al fondo
 * (SDD-0258).
 *
 * Por qué se movió: el código es la IDENTIDAD del cliente — es con lo que viaja
 * su carga y con lo que lo busca todo el equipo. Vivía en una tarjeta hundida al
 * final de una columna estrecha, debajo de datos que se editan una vez al año.
 *
 * Y el historial dejó de ser un bloque a lo ancho: es un contador discreto que
 * abre un panel. **Si no hay historial, no ocupa nada** — que era justo la queja
 * del founder.
 */
export function ShippingMarkChip({
  clientId,
  markbox,
  historial,
  canEdit,
}: {
  clientId: string;
  markbox: string;
  historial: MarkboxHistoryEntry[];
  canEdit: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nuevo, setNuevo] = useState("");
  const caja = useRef<HTMLDivElement>(null);

  const [state, formAction, pending] = useActionState<RenameMarkboxActionState, FormData>(
    (prev, fd) => renombrarMarkboxAction(clientId, markbox, prev, fd),
    null,
  );

  // Cerrar al hacer clic afuera o con Escape. Sin esto el panel se queda
  // abierto tapando la ficha, que es peor que no tenerlo.
  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) {
        setAbierto(false);
        setEditando(false);
      }
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAbierto(false);
        setEditando(false);
      }
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const hayAlgoQueMostrar = historial.length > 0 || canEdit;

  return (
    <div ref={caja} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => hayAlgoQueMostrar && setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup={hayAlgoQueMostrar ? "dialog" : undefined}
        disabled={!hayAlgoQueMostrar}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          font: "800 18px/1 var(--f-mono)",
          color: "var(--ink)",
          letterSpacing: "0.02em",
          padding: "8px 14px",
          background: "var(--bg-elevated)",
          borderRadius: "var(--r-md)",
          border: "1px solid var(--border)",
          cursor: hayAlgoQueMostrar ? "pointer" : "default",
        }}
      >
        {markbox}
        {historial.length > 0 && (
          <span
            title={`${historial.length} Shipping Mark anterior${historial.length === 1 ? "" : "es"}`}
            style={{
              font: "700 11px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              background: "var(--bg-base)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "3px 7px",
            }}
          >
            +{historial.length}
          </span>
        )}
        {hayAlgoQueMostrar && (
          <span aria-hidden style={{ font: "700 10px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
            ▾
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Shipping Mark"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 40,
            width: 340,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow-lg, 0 12px 32px rgba(0,0,0,0.12))",
            padding: 16,
          }}
        >
          {historial.length > 0 && (
            <>
              <div
                style={{
                  font: "600 11px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Códigos anteriores
              </div>
              <ul style={{ listStyle: "none", margin: "0 0 10px", padding: 0, display: "grid", gap: 8 }}>
                {historial.map((h) => (
                  <li key={h.id}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ font: "600 14px/1.3 var(--f-mono)", color: "var(--ink)" }}>
                        {h.markbox}
                      </span>
                      <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                        {new Date(h.retiredAt).toLocaleDateString("es-VE")}
                      </span>
                    </div>
                    {h.reason && (
                      <div style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                        {h.reason}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <p style={{ font: "500 12px/1.45 var(--f-sans)", color: "var(--ink-soft)", margin: "0 0 12px" }}>
                Siguen reservados para este cliente y siguen funcionando: una caja
                rotulada con uno de ellos cae en esta ficha.
              </p>
            </>
          )}

          {canEdit && !editando && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={() => setEditando(true)}
            >
              Cambiar Shipping Mark
            </button>
          )}

          {canEdit && editando && (
            <form action={formAction} style={{ display: "grid", gap: 10 }}>
              <div>
                <label htmlFor="chip-nuevo" className="studio-label" style={{ display: "block", marginBottom: 6 }}>
                  Código nuevo
                </label>
                <input
                  id="chip-nuevo"
                  name="nuevoMarkbox"
                  className="studio-input"
                  value={nuevo}
                  onChange={(e) => setNuevo(e.target.value.toUpperCase().slice(0, 40))}
                  autoComplete="off"
                  autoFocus
                  style={{ width: "100%", font: "600 15px/1.3 var(--f-mono)", letterSpacing: "0.04em" }}
                />
              </div>
              <input
                name="motivo"
                className="studio-input"
                placeholder="Motivo (queda en el historial)"
                maxLength={500}
                style={{ width: "100%" }}
              />
              <p style={{ font: "500 12px/1.45 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
                <b style={{ color: "var(--ink)" }}>{markbox}</b> pasa a historial y
                queda reservado. Su carga, facturas y cajas se mueven solas. El CRM y
                las etiquetas ya impresas siguen con el viejo.
              </p>
              {state?.error && (
                <p style={{ font: "500 12px/1.45 var(--f-sans)", color: "var(--danger)", margin: 0 }}>
                  {state.error}
                </p>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="studio-btn studio-btn-dark studio-btn-sm" disabled={pending}>
                  {pending ? "Cambiando…" : "Cambiar"}
                </button>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={() => setEditando(false)}
                  disabled={pending}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
