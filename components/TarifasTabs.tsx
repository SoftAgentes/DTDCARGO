"use client";

import { useState } from "react";
import { CalculadoraForm } from "@/components/CalculadoraForm";
import { CotizadorFletes } from "@/components/CotizadorFletes";
import type { CalcParams, Ciudad } from "@/lib/calculadora";

/**
 * Calculadora 2-en-1 de /tarifas (Fase 3): un toggle LCL ↔ FCL sobre un solo
 * lienzo. Ambas calc son las del repo (cero divergencia de tarifa):
 *  · LCL = <CalculadoraForm> (RPC anon de tarifas), CTA WhatsApp DIRECTO.
 *  · FCL = <CotizadorFletes> (motor SeaRates ocean-rate por HTTP), CTA WhatsApp.
 * Ninguna guarda nada. Fuente Archivo (sin calc-sys/Sora): regla de Fase 3.
 */

type ServerRate = {
  per_cbm: number;
  min_charge: number | null;
  valid_until: string | null;
} | null;

type Tab = "lcl" | "fcl";

export function TarifasTabs({
  serverRate,
  serverConfig,
  ciudades,
}: {
  serverRate?: ServerRate;
  serverConfig?: CalcParams | null;
  ciudades?: Ciudad[];
}) {
  const [tab, setTab] = useState<Tab>("lcl");

  return (
    <div>
      {/* Toggle de modalidad */}
      <div
        role="tablist"
        aria-label="Tipo de carga"
        className="inline-flex p-1 rounded-[14px] bg-grey-100 border border-grey-200 mb-6"
      >
        <TabButton active={tab === "lcl"} onClick={() => setTab("lcl")} panelId="panel-lcl" id="tab-lcl">
          Carga suelta <span className="opacity-70">· LCL</span>
        </TabButton>
        <TabButton active={tab === "fcl"} onClick={() => setTab("fcl")} panelId="panel-fcl" id="tab-fcl">
          Contenedor completo <span className="opacity-70">· FCL</span>
        </TabButton>
      </div>

      {/* Panel LCL */}
      <div id="panel-lcl" role="tabpanel" aria-labelledby="tab-lcl" hidden={tab !== "lcl"}>
        <CalculadoraForm
          serverRate={serverRate}
          serverConfig={serverConfig}
          ciudades={ciudades}
          directWhatsApp
        />
      </div>

      {/* Panel FCL */}
      <div id="panel-fcl" role="tabpanel" aria-labelledby="tab-fcl" hidden={tab !== "fcl"}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8 lg:gap-12">
          <div>
            <h2
              className="text-[24px] lg:text-[28px] leading-[1.1] tracking-[-0.01em] text-ink"
              style={{ fontFamily: "var(--font-archivo-black)" }}
            >
              Tu flete de contenedor,
              <br />
              <span style={{ color: "var(--color-wine)" }}>China a tu puerto.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-[1.55] text-grey-700 max-w-[46ch]">
              Elige tu ciudad o puerto de origen en China y tu destino en Venezuela,
              y mira un flete estimado al instante. Es referencial; tu asesor lo
              cierra en firme con cupo y fecha.
            </p>
            <ul className="mt-6 flex flex-col gap-3 text-[14.5px] text-grey-700 list-none p-0">
              {[
                ["Contenedor completo (FCL).", "Estimado al instante en 40' High Cube; otras medidas con tu asesor."],
                ["¿Carga suelta (LCL)?", "Cámbiate a la pestaña de arriba y calcula por volumen (CBM)."],
                ["¿Puerta a puerta?", "El FCL todo pagado hasta tu puerta lo arma tu asesor por WhatsApp."],
              ].map(([t, d]) => (
                <li key={t} className="flex items-start gap-3">
                  <span
                    className="mt-1.5 inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: "var(--color-wine)" }}
                    aria-hidden
                  />
                  <span>
                    <strong className="text-ink">{t}</strong> {d}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <CotizadorFletes />
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  id,
  panelId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  id: string;
  panelId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={panelId}
      onClick={onClick}
      className={`px-4 sm:px-5 h-11 rounded-[10px] text-[13.5px] sm:text-[14.5px] font-semibold transition-colors ${
        active
          ? "bg-wine text-white shadow-sm"
          : "bg-transparent text-grey-700 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
