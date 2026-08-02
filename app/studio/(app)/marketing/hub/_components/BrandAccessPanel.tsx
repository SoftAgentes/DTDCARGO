"use client";

/**
 * Panel del código de acceso a `/marca` (SDD-0238) — Studio › Marketing › HUB.
 *
 * Es lo que el founder pidió: "una opción en el ERP para yo poner la
 * contraseña". Junto al campo va el link listo para copiar, porque el código sin
 * el link no sirve de nada y tenerlos separados obliga a armar el mensaje a mano.
 *
 * El código NO se puede mostrar: en la DB sólo vive el bcrypt. Por eso el panel
 * dice si HAY uno puesto y desde cuándo, pero nunca cuál es. Si se olvida, se
 * pone otro — que es exactamente lo que debe pasar.
 */

import { useActionState, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { setBrandCodeAction, type BrandAdminState } from "../actions";

export function BrandAccessPanel({
  isOpen,
  updatedAt,
  sessionDays,
  shareUrl,
}: {
  isOpen: boolean;
  updatedAt: string | null;
  sessionDays: number;
  shareUrl: string;
}) {
  const [state, formAction, isPending] = useActionState<BrandAdminState, FormData>(
    setBrandCodeAction,
    {},
  );
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard no disponible (http, permisos) — no-op */
    }
  }

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
          Acceso de diseño
        </h2>
        <Badge tone={isOpen ? "success" : "neutral"} size="sm">
          {isOpen ? "Abierto con código" : "Cerrado"}
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
        {isOpen
          ? "Cualquiera con el link y el código entra al centro de marca y descarga lo que necesite. El equipo de DTD Cargo entra con su cuenta, sin código."
          : "Nadie de afuera puede entrar todavía. Pon un código para poder compartir el brand book."}
        {updatedAt && (
          <>
            {" "}
            Último cambio: {new Date(updatedAt).toLocaleDateString("es-VE")}.
          </>
        )}
      </p>

      {/* Link para copiar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <code
          style={{
            font: "500 13px/1 var(--f-mono)",
            color: "var(--ink)",
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 12px",
            flex: "1 1 260px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {shareUrl}
        </code>
        <button
          type="button"
          onClick={copyLink}
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
        >
          {copied ? Icon.check(14) : Icon.copy(14)}
          {copied ? "Copiado" : "Copiar link"}
        </button>
      </div>

      <form
        action={formAction}
        style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <div>
          <label className="studio-label" htmlFor="brand-code">
            {isOpen ? "Código nuevo" : "Código"}
          </label>
          <input
            id="brand-code"
            name="code"
            className="studio-input studio-input-mono"
            type="text"
            inputMode="numeric"
            pattern="\d{4,6}"
            maxLength={6}
            placeholder="4 a 6 dígitos"
            autoComplete="off"
            style={{ width: 170 }}
          />
        </div>

        <div>
          <label className="studio-label" htmlFor="brand-days">
            Dura (días)
          </label>
          <input
            id="brand-days"
            name="sessionDays"
            className="studio-input"
            type="number"
            min={1}
            max={365}
            defaultValue={sessionDays}
            style={{ width: 110 }}
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
            title="Deja el brand book cerrado a cualquiera de afuera"
          >
            Cerrar acceso
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
        Al guardar, el código anterior deja de servir de inmediato. Después de 3
        intentos fallidos hay que esperar 5 minutos; si vuelve a fallar 3 veces,
        1 hora. No se puede ver el código actual — sólo reemplazarlo.
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
