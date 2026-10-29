"use client";

/**
 * Vínculos usuario de Studio ↔ agente de Chatwoot (SDD-0585, E2-D10). Solo lo
 * monta la página para un admin; la acción vuelve a exigir admin y el servidor
 * comprueba la cuenta y el correo del agente por la Platform API.
 *
 * Desvincular borra la fila: pasa por el ConfirmDialog canónico (BTN-01/AVS-01).
 */
import { startTransition, useActionState, useState } from "react";

import { useT } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dict";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { desvincularAgente, vincularAgente, type VinculoState } from "../actions";

export interface VinculoFila {
  userId: string;
  nombre: string;
  chatwootUserId: number;
}

export interface MiembroOpcion {
  userId: string;
  nombre: string;
}

const INICIAL: VinculoState = { ok: false, error: null };

function useMensajeError(estado: VinculoState) {
  const t = useT();
  return estado.error ? { error: t(`bandeja.error.${estado.error}` as I18nKey) } : null;
}

function Desvincular({ fila }: { fila: VinculoFila }) {
  const t = useT();
  const [estado, accion, pendiente] = useActionState(desvincularAgente, INICIAL);
  const [abierto, setAbierto] = useState(false);
  const error = useMensajeError(estado);

  const confirmar = () => {
    const fd = new FormData();
    fd.set("user_id", fila.userId);
    startTransition(() => accion(fd));
    setAbierto(false);
  };

  return (
    <>
      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-sm"
        disabled={pendiente}
        onClick={() => setAbierto(true)}
      >
        {pendiente ? t("bandeja.links.unlinking") : t("bandeja.links.unlink")}
      </button>
      <ErrorAlert state={error} compact />
      <ConfirmDialog
        open={abierto}
        danger
        title={t("bandeja.links.unlink_confirm_title")}
        message={t("bandeja.links.unlink_confirm_body", { nombre: fila.nombre })}
        confirmLabel={t("bandeja.links.unlink")}
        cancelLabel={t("bandeja.links.cancel")}
        pending={pendiente}
        onCancel={() => setAbierto(false)}
        onConfirm={confirmar}
      />
    </>
  );
}

export function VinculosAdmin({ vinculos, miembros }: { vinculos: VinculoFila[]; miembros: MiembroOpcion[] }) {
  const t = useT();
  const [estado, accion, pendiente] = useActionState(vincularAgente, INICIAL);
  const error = useMensajeError(estado);

  return (
    <section
      aria-labelledby="bandeja-vinculos"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "var(--s-6)", display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
    >
      <div>
        <h2 id="bandeja-vinculos" style={{ font: "800 16px/1.2 var(--f-display)", color: "var(--ink)", margin: "0 0 var(--s-1)" }}>
          {t("bandeja.links.title")}
        </h2>
        <p style={{ margin: 0, font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>{t("bandeja.links.help")}</p>
      </div>

      {vinculos.length === 0 ? (
        <p style={{ margin: 0, font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-mute)" }}>{t("bandeja.links.empty")}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          {vinculos.map((v) => (
            <li key={v.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--s-3)", flexWrap: "wrap" }}>
              <span style={{ font: "500 14px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                {v.nombre} <span style={{ font: "500 12px/1 var(--f-mono)", color: "var(--ink-mute)" }}>#{v.chatwootUserId}</span>
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
                <Desvincular fila={v} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={accion} style={{ display: "flex", alignItems: "flex-end", gap: "var(--s-3)", flexWrap: "wrap" }}>
        <label className="studio-label" style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
          {t("bandeja.links.user")}
          <select name="user_id" required defaultValue="" className="studio-input" style={{ minWidth: 220 }}>
            <option value="" disabled>
              {t("bandeja.links.user_placeholder")}
            </option>
            {miembros.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="studio-label" style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
          {t("bandeja.links.agent_id")}
          <input name="chatwoot_user_id" required inputMode="numeric" pattern="[1-9][0-9]*" className="studio-input studio-input-mono" />
        </label>
        <button type="submit" disabled={pendiente} className="studio-btn studio-btn-primary">
          {pendiente ? t("bandeja.links.submitting") : t("bandeja.links.submit")}
        </button>
      </form>
      <ErrorAlert state={error} />
      {estado.ok ? (
        <p role="status" style={{ margin: 0, font: "500 13px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {t("bandeja.links.created")}
        </p>
      ) : null}
    </section>
  );
}
