"use client";

/**
 * Panel admin "generar resúmenes ahora" (SDD-0149 F3). Dispara el runner del digest
 * mensual para un mes puntual desde el ERP — sin depender del cron ni del CRON_SECRET
 * (oculto). Idempotente (upsert): re-correr no duplica. Solo se muestra a quien puede
 * editar el módulo; la server action revalida el permiso igual (backstop).
 */

import { useActionState } from "react";
import { DateField } from "@/app/studio/_components/ui/DateField";
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
        {/* SDD-0660: el estándar de fechas del Studio (sin las rayas del campo de mes del navegador). */}
        <DateField
          mode="month"
          name="month"
          required
          aria-label="Mes a resumir"
          style={{ width: 150 }}
          inputStyle={{ minHeight: 34, paddingBlock: 0 }}
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="studio-btn studio-btn-primary studio-btn-sm"
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
