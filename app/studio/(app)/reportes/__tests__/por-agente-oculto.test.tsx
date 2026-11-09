/**
 * SDD-0614 · S0 (D-6.6-1, P-9): Reportes › Por agente no muestra la tabla de Kommo.
 *
 * La tabla de desempeño por asesor salía del espejo `kommo_*`. Entre S0 y S3 no
 * se muestra: en su lugar va el aviso corto e interno que el Subdirector aprobó
 * tal cual (P-9), y el CSV no trae la tabla del espejo. R4 la vuelve a llenar en
 * S3, con las tarjetas del CRM propio.
 *
 * - `commercialByAgent` no toca la base: el cliente de prueba lanza en cualquier
 *   consulta y además se cuenta que no se llamó.
 * - El CSV de «Por agente» sale vacío aunque el payload traiga filas.
 * - La vista pinta el aviso literal y no la tabla.
 *
 * Ocultar no es borrar: la lectura del espejo sigue en el repo
 * (`commercialByAgentKommo`) hasta 8.7 o hasta que R4 la reemplace.
 */
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { commercialByAgent } from "@/lib/studio/reports/queries";
import { buildViewCsv } from "@/lib/studio/reports/export-csv";
import type { CommercialByAgent } from "@/lib/studio/reports/types";
import { ReportesClient } from "../_components/ReportesClient";

afterEach(() => cleanup());

/** Texto aprobado tal cual por el Subdirector el 2026-11-06 (spec §2.1, P-9). */
const AVISO_1 = "El desempeño por asesor se está pasando al CRM del Studio.";
const AVISO_2 = "Vuelve a aparecer aquí cuando esté listo.";

function clienteQueNoSePuedeUsar() {
  const from = vi.fn(() => {
    throw new Error("S0: Por agente consultó una tabla");
  });
  const rpc = vi.fn(() => {
    throw new Error("S0: Por agente llamó una RPC");
  });
  return { cliente: { from, rpc } as unknown as SupabaseClient, from, rpc };
}

/** Un payload con filas, como el que daba el espejo: el oculto tiene que ganarle. */
const CON_FILAS: CommercialByAgent = {
  rows: [
    {
      agentId: 7,
      name: "Asesor de prueba",
      leads: 10,
      won: 4,
      lost: 2,
      clients: 3,
      revenueUsd: 1200,
      convPct: 40,
    },
  ],
  totals: { leads: 10, won: 4, lost: 2, clients: 3, revenueUsd: 1200, convPct: 40 },
  hasKommo: true,
  oculto: true,
};

describe("commercialByAgent no lee el espejo de Kommo (SDD-0614 S0)", () => {
  it("devuelve el reporte oculto sin consultar nada", async () => {
    const { cliente, from, rpc } = clienteQueNoSePuedeUsar();
    const r = await commercialByAgent(cliente, new Date("2026-11-07T12:00:00Z"));
    expect(r.oculto).toBe(true);
    expect(r.rows).toEqual([]);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("el CSV de Por agente no trae la tabla del espejo (SDD-0614 S0)", () => {
  it("oculto → no hay CSV, aunque el payload traiga filas", () => {
    expect(buildViewCsv({ category: "com", rep: "by-agent", byAgent: CON_FILAS })).toBeNull();
  });

  it("control: el mismo payload sin ocultar sí exporta (la prueba mira algo)", () => {
    const csv = buildViewCsv({
      category: "com",
      rep: "by-agent",
      byAgent: { ...CON_FILAS, oculto: false },
    });
    expect(csv?.content).toContain("Asesor de prueba");
  });
});

describe("Reportes › Por agente muestra el aviso, no la tabla (SDD-0614 S0, P-9)", () => {
  it("pinta el aviso literal y deja el CSV deshabilitado", () => {
    render(
      createElement(ReportesClient, {
        period: "MES",
        category: "com",
        rep: "by-agent",
        byAgent: CON_FILAS,
      }),
    );
    expect(screen.getByText(AVISO_1)).toBeInTheDocument();
    expect(screen.getByText(AVISO_2)).toBeInTheDocument();
    expect(screen.queryByText("Asesor de prueba")).toBeNull();
    expect(screen.queryByText(/Performance por agente/i)).toBeNull();
    expect(screen.queryByText(/Sin datos de asesores/)).toBeNull();
    expect(screen.getByRole("button", { name: /Exportar CSV/ })).toBeDisabled();
  });
});

describe("ocultar no es borrar: la lectura del espejo sigue en el repo", () => {
  it("commercialByAgentKommo sigue exportada en queries.ts", () => {
    const fuente = readFileSync(join(process.cwd(), "lib/studio/reports/queries.ts"), "utf8");
    expect(fuente).toContain("export async function commercialByAgentKommo(");
    expect(fuente).toContain("getAnalyticsLeads(supabase)");
  });
});
