"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { CalculadoraForm } from "@/components/CalculadoraForm";
import type { CalcParams, Ciudad } from "@/lib/calculadora";

/**
 * Calculadora CBM/LCL de `/tarifas` — un toggle de 2 pestañas sobre un mismo
 * lienzo. Las dos usan el MISMO motor (`calcularEnvioLCL` de lib/calculadora.ts)
 * y el mismo formulario (`<CalculadoraForm>`), así que no pueden divergir:
 *
 *  · **Puerta a Puerta** (`modo="ddp"`): tarifa pública real desde la RPC anon
 *    `public_cbm_rate`, ciudad de destino en Venezuela, DDP todo incluido.
 *  · **LCL Consolidado** (`modo="consolidado"`): tarifa fija de 580 USD/CBM
 *    (`CONSOLIDADO_CBM_RATE`, dato del founder 2026-07-20), sin ciudad — llega
 *    hasta puerto y te entregamos tu propio BL; la aduana va por cuenta del
 *    cliente. Mismos recargos y mismo CBM mínimo que el puerta a puerta.
 *
 * Ninguna guarda nada: el CTA de las dos es WhatsApp DIRECTO con el texto del
 * estimado (`directWhatsApp`) — sin modal de captura ni POST al ERP.
 * Fuente Archivo (sin calc-sys/Sora).
 */

type ServerRate = {
  per_cbm: number;
  min_charge: number | null;
  valid_until: string | null;
} | null;

type Tab = "ddp" | "consolidado";

export function TarifasTabs({
  serverRate,
  serverConfig,
  ciudades,
}: {
  serverRate?: ServerRate;
  serverConfig?: CalcParams | null;
  ciudades?: Ciudad[];
}) {
  const [tab, setTab] = useState<Tab>("ddp");

  // Pastilla deslizante detrás del tab activo: mide el botón activo y anima
  // left/width hacia él, en vez del swap instantáneo de fondo de antes (cada
  // botón tenía su propio bg-wine, sin indicar de dónde a dónde se movía).
  const ddpRef = useRef<HTMLButtonElement>(null);
  const consolidadoRef = useRef<HTMLButtonElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = tab === "ddp" ? ddpRef.current : consolidadoRef.current;
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [tab]);

  return (
    <div>
      {/* Toggle de modalidad */}
      <div
        role="tablist"
        aria-label="Modalidad de envío"
        className="relative inline-flex p-1 rounded-[14px] bg-grey-100 border border-grey-200 mb-6"
      >
        {pill && (
          <span
            aria-hidden="true"
            className="absolute inset-y-1 rounded-[10px] bg-wine shadow-sm transition-all duration-300 ease-out"
            style={{ left: pill.left, width: pill.width }}
          />
        )}
        <TabButton
          ref={ddpRef}
          active={tab === "ddp"}
          onClick={() => setTab("ddp")}
          id="tab-ddp"
          panelId="panel-ddp"
        >
          Puerta a Puerta <span className="opacity-70">· DDP</span>
        </TabButton>
        <TabButton
          ref={consolidadoRef}
          active={tab === "consolidado"}
          onClick={() => setTab("consolidado")}
          id="tab-consolidado"
          panelId="panel-consolidado"
        >
          LCL Consolidado <span className="opacity-70">· hasta puerto</span>
        </TabButton>
      </div>

      {/* Panel · Puerta a Puerta (DDP) */}
      <div
        id="panel-ddp"
        role="tabpanel"
        aria-labelledby="tab-ddp"
        hidden={tab !== "ddp"}
      >
        <CalculadoraForm
          serverRate={serverRate}
          serverConfig={serverConfig}
          ciudades={ciudades}
          directWhatsApp
        />
      </div>

      {/* Panel · LCL Consolidado (hasta puerto, con BL propio) */}
      <div
        id="panel-consolidado"
        role="tabpanel"
        aria-labelledby="tab-consolidado"
        hidden={tab !== "consolidado"}
      >
        <CalculadoraForm
          serverRate={serverRate}
          serverConfig={serverConfig}
          modo="consolidado"
          directWhatsApp
        />
        <ConsolidadoFicha />
      </div>
    </div>
  );
}

/**
 * Alcance del LCL Consolidado — copy GROUNDED en la ficha `lcl-consolidado` de
 * lib/servicios-detalle.ts (dictado founder 2026-06-09). No se inventa nada:
 * incluye / no incluye / tiempos salen tal cual de ahí.
 */
function ConsolidadoFicha() {
  return (
    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
      <FichaCard titulo="Qué incluye" tone="ok">
        <li>Consolidación de tu carga en nuestra bodega de Yiwu.</li>
        <li>Flete marítimo internacional de China a Venezuela.</li>
        <li>
          Tu propio Bill of Lading, separado dentro del Bill Master del
          contenedor.
        </li>
      </FichaCard>
      <FichaCard titulo="Qué no incluye" tone="warn">
        <li>
          Aduana e impuestos en Venezuela: los gestionas tú, o los sumas aparte
          (servicio de aduana).
        </li>
        <li>
          Servicios portuarios, transporte interno y demás gastos hasta el
          destino.
        </li>
      </FichaCard>
      <div className="md:col-span-2 rounded-[14px] border border-grey-200 bg-white px-4 py-3.5">
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-500">
          Tiempos
        </span>
        <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.5]">
          60 a 90 días hasta que tu carga llega a Venezuela y te entregamos el
          Bill of Lading.
        </p>
      </div>
    </div>
  );
}

function FichaCard({
  titulo,
  tone,
  children,
}: {
  titulo: string;
  tone: "ok" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-grey-200 bg-white px-4 py-3.5">
      <span
        className={`text-[11px] font-bold tracking-[0.12em] uppercase ${
          tone === "ok" ? "text-wine" : "text-grey-500"
        }`}
      >
        {titulo}
      </span>
      <ul className="mt-2 pl-4 flex flex-col gap-1.5 text-[13px] text-grey-700 leading-[1.5] list-disc marker:text-grey-300">
        {children}
      </ul>
    </div>
  );
}

const TabButton = forwardRef<
  HTMLButtonElement,
  {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    id: string;
    panelId: string;
  }
>(function TabButton({ active, onClick, children, id, panelId }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={panelId}
      onClick={onClick}
      className={`relative z-10 px-4 sm:px-5 h-11 rounded-[10px] text-[15px] sm:text-[16px] font-semibold transition-colors duration-300 ${
        active ? "text-white" : "text-grey-700 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
});
