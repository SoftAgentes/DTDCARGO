"use client";

import { useEffect, useRef, useState } from "react";
import {
  CONFIG,
  CIUDADES,
  EMBALAJES,
  calcularEnvioLCL,
  whatsappTextFromCotizacion,
  type EnvioInput,
  type EnvioCotizacion,
  type TipoEmbalaje,
} from "@/lib/calculadora";
import { CONTACT } from "@/lib/design-tokens";
import { ArrowIcon, WhatsAppIcon } from "@/components/Icon";

/**
 * Calculadora LCL DDP — UI del formulario + render del resultado.
 *
 * Toda la lógica de pricing vive en lib/calculadora.ts. Este componente
 * solo gestiona el state del form, llama a calcularEnvioLCL(), y muestra
 * el desglose con un CTA de WhatsApp preconfigurado.
 */
export function CalculadoraForm() {
  const [form, setForm] = useState<EnvioInput>({
    largoCm: 0,
    anchoCm: 0,
    altoCm: 0,
    pesoKg: 0,
    cantidadCajas: 1,
    embalaje: "carton",
    ciudadId: "valencia",
    tarifaCBMOverride: CONFIG.tarifaBaseCBM,
  });

  const [cotizacion, setCotizacion] = useState<EnvioCotizacion | null>(null);

  // ─── Diagrama de dimensiones — UX hover-first + click-to-repeat ───
  // Mismo comportamiento que en CotizarForm: el SVG educativo aparece
  // automáticamente la primera vez que el usuario hover sobre L/A/H,
  // y vuelve a aparecer cada vez que clickea/foca uno de esos campos.
  const [showDiagram, setShowDiagram] = useState(false);
  const [hasShownViaHover, setHasShownViaHover] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showDiagramFor3s = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowDiagram(true);
    hideTimerRef.current = setTimeout(() => setShowDiagram(false), 3000);
  };

  const onDimensionsHover = () => {
    if (!hasShownViaHover) {
      setHasShownViaHover(true);
      showDiagramFor3s();
    }
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  function update<K extends keyof EnvioInput>(key: K, value: EnvioInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCalcular() {
    const result = calcularEnvioLCL(form);
    setCotizacion(result);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12">
      {/* Form */}
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9">
        <h2
          className="text-[20px] lg:text-[22px] leading-[1.15] tracking-[-0.01em] text-ink mb-6"
          style={{ fontFamily: "var(--font-archivo-black)" }}
        >
          Calculá tu envío
        </h2>

        <div className="flex flex-col gap-5">
          {/* Costo CBM (editable) — el cliente puede usar la tarifa estándar
              o ingresar una negociada distinta */}
          <div className="bg-paper border border-grey-200 rounded-[12px] p-4">
            <label
              htmlFor="tarifa-cbm"
              className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine mb-2 block"
            >
              Costo CBM (USD)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-grey-500 text-[15px] font-medium">$</span>
              <input
                id="tarifa-cbm"
                type="number"
                min={1}
                step="any"
                value={form.tarifaCBMOverride || ""}
                onChange={(e) =>
                  update(
                    "tarifaCBMOverride",
                    parseFloat(e.target.value) || CONFIG.tarifaBaseCBM,
                  )
                }
                placeholder={String(CONFIG.tarifaBaseCBM)}
                className="flex-1 px-3 py-2 rounded-[8px] border border-grey-200 text-[15px] text-ink bg-white focus:outline-none focus:border-ink"
              />
              <button
                type="button"
                onClick={() =>
                  update("tarifaCBMOverride", CONFIG.tarifaBaseCBM)
                }
                className="text-[12px] font-semibold text-wine hover:text-wine-deep transition-colors whitespace-nowrap"
              >
                Restaurar ${CONFIG.tarifaBaseCBM}
              </button>
            </div>
            <p className="text-[11.5px] text-grey-500 mt-2 leading-[1.4]">
              Tarifa estándar LCL DDP: ${CONFIG.tarifaBaseCBM}/CBM. Editá si tu
              cotización es distinta (negociación FCL, promoción, etc.).
            </p>
          </div>

          {/* Dimensiones por caja + diagrama flotante educativo (solo mobile) */}
          <div className="relative" onMouseEnter={onDimensionsHover}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine">
                Dimensiones por caja (cm)
              </span>
              {/* En desktop el SVG vive permanentemente en el panel derecho,
                  asi que el boton "Como medir?" solo aporta valor en mobile. */}
              <button
                type="button"
                onClick={showDiagramFor3s}
                className="lg:hidden text-[11.5px] font-medium text-wine hover:text-wine-deep underline underline-offset-2"
              >
                ¿Cómo medir?
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <InputField
                label="Largo"
                value={form.largoCm}
                onChange={(v) => update("largoCm", v)}
                placeholder="60"
                onTrigger={showDiagramFor3s}
              />
              <InputField
                label="Ancho"
                value={form.anchoCm}
                onChange={(v) => update("anchoCm", v)}
                placeholder="40"
                onTrigger={showDiagramFor3s}
              />
              <InputField
                label="Alto"
                value={form.altoCm}
                onChange={(v) => update("altoCm", v)}
                placeholder="50"
                onTrigger={showDiagramFor3s}
              />
            </div>

            {/* Diagrama flotante: SOLO mobile (lg:hidden). En desktop esta
                permanente en el panel derecho via DimensionsAmbientSVG. */}
            <div
              aria-hidden={!showDiagram}
              className={`lg:hidden absolute left-1/2 -translate-x-1/2 top-full mt-3 z-30 w-full max-w-[420px] pointer-events-none transition-all duration-500 ease-out ${
                showDiagram
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 -translate-y-2"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/dtdcargo-dimensions-box.svg"
                alt="Diagrama: cómo medir el largo, ancho y alto de una caja"
                width={600}
                height={500}
                className="w-full h-auto drop-shadow-[0_20px_40px_rgba(15,30,61,0.25)]"
              />
            </div>
          </div>

          {/* Peso + cantidad */}
          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine mb-2 col-span-2">
              Peso y cantidad
            </legend>
            <InputField
              label="Peso total (kg)"
              value={form.pesoKg}
              onChange={(v) => update("pesoKg", v)}
              placeholder="450"
            />
            <InputField
              label="Cantidad de cajas"
              value={form.cantidadCajas}
              onChange={(v) => update("cantidadCajas", v)}
              placeholder="1"
            />
          </fieldset>

          {/* Embalaje */}
          <div>
            <label className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine mb-2 block">
              Embalaje
            </label>
            <div className="flex flex-col gap-2">
              {EMBALAJES.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-3 p-3 rounded-[10px] border border-grey-200 hover:border-ink cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="embalaje"
                    value={e.id}
                    checked={form.embalaje === e.id}
                    onChange={() => update("embalaje", e.id as TipoEmbalaje)}
                    className="accent-wine"
                  />
                  <span className="text-[14px] text-ink flex-1">{e.label}</span>
                  {e.recargo > 0 && (
                    <span className="text-[12px] text-grey-500">+${e.recargo}</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Ciudad destino */}
          <div>
            <label
              htmlFor="ciudad"
              className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine mb-2 block"
            >
              Ciudad de destino
            </label>
            <select
              id="ciudad"
              value={form.ciudadId}
              onChange={(e) => update("ciudadId", e.target.value)}
              className="w-full px-4 py-3 rounded-[10px] border border-grey-200 text-[15px] text-ink bg-white focus:outline-none focus:border-ink"
            >
              {CIUDADES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.casco ? "" : ` (${c.km} km)`}
                </option>
              ))}
            </select>
            <p className="text-[12px] text-grey-500 mt-2">
              Casco central (Valencia, Maracay, Caracas): sin recargo. Otras
              ciudades: +${CONFIG_TARIFA_KM_PUBLIC}/km desde el casco.
            </p>
          </div>

          {/* CTA Calcular */}
          <button
            type="button"
            onClick={handleCalcular}
            className="btn btn-primary w-full mt-2"
          >
            Calcular envío <ArrowIcon />
          </button>
        </div>
      </div>

      {/* Resultado o SVG ambiental educativo (solo desktop) */}
      <div className="flex flex-col">
        {cotizacion ? (
          <CotizacionDisplay cotizacion={cotizacion} input={form} />
        ) : (
          // hidden lg:flex: en mobile no se muestra (el popover educativo
          // ya cubre esa necesidad y un placeholder vacio agrega scroll
          // innecesario). En desktop, el SVG vive aca como contenido ambiental
          // hasta que el usuario calcule.
          <div className="hidden lg:flex h-full">
            <DimensionsAmbientSVG />
          </div>
        )}
      </div>
    </div>
  );
}

/** Solo para mostrar el valor en el helper. Si CONFIG cambia, hay que sincronizar acá. */
const CONFIG_TARIFA_KM_PUBLIC = 1;

// ─────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────

function InputField({
  label,
  value,
  onChange,
  placeholder,
  onTrigger,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  /** Opcional: callback que dispara el popover del diagrama (solo en L/A/H). */
  onTrigger?: () => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] text-grey-700 font-medium">{label}</span>
      <input
        type="number"
        min={0}
        step="any"
        value={value || ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        onClick={onTrigger}
        onFocus={onTrigger}
        placeholder={placeholder}
        className="px-3 py-2.5 rounded-[10px] border border-grey-200 text-[15px] text-ink bg-white focus:outline-none focus:border-ink"
      />
    </label>
  );
}

/**
 * Placeholder ambiental del panel derecho (desktop only). En vez de mostrar
 * un empty-state generico, mostramos el SVG educativo de "como medir L/A/H"
 * como contenido permanente. Razon: el usuario llega a esta pagina sin saber
 * exactamente que medir, y el SVG responde esa pregunta antes de que la haga.
 * Cuando calcula, este componente se reemplaza por CotizacionDisplay.
 */
function DimensionsAmbientSVG() {
  return (
    <div className="card-shadow bg-paper border border-grey-200 rounded-[18px] p-7 lg:p-9 w-full flex flex-col items-center justify-center text-center min-h-[400px]">
      <div className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-wine mb-5">
        ¿Cómo medir tu caja?
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/dtdcargo-dimensions-box.svg"
        alt="Diagrama: cómo medir el largo, ancho y alto de una caja"
        width={600}
        height={500}
        className="w-full h-auto max-w-[380px] mb-6 drop-shadow-[0_12px_24px_rgba(15,30,61,0.12)]"
      />
      <h3
        className="text-[18px] leading-[1.2] text-ink mb-2"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        Largo × Ancho × Alto · en centímetros
      </h3>
      <p className="text-[13.5px] text-grey-500 leading-[1.55] max-w-[34ch]">
        Medí cada caja por afuera. Si tenés cajas de distintos tamaños, usá
        el promedio. Tu cotización aparece acá cuando calculás.
      </p>
    </div>
  );
}

function CotizacionDisplay({
  cotizacion,
  input,
}: {
  cotizacion: EnvioCotizacion;
  input: EnvioInput;
}) {
  const cot = cotizacion;
  const hasAlerta = !!cot.alerta;

  // Mensaje pre-armado para WhatsApp
  const whatsappText = whatsappTextFromCotizacion(cot, input);
  const whatsappUrl = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(whatsappText)}`;

  return (
    <div className="card-shadow-dark bg-ink text-white rounded-[18px] p-7 lg:p-9 flex flex-col gap-5">
      <div className="eyebrow" style={{ color: "rgba(255,255,255,0.5)" }}>
        Estimado de tu envío
      </div>

      {/* Precio destacado */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] text-white/55">US$</span>
          <span
            className="text-[56px] leading-[1] text-white"
            style={{ fontFamily: "var(--font-archivo-black)" }}
          >
            {cot.total.toFixed(0)}
          </span>
          <span className="text-[15px] text-white/55">aproximado</span>
        </div>
        {cot.cbm > 0 && (
          <div className="text-[13.5px] text-white/65 mt-2">
            {cot.cbm} CBM · {cot.densidadKgM3.toFixed(0)} kg/m³ · destino {cot.ciudad?.label}
          </div>
        )}
      </div>

      {/* Alerta si hay */}
      {hasAlerta && (
        <div
          className="p-4 rounded-[10px] border-l-[3px]"
          style={{
            background: "rgba(255,165,0,0.08)",
            borderLeftColor: "#FFA500",
          }}
        >
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase mb-1" style={{ color: "#FFA500" }}>
            ⚠️ Atención
          </div>
          <p className="text-[13.5px] leading-[1.5] text-white/85">
            {cot.alerta!.mensaje}
          </p>
        </div>
      )}

      {/* Desglose */}
      {!hasAlerta && cot.cbm > 0 && (
        <div className="border-t border-white/10 pt-5">
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-white/55 mb-3">
            Desglose
          </div>
          <ul className="flex flex-col gap-2 text-[13.5px] list-none p-0">
            <DesgloseRow
              label={`Volumen base (${cot.cbm} CBM × $${(input.tarifaCBMOverride && input.tarifaCBMOverride > 0 ? input.tarifaCBMOverride : CONFIG.tarifaBaseCBM)})`}
              value={cot.precioBase}
            />
            {cot.recargoExcedente > 0 && (
              <DesgloseRow
                label="Excedente de peso (>500 kg/CBM)"
                value={cot.recargoExcedente}
              />
            )}
            {cot.recargoCiudad > 0 && (
              <DesgloseRow
                label={`Distancia fuera del casco central (${cot.ciudad?.km} km)`}
                value={cot.recargoCiudad}
              />
            )}
            {cot.recargoEmbalaje > 0 && (
              <DesgloseRow
                label="Embalaje no estándar (paleta/madera)"
                value={cot.recargoEmbalaje}
              />
            )}
            {cot.descuentoSede < 0 && (
              <DesgloseRow
                label="Descuento entrega en Valencia"
                value={cot.descuentoSede}
                negative
              />
            )}
            <li className="flex justify-between border-t border-white/15 pt-2.5 mt-1 font-bold text-white">
              <span>Total estimado</span>
              <span>US$ {cot.total.toFixed(2)}</span>
            </li>
          </ul>
        </div>
      )}

      {/* CTA WhatsApp */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn mt-2 inline-flex items-center justify-center gap-2"
        style={{ background: "#25D366", color: "white" }}
      >
        <WhatsAppIcon size={20} />
        Confirmar tarifa por WhatsApp
      </a>

      <p className="text-[11.5px] text-white/45 leading-[1.45]">
        Este estimado es aproximado y refleja nuestra tarifa LCL DDP base.
        La tarifa final puede variar según tipo de mercancía, documentación
        del proveedor, fechas de salida y otros factores operativos.
      </p>
    </div>
  );
}

function DesgloseRow({
  label,
  value,
  negative = false,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <li className="flex justify-between text-white/80">
      <span className="text-white/70">{label}</span>
      <span className={negative ? "text-status-success" : ""}>
        {negative ? "" : "+"}US$ {value.toFixed(2)}
      </span>
    </li>
  );
}
