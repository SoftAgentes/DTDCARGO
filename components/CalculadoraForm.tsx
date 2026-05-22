"use client";

import { useState } from "react";
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

          {/* Dimensiones por caja */}
          <fieldset className="grid grid-cols-3 gap-3">
            <legend className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine mb-2 col-span-3">
              Dimensiones por caja (cm)
            </legend>
            <InputField
              label="Largo"
              value={form.largoCm}
              onChange={(v) => update("largoCm", v)}
              placeholder="60"
            />
            <InputField
              label="Ancho"
              value={form.anchoCm}
              onChange={(v) => update("anchoCm", v)}
              placeholder="40"
            />
            <InputField
              label="Alto"
              value={form.altoCm}
              onChange={(v) => update("altoCm", v)}
              placeholder="50"
            />
          </fieldset>

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

      {/* Resultado */}
      <div className="flex flex-col">
        {cotizacion ? (
          <CotizacionDisplay cotizacion={cotizacion} input={form} />
        ) : (
          <CotizacionPlaceholder />
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
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
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
        placeholder={placeholder}
        className="px-3 py-2.5 rounded-[10px] border border-grey-200 text-[15px] text-ink bg-white focus:outline-none focus:border-ink"
      />
    </label>
  );
}

function CotizacionPlaceholder() {
  return (
    <div className="card-shadow bg-paper border border-grey-200 rounded-[18px] p-7 lg:p-9 h-full flex flex-col items-center justify-center text-center min-h-[400px]">
      <div className="w-16 h-16 rounded-full bg-wine/10 grid place-items-center mb-5">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-wine"
          aria-hidden
        >
          <path d="M9 11H5a2 2 0 0 0-2 2v7h6m4 0h6v-7a2 2 0 0 0-2-2h-4m-4 9V8a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v13" />
        </svg>
      </div>
      <h3
        className="text-[18px] leading-[1.2] text-ink mb-2"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        Tu cotización aparecerá acá
      </h3>
      <p className="text-[13.5px] text-grey-500 leading-[1.55] max-w-[32ch]">
        Completá las dimensiones, peso y destino, y obtené un estimado
        inmediato basado en nuestras tarifas reales.
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
