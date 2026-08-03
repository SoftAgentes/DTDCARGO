"use client";

/**
 * Panel del código de PRODUCTO (SDD-0242) — Studio › Marketing › HUB.
 *
 * Va aparte del panel de "Acceso de diseño" y no como un campo más suyo porque
 * son dos públicos distintos: aquél es el link que se le manda a un diseñador
 * externo; éste abre el ERP por dentro, la app del operario y los formularios de
 * inspección. Juntos en una sola caja, el día que alguien comparta el primero es
 * fácil que copie el segundo por descuido.
 *
 * Igual que el de marca, el código NO se puede mostrar: en la DB sólo vive el
 * bcrypt. El panel dice si hay uno puesto, nunca cuál es.
 */

import { useActionState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { setBrandInternalCodeAction, type BrandAdminState } from "../actions";

export function BrandInternalPanel({ isOpen }: { isOpen: boolean }) {
  const [state, formAction, isPending] = useActionState<BrandAdminState, FormData>(
    setBrandInternalCodeAction,
    {},
  );

  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: 14,
        background: "var(--bg-surface)",
        padding: "20px 22px",
        marginBottom: 28,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6,
        }}
      >
        <h2 className="studio-eyebrow" style={{ margin: 0 }}>
          Piezas de producto
        </h2>
        <Badge tone={isOpen ? "warning" : "neutral"} size="sm">
          {isOpen ? "Abiertas con código propio" : "Cerradas"}
        </Badge>
      </div>

      <p
        style={{
          font: "400 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 var(--s-4)",
          maxWidth: "68ch",
        }}
      >
        El Brand Book enlaza 22 piezas que no son de marca sino de producto: el
        ERP por dentro, la app del operario, los formularios de inspección y los
        documentos comerciales. No se comparten con diseño externo.{" "}
        {isOpen
          ? "Hoy se abren tecleando este código dentro del visor. La sesión dura 12 horas."
          : "Hoy no las abre nadie. Pon un código si necesitas verlas."}
      </p>

      <form
        action={formAction}
        style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <div>
          <label className="studio-label" htmlFor="brand-internal-code">
            {isOpen ? "Código nuevo" : "Código"}
          </label>
          <input
            id="brand-internal-code"
            name="code"
            className="studio-input studio-input-mono"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="6 dígitos"
            autoComplete="off"
            style={{ width: 170 }}
          />
        </div>

        <button
          type="submit"
          className="studio-btn studio-btn-primary studio-btn-sm"
          disabled={isPending}
        >
          {isPending ? "Guardando…" : "Guardar código"}
        </button>

        {isOpen && (
          <button
            type="submit"
            name="code"
            value=""
            className="studio-btn studio-btn-danger studio-btn-sm"
            disabled={isPending}
            title="Las piezas de producto dejan de abrirse para todos"
          >
            Cerrar producto
          </button>
        )}
      </form>

      <p
        style={{
          font: "400 12px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "12px 0 0",
          maxWidth: "68ch",
        }}
      >
        Es una segunda capa: además de este código hace falta haber entrado a{" "}
        <code style={{ font: "500 12px/1 var(--f-mono)" }}>/marca</code> —con el
        código de marca o con tu cuenta del ERP—. El bloqueo por intentos
        fallidos se cuenta aparte del de marca, así que fallar aquí no cierra el
        brand book.
      </p>

      {(state.error || state.message) && (
        <p
          role="status"
          style={{
            font: "600 13px/1.4 var(--f-sans)",
            color: state.error ? "var(--danger-web)" : "var(--ink)",
            margin: "12px 0 0",
          }}
        >
          {state.error ?? state.message}
        </p>
      )}
    </section>
  );
}
