"use client";

/**
 * Comercial (SDD-0048) — pipeline CRM derivado de kommo_leads (etapas abiertas).
 *
 * V1 = solo pipeline + leads activos. Las mini-barras de tiers / referidos
 * (Fidelización) quedan FUERA (§8): el módulo no existe aún. Solo tokens var(--*).
 *
 * SDD-0614 S0b (D-6.6-1): con Kommo oculto del Studio, el resumen llega
 * `oculto` y la tarjeta no se pinta. Su código se conserva hasta 8.7.
 */

import Link from "next/link";
import { Icon } from "@/app/studio/_components/icons";
import type { CommercialSummary } from "@/lib/studio/direccion/queries";
import { fmtUsd } from "@/lib/money";
import { MiniStat } from "./MiniStat";

export function CommercialCard({
  commercial,
}: {
  commercial: CommercialSummary;
}) {
  if (commercial.oculto) return null;
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-5) var(--s-5)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "var(--s-4)",
        }}
      >
        <span
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine-text)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Comercial
        </span>
        <Link
          href="/studio/crm"
          style={{
            font: "600 11.5px/1 var(--f-sans)",
            color: "var(--wine-text)",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--s-1)",
            textDecoration: "none",
          }}
        >
          CRM {Icon.arrowR(11)}
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
        <MiniStat
          label="Pipeline CRM"
          value={fmtUsd(commercial.pipeline)}
          sub="en etapas abiertas"
          icon={Icon.spark(16)}
          href="/studio/crm"
        />
        <MiniStat
          label="Leads activos"
          value={commercial.leadsActivos}
          sub="sin cerrar"
          icon={Icon.users(16)}
          href="/studio/crm"
        />
      </div>
    </div>
  );
}
