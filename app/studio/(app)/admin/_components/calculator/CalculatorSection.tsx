"use client";

/**
 * CalculatorSection — sección "Calculadora pública" de Administración (grupo PRO).
 *
 * Reúne la configuración del calculador público LCL DDP que antes vivía en el
 * módulo Tarifas (Comercial). Es config administrativa que se edita muy pocas
 * veces, por eso vive acá. Dos sub-pestañas:
 *   - Parámetros: las 8 reglas escalares del precio.
 *   - Ciudades: las ciudades de destino con su recargo por distancia.
 *
 * La tarifa base ($/CBM) y el piso mínimo NO se editan acá — siguen en el
 * módulo Tarifas (una tarifa marcada como "Pública · calc").
 */

import { useState } from "react";
import type { CalculatorSettings } from "@/lib/studio/calculator-settings-types";
import type { CalculatorCity } from "@/lib/studio/calculator-cities-types";
import type { CarrierTariff, FreightCarrier } from "@/lib/studio/freight-carriers/types";
import { ParametrosPanel } from "./ParametrosPanel";
import { CiudadesPanel } from "./CiudadesPanel";
import { TransportistasPanel } from "./TransportistasPanel";

export type CalculatorTab = "parametros" | "ciudades" | "transportistas";
type Tab = CalculatorTab;

export function CalculatorSection({
  settings,
  cities,
  carriers,
  tariffs,
  isAdmin,
  initialTab = "parametros",
}: {
  settings: CalculatorSettings | null;
  cities: CalculatorCity[];
  /** SDD-0231 — transportistas terrestres y su tarifario. */
  carriers: FreightCarrier[];
  tariffs: CarrierTariff[];
  isAdmin: boolean;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div>
      {/* Sub-tabs · Parámetros | Ciudades */}
      <div
        role="tablist"
        aria-label="Secciones del calculador"
        className="studio-tabs"
        style={{ marginBottom: 22 }}
      >
        <TabButton
          id="tab-calc-parametros"
          controls="panel-calc-parametros"
          active={tab === "parametros"}
          onClick={() => setTab("parametros")}
          label="Parámetros"
        />
        <TabButton
          id="tab-calc-ciudades"
          controls="panel-calc-ciudades"
          active={tab === "ciudades"}
          onClick={() => setTab("ciudades")}
          label="Ciudades"
        />
        <TabButton
          id="tab-calc-transportistas"
          controls="panel-calc-transportistas"
          active={tab === "transportistas"}
          onClick={() => setTab("transportistas")}
          label="Transportistas"
        />
      </div>

      {tab === "parametros" && (
        <div
          role="tabpanel"
          id="panel-calc-parametros"
          aria-labelledby="tab-calc-parametros"
        >
          <ParametrosPanel settings={settings} />
        </div>
      )}

      {tab === "ciudades" && (
        <div
          role="tabpanel"
          id="panel-calc-ciudades"
          aria-labelledby="tab-calc-ciudades"
        >
          <CiudadesPanel cities={cities} isAdmin={isAdmin} />
        </div>
      )}

      {tab === "transportistas" && (
        <div
          role="tabpanel"
          id="panel-calc-transportistas"
          aria-labelledby="tab-calc-transportistas"
        >
          <TransportistasPanel
            carriers={carriers}
            tariffs={tariffs}
            cities={cities.map((c) => ({ slug: c.slug, label: c.label }))}
            isAdmin={isAdmin}
          />
        </div>
      )}
    </div>
  );
}

function TabButton({
  id,
  controls,
  active,
  onClick,
  label,
}: {
  id: string;
  controls: string;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={active}
      data-activa={active ? "true" : undefined}
      onClick={onClick}
      className="studio-tab"
    >
      {label}
    </button>
  );
}
