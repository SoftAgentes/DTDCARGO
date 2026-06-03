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
 *
 * El cliente que cotiza ya conoce su CBM total, así que pedimos el volumen
 * directo (no dimensiones por caja) + peso. Toggles para baterías y carga
 * especial (esta última deriva al asesor).
 */
/** Tarifa pública real (de /studio/tarifas vía RPC anon), o null → default CONFIG. */
type ServerRate = {
  per_cbm: number;
  min_charge: number | null;
  valid_until: string | null;
} | null;

export function CalculadoraForm({ serverRate }: { serverRate?: ServerRate }) {
  // Tarifa base real o default de CONFIG (cero regresión si no hay pública).
  const baseRate =
    serverRate?.per_cbm && serverRate.per_cbm > 0
      ? serverRate.per_cbm
      : CONFIG.tarifaBaseCBM;
  // Piso real (mínimo LCL comercial). Viaja al cálculo; no editable en V1.
  const minChargeOverride = serverRate?.min_charge ?? undefined;

  const [form, setForm] = useState<EnvioInput>({
    cbmTotal: 0,
    pesoKg: 0,
    embalaje: "estandar",
    ciudadId: "casco-central",
    bateria: false,
    cargaEspecial: false,
    tarifaCBMOverride: baseRate,
    minChargeOverride,
  });

  const [cotizacion, setCotizacion] = useState<EnvioCotizacion | null>(null);

  function update<K extends keyof EnvioInput>(key: K, value: EnvioInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCalcular() {
    setCotizacion(calcularEnvioLCL(form));
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
                    parseFloat(e.target.value) || baseRate,
                  )
                }
                placeholder={String(baseRate)}
                className="flex-1 px-3 py-2 rounded-[8px] border border-grey-200 text-[15px] text-ink bg-white focus:outline-none focus:border-ink"
              />
              <button
                type="button"
                onClick={() => update("tarifaCBMOverride", baseRate)}
                className="text-[12px] font-semibold text-wine hover:text-wine-deep transition-colors whitespace-nowrap"
              >
                Restaurar ${baseRate}
              </button>
            </div>
            <p className="text-[11.5px] text-grey-500 mt-2 leading-[1.4]">
              Tarifa estándar LCL DDP: ${baseRate}/CBM. Editá si tu
              cotización es distinta (negociación FCL, promoción, etc.).
            </p>
          </div>

          {/* CBM total + peso */}
          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine mb-2 col-span-2">
              Tu carga
            </legend>
            <InputField
              label="CBM total (m³)"
              value={form.cbmTotal}
              onChange={(v) => update("cbmTotal", v)}
              placeholder="2"
            />
            <InputField
              label="Peso total (kg)"
              value={form.pesoKg}
              onChange={(v) => update("pesoKg", v)}
              placeholder="450"
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
                  className="flex items-center gap-3 p-3 rounded-[10px] border border-grey-200 hover:border-ink cursor-pointer transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-ink focus-within:outline-offset-2"
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

          {/* Opciones extra: baterías + carga especial */}
          <div className="flex flex-col gap-2">
            <ToggleField
              label="Lleva baterías"
              hint="Recargo por manejo (×1.5 sobre el flete)."
              checked={!!form.bateria}
              onChange={(v) => update("bateria", v)}
            />
            <ToggleField
              label="Carga especial o peligrosa"
              hint="Equipos, insumos médicos, alto valor o permisos de exportación."
              checked={!!form.cargaEspecial}
              onChange={(v) => update("cargaEspecial", v)}
            />
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
                  {c.casco || c.id === "casco-central" ? "" : ` (${c.km} km)`}
                </option>
              ))}
            </select>
            <p className="text-[12px] text-grey-500 mt-2">
              Casco central (Valencia, Maracay, Caracas): sin recargo. Otras
              ciudades: +${CONFIG.tarifaKmFueraCasco}/km desde el casco.
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

      {/* Resultado o panel de financiamiento (pre-cálculo) */}
      <div className="flex flex-col">
        {cotizacion ? (
          <CotizacionDisplay cotizacion={cotizacion} input={form} />
        ) : (
          <div className="hidden lg:flex h-full">
            <FinanciamientoPanel />
          </div>
        )}
      </div>
    </div>
  );
}

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
      <span className="text-[12.5px] font-semibold text-grey-700">{label}</span>
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

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-[10px] border border-grey-200 hover:border-ink cursor-pointer transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-ink focus-within:outline-offset-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-wine mt-0.5"
      />
      <span className="flex flex-col">
        <span className="text-[14px] text-ink">{label}</span>
        <span className="text-[11.5px] text-grey-500 leading-[1.4]">{hint}</span>
      </span>
    </label>
  );
}

