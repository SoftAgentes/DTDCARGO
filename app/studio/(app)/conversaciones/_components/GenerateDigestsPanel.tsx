"use client";

/**
 * Panel admin "generar resúmenes ahora" (SDD-0149 F3). Dispara el runner del digest
 * mensual para un mes puntual desde el ERP — sin depender del cron ni del CRON_SECRET
 * (oculto). Idempotente (upsert): re-correr no duplica. Solo se muestra a quien puede
 * editar el módulo; la server action revalida el permiso igual (backstop).
 */

import { useActionState } from "react";
import { generateDigestsAction } from "../actions";
import type { DigestGenState } from "@/lib/studio/conversaciones/conversations-types";

const EMPTY: DigestGenState = {};

export function GenerateDigestsPanel() {
  const [state, formAction, pending] = useActionState(generateDigestsAction, EMPTY);

  return (
    <div
      style={{
        marginTop: 16,
        marginBottom: 20,
        padding: "14px 16px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
      }}
    >
      <div
        style={{
          font: "700 12px/1.3 var(--f-sans)",
          color: "var(--ink)",
          marginBottom: 2,
        }}
      >
        Resúmenes mensuales
      </div>
      <p
        style={{
          font: "400 12px/1.45 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 10px",
          maxWidth: "68ch",
        }}
      >
        Genera el resumen con IA de un mes puntual (interno + el que ve el cliente en su
        portal). Se puede re-correr sin duplicar.
      </p>

      <form
        action={formAction}
        style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
      >
        <input
          type="month"
          name="month"
          required
          aria-label="Mes a resumir"
          style={{
            height: 34,
            padding: "0 10px",
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            font: "500 13px/1 var(--f-sans)",
            color: "var(--ink)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={pending}
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: "var(--r-md)",
            border: "none",
            cursor: pending ? "not-allowed" : "pointer",
            opacity: pending ? 0.55 : 1,
            background: "var(--wine)",
            color: "var(--wine-tint)",
            font: "700 12px/1 var(--f-sans)",
          }}
        >
          {pending ? "Generando…" : "Generar ahora"}
        </button>

        {state.error && (
          <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--danger)" }}>
            {state.error}
          </span>
        )}
        {state.ok && (
          <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
            {state.periodLabel}: {state.generated} de {state.processed} resúmenes
            {state.skipped ? ` · ${state.skipped} sin generar` : ""}.
          </span>
        )}
      </form>
    </div>
  );
}
