"use client";

import { useActionState, useState } from "react";

import { Badge } from "@/app/studio/_components/ui/Badge";
import type {
  MarkboxHistoryEntry,
  RenameMarkboxActionState,
} from "@/lib/studio/markbox-history-types";
import { renombrarMarkboxAction } from "../actions";

/**
 * El Shipping Mark del cliente, su historial y el cambio de código (SDD-0258).
 *
 * El código viejo NO se borra: queda reservado para este cliente y sigue
 * resolviendo, así que una caja rotulada con él no llega huérfana. Eso se dice
 * en la tarjeta, porque es justo lo que el operador necesita saber para animarse
 * a cambiarlo.
 *
 * Lo que la tarjeta NO promete —y por eso lo advierte— es lo que vive fuera del
 * sistema: Kommo, los correos ya enviados y las etiquetas ya impresas siguen
 * mostrando el código viejo.
 */
export function ShippingMarkCard({
  clientId,
  markbox,
  historial,
  canEdit,
}: {
  clientId: string;
  markbox: string;
  /** Códigos que este cliente TUVO, del más reciente al más viejo. */
  historial: MarkboxHistoryEntry[];
  canEdit: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState("");

  // La action termina en redirect() a la ficha del código nuevo, así que en el
  // camino feliz este componente se desmonta y `state` sólo lleva errores.
  const [state, formAction, pending] = useActionState<RenameMarkboxActionState, FormData>(
    (prev, fd) => renombrarMarkboxAction(clientId, markbox, prev, fd),
    null,
  );

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span className="studio-eyebrow">Shipping Mark</span>
        {historial.length > 0 && (
          <Badge tone="neutral" size="md">
            {historial.length} anterior{historial.length === 1 ? "" : "es"}
          </Badge>
        )}
      </div>

      <div style={{ font: "700 22px/1.2 var(--f-mono)", color: "var(--ink)", letterSpacing: "0.04em" }}>
        {markbox}
      </div>
      <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "2px 0 14px" }}>
        Es el código con el que viaja su carga hoy.
      </div>

      {historial.length > 0 && (
        <div
          style={{
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: 12,
            marginBottom: 14,
          }}
        >
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
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {historial.map((h) => (
              <li key={h.id}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ font: "600 14px/1.3 var(--f-mono)", color: "var(--ink)", letterSpacing: "0.04em" }}>
                    {h.markbox}
                  </span>
                  <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                    retirado el {new Date(h.retiredAt).toLocaleDateString("es-VE")}
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
          <p style={{ font: "500 12px/1.45 var(--f-sans)", color: "var(--ink-soft)", margin: "10px 0 0" }}>
            Siguen reservados para este cliente y siguen funcionando: si llega una
            caja rotulada con uno de ellos, cae en esta ficha. No se le asignan a
            nadie más nunca.
          </p>
        </div>
      )}

      {!canEdit ? (
        <p style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          No tienes permiso para editar clientes.
        </p>
      ) : !abierto ? (
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={() => setAbierto(true)}
        >
          Cambiar Shipping Mark
        </button>
      ) : (
        <form action={formAction} style={{ display: "grid", gap: 12 }}>
          <div>
            <label htmlFor="nuevo-markbox" className="studio-label" style={{ display: "block", marginBottom: 6 }}>
              Shipping Mark nuevo
            </label>
            <input
              id="nuevo-markbox"
              name="nuevoMarkbox"
              className="studio-input"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value.toUpperCase().slice(0, 40))}
              placeholder="Escribe el código nuevo…"
              autoComplete="off"
              style={{ width: "100%", font: "600 15px/1.3 var(--f-mono)", letterSpacing: "0.04em" }}
            />
            <p style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "6px 0 0" }}>
              Letras, números y guiones. Si el cliente pertenece a un aliado, tiene
              que llevar la insignia de ese aliado.
            </p>
          </div>

          <div>
            <label htmlFor="motivo-markbox" className="studio-label" style={{ display: "block", marginBottom: 6 }}>
              Motivo
            </label>
            <input
              id="motivo-markbox"
              name="motivo"
              className="studio-input"
              placeholder="Por qué se cambia (queda en el historial)"
              maxLength={500}
              style={{ width: "100%" }}
            />
          </div>

          <div
            style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              padding: 12,
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            <b style={{ color: "var(--ink)" }}>{markbox}</b> pasa a historial: se
            reserva para este cliente, sigue resolviendo y su carga, facturas,
            prealertas y cajas se mueven solas al código nuevo.
            <br />
            <br />
            Lo que <b style={{ color: "var(--ink)" }}>no</b> cambia solo: el CRM, los
            correos ya enviados y las etiquetas ya impresas siguen mostrando el
            código viejo.
          </div>

          {state?.error && (
            <p style={{ font: "500 12.5px/1.45 var(--f-sans)", color: "var(--danger)", margin: 0 }}>
              {state.error}
            </p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="studio-btn studio-btn-dark studio-btn-sm" disabled={pending}>
              {pending ? "Cambiando…" : "Cambiar Shipping Mark"}
            </button>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={() => setAbierto(false)}
              disabled={pending}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