/**
 * Panel ambiental del lado derecho (desktop) mientras el cliente no calculó.
 * Refuerza el gancho comercial: financiamiento 100%, pago al arribo.
 */
function FinanciamientoPanel() {
  return (
    <div className="card-shadow-dark bg-ink text-white rounded-[18px] p-7 lg:p-9 w-full flex flex-col justify-center min-h-[400px]">
      <div className="eyebrow text-white/50">
        Financiamiento 100%*
      </div>
      <h3
        className="mt-3 text-[26px] lg:text-[30px] leading-[1.1] tracking-[-0.01em]"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        No pagás nada hasta que tu carga llegue.
      </h3>
      <p className="mt-4 text-[14.5px] leading-[1.55] text-white/80">
        Cubrimos el viaje, la aduana y los impuestos. Cancelás al arribar a
        Venezuela y recién ahí coordinamos la entrega — exactamente lo que
        cotizaste.
      </p>
      <ul className="mt-5 flex flex-col gap-2 text-[13.5px] text-white/75 list-none p-0">
        <li>· Tarifas en dólares (USD).</li>
        <li>· Casco central (Valencia · Maracay · Caracas): sin recargo.</li>
        <li>· Tu estimado aparece acá cuando calculás.</li>
      </ul>
      <p className="mt-6 text-[11.5px] text-white/45 leading-[1.45]">
        *Aplican restricciones.
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
      <div className="eyebrow text-white/50">
        Estimado de tu envío
      </div>

      {/* Precio destacado (solo si hay total) */}
      {!hasAlerta && (
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
          {/* Badge financiamiento */}
          <div className="mt-3 inline-flex items-center gap-2 text-[12px] rounded-[8px] px-3 py-1.5 bg-white/10 text-white/85">
            Financiamiento 100% · pagás al llegar a Venezuela*
          </div>
        </div>
      )}

      {/* Alerta si hay */}
      {hasAlerta && (
        <div
          className="p-4 rounded-[10px] border-l-[3px] border-status-warning"
          style={{ background: "rgba(184,137,58,0.12)" }}
        >
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase mb-1 text-status-warning">
            Atención
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
                label={`Excedente de peso (>${CONFIG.pesoIncluidoKg} kg/CBM)`}
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
                label="Embalaje especial (paleta/madera)"
                value={cot.recargoEmbalaje}
              />
            )}
            {cot.recargoBateria > 0 && (
              <DesgloseRow
                label="Recargo por baterías (×1.5)"
                value={cot.recargoBateria}
              />
            )}
            {cot.descuentoSede < 0 && (
              <DesgloseRow
                label="Descuento entrega en Valencia"
                value={cot.descuentoSede}
                negative
              />
            )}
            {cot.ajusteMinimo > 0 && (
              <DesgloseRow
                label="Ajuste a mínimo facturable (LCL)"
                value={cot.ajusteMinimo}
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
        className="btn bg-whatsapp text-white mt-2 inline-flex items-center justify-center gap-2"
      >
        <WhatsAppIcon size={20} />
        {hasAlerta ? "Consultar con un asesor" : "Confirmar tarifa por WhatsApp"}
      </a>

      <p className="text-[11.5px] text-white/45 leading-[1.45]">
        Este estimado es aproximado y refleja nuestra tarifa LCL DDP base.
        La tarifa final puede variar según tipo de mercancía, documentación
        del proveedor, fechas de salida y otros factores operativos.
        *Aplican restricciones.
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
