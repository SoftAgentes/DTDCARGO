"use client";

/**
 * Vínculos usuario de Studio ↔ agente de Chatwoot (SDD-0585, E2-D10). Solo lo
 * monta la página para un admin; la acción vuelve a exigir admin y el servidor
 * comprueba la cuenta y el correo del agente por la Platform API.
 */
import { useActionState } from "react";

import { useT } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dict";
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

const campo = {
  font: "500 14px/1.2 var(--f-sans)",
  color: "var(--ink)",
  background: "var(--bg-surface)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-sm)",
  padding: "var(--s-2) var(--s-3)",
  minHeight: 36,
} as const;

const boton = {
  font: "600 13px/1 var(--f-sans)",
  color: "var(--ink-inv)",
  background: "var(--wine)",
  border: "none",
  borderRadius: "var(--r-sm)",
  padding: "0 var(--s-4)",
  minHeight: 36,
  cursor: "pointer",
} as const;

function Mensaje({ estado, exito }: { estado: VinculoState; exito: I18nKey }) {
  const t = useT();
  if (estado.error) {
    return (
      <p role="alert" style={{ margin: 0, font: "500 13px/1.4 var(--f-sans)", color: "var(--ink)", borderLeft: "3px solid var(--danger)", paddingLeft: "var(--s-2)" }}>
        {t(`bandeja.error.${estado.error}` as I18nKey)}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p role="status" style={{ margin: 0, font: "500 13px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
        {t(exito)}
      </p>
    );
  }
  return null;
}

function Desvincular({ userId }: { userId: string }) {
  const t = useT();
  const [estado, accion, pendiente] = useActionState(desvincularAgente, INICIAL);
  return (
    <form action={accion} style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
      <input type="hidden" name="user_id" value={userId} />
      <button
        type="submit"
        disabled={pendiente}
        style={{ ...boton, color: "var(--wine-text)", background: "transparent", border: "1px solid var(--border-strong)" }}
      >
        {pendiente ? t("bandeja.links.unlinking") : t("bandeja.links.unlink")}
      </button>
      {estado.error ? <Mensaje estado={estado} exito="bandeja.links.deleted" /> : null}
    </form>
  );
}

export function VinculosAdmin({ vinculos, miembros }: { vinculos: VinculoFila[]; miembros: MiembroOpcion[] }) {
  const t = useT();
  const [estado, accion, pendiente] = useActionState(vincularAgente, INICIAL);

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
              <Desvincular userId={v.userId} />
            </li>
          ))}
        </ul>
      )}

      <form action={accion} style={{ display: "flex", alignItems: "flex-end", gap: "var(--s-3)", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", font: "600 12px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
          {t("bandeja.links.user")}
          <select name="user_id" required defaultValue="" style={{ ...campo, minWidth: 220 }}>
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
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", font: "600 12px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
          {t("bandeja.links.agent_id")}
          <input name="chatwoot_user_id" required inputMode="numeric" pattern="[1-9][0-9]*" style={{ ...campo, width: 140 }} />
        </label>
        <button type="submit" disabled={pendiente} style={boton}>
          {pendiente ? t("bandeja.links.submitting") : t("bandeja.links.submit")}
        </button>
      </form>
      <Mensaje estado={estado} exito="bandeja.links.created" />
    </section>
  );
}
