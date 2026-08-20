"use client";

import { useRef, useState } from "react";
import { CalculadoraForm } from "@/components/CalculadoraForm";
import { CONFIG, CONSOLIDADO_CBM_RATE, type CalcParams, type Ciudad } from "@/lib/calculadora";

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
 *
 * Transición "hoja" (SDD-0164, captura founder 2026-07-21): al cambiar de
 * tab, un panel sólido (wine → DDP, warning → LCL) cruza el frame en 700ms
 * con un leve giro 3D, mostrando el nombre de la modalidad centrado. El swap
 * real de panel (`tab` state) ocurre a los 340ms — el punto medio de la
 * animación, cuando la hoja cubre TODO el frame — así el cambio de contenido
 * queda oculto detrás de la hoja, igual que el mockup ocultaba el reload del
 * iframe. Ver `.tf-leaf`/`@keyframes tf-leaf-l/r` en app/recursos.css.
 *
 * Dos señales más del mockup original ("Tarifas · DTD-Cargo.html", handoff
 * founder), que faltaban en este puerto y se restauran acá:
 *  · **Anillo "estás aquí"** del `.tf-frame` completo vía `data-mode` (wine/
 *    warning) — no solo las tarjetas `calc-opt` de arriba.
 *  · **Espejo de columnas** dentro de `<CalculadoraForm>`: en consolidado
 *    (LCL) la entrada y el contenedor que se llena invierten de lado
 *    (`lg:order-1`/`lg:order-2` según `esConsolidado`) — refuerza que DDP y
 *    LCL son dos lógicas de precio distintas, no la misma calculadora con
 *    otro número.
 */

type ServerRate = {
  per_cbm: number;
  min_charge: number | null;
  valid_until: string | null;
} | null;

type Tab = "ddp" | "consolidado";
type LeafState = { dir: "to-ddp" | "to-lcl"; label: string } | null;

export function TarifasTabs({
  serverRate,
  serverConfig,
  ciudades,
  showRegisterCta = false,
}: {
  serverRate?: ServerRate;
  serverConfig?: CalcParams | null;
  ciudades?: Ciudad[];
  /**
   * Pasa el bloque "crear mi cuenta" a las dos pestañas (SDD-0276).
   * Nace en `false`: este componente lo montan `/tarifas` **y**
   * `/tarifas/embed`, y el embed vive en sitios de terceros. Ver el docblock de
   * `showRegisterCta` en `CalculadoraForm`.
   */
  showRegisterCta?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("ddp");
  const [leaf, setLeaf] = useState<LeafState>(null);
  const [leafRun, setLeafRun] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const ddpRate =
    serverRate?.per_cbm && serverRate.per_cbm > 0
      ? serverRate.per_cbm
      : CONFIG.tarifaBaseCBM;

  function selectTab(next: Tab) {
    if (next === tab) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setTab(next);
      return;
    }

    setLeaf({
      dir: next === "consolidado" ? "to-lcl" : "to-ddp",
      label: next === "consolidado" ? "Consolidado" : "Puerta a puerta",
    });
    setLeafRun((n) => n + 1);
    timers.current.push(setTimeout(() => setTab(next), 340));
    timers.current.push(setTimeout(() => setLeaf(null), 720));
  }

  return (
    <div>
      {/* Toggle de modalidad — tarjetas icono+nombre+precio+flag */}
      <div className="calc-switch" role="tablist" aria-label="Modalidad de envío">
        <CalcOpt
          id="ddp"
          active={tab === "ddp"}
          onClick={() => selectTab("ddp")}
          panelId="panel-ddp"
          icon={<TruckIcon />}
          name="Puerta a puerta"
          sig="DDP"
          desc="Hasta tu puerta · todo incluido"
          price={ddpRate}
        />
        <CalcOpt
          id="lcl"
          active={tab === "consolidado"}
          onClick={() => selectTab("consolidado")}
          panelId="panel-consolidado"
          icon={<BoxesIcon />}
          name="Consolidado"
          sig="LCL"
          desc="Hasta el puerto · compartes contenedor"
          price={CONSOLIDADO_CBM_RATE}
        />
      </div>

      {/* Frame de la calculadora — la hoja cubre esto al cambiar de tab.
          data-mode maneja el anillo "estás aquí" (wine/warning) del .tf-frame. */}
      <div className="tf-frame" data-mode={tab === "consolidado" ? "lcl" : "ddp"}>
        {leaf && (
          <div
            key={leafRun}
            aria-hidden="true"
            className={`tf-leaf turning ${leaf.dir}`}
          >
            <span className="tf-leaf-tag">{leaf.label}</span>
          </div>
        )}

        {/* Panel · Puerta a Puerta (DDP) */}
        <div id="panel-ddp" role="tabpanel" aria-labelledby="ddp" hidden={tab !== "ddp"}>
          <CalculadoraForm
            serverRate={serverRate}
            serverConfig={serverConfig}
            ciudades={ciudades}
            directWhatsApp
            showRegisterCta={showRegisterCta}
          />
        </div>

        {/* Panel · LCL Consolidado (hasta puerto, con BL propio) */}
        <div
          id="panel-consolidado"
          role="tabpanel"
          aria-labelledby="lcl"
          hidden={tab !== "consolidado"}
        >
          <CalculadoraForm
            serverRate={serverRate}
            serverConfig={serverConfig}
            modo="consolidado"
            directWhatsApp
            showRegisterCta={showRegisterCta}
          />
          <ConsolidadoFicha />
        </div>
      </div>
    </div>
  );
}

function CalcOpt({
  id,
  active,
  onClick,
  panelId,
  icon,
  name,
  sig,
  desc,
  price,
}: {
  id: "ddp" | "lcl";
  active: boolean;
  onClick: () => void;
  panelId: string;
  icon: React.ReactNode;
  name: string;
  sig: string;
  desc: string;
  price: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      data-calc={id}
      aria-selected={active}
      aria-controls={panelId}
      onClick={onClick}
      className={`calc-opt${active ? " is-active" : ""}`}
    >
      <span className={`calc-opt-ic ${id}`}>{icon}</span>
      <span className="calc-opt-body">
        <span className="calc-opt-top">
          <span className="calc-opt-name">{name}</span>
          <span className="calc-opt-sig">{sig}</span>
        </span>
        <span className="calc-opt-desc">{desc}</span>
      </span>
      <span className="calc-opt-side">
        <span className="calc-opt-price">
          ${Math.round(price).toLocaleString("en-US")}
          <span className="u">/ CBM</span>
        </span>
        <span className="calc-opt-flag">✓ Estás aquí</span>
      </span>
    </button>
  );
}

function TruckIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6.5h11v8H3z" />
      <path d="M14 9h3.5l3 3v2.5H14z" />
      <circle cx="7" cy="17.5" r="1.7" />
      <circle cx="17.5" cy="17.5" r="1.7" />
    </svg>
  );
}

function BoxesIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="7" width="18" height="12" rx="1.4" />
      <g fill="currentColor" stroke="none">
        <rect x="5.4" y="13.2" width="3.6" height="4" />
        <rect x="9.3" y="13.2" width="3.6" height="4" />
        <rect x="13.2" y="13.2" width="3.6" height="4" />
        <rect x="5.4" y="9.4" width="3.6" height="3.2" />
        <rect x="9.3" y="9.4" width="3.6" height="3.2" />
      </g>
    </svg>
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
