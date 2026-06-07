"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  CONFIG,
  CIUDADES,
  DEFAULT_PARAMS,
  calcularEnvioLCL,
  whatsappTextFromCotizacion,
  type EnvioInput,
  type EnvioCotizacion,
  type CalcParams,
  type Ciudad,
} from "@/lib/calculadora";
import { DecimalInput } from "@/components/DecimalInput";
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

export function CalculadoraForm({
  serverRate,
  serverConfig,
  ciudades,
}: {
  serverRate?: ServerRate;
  /** Reglas escalares reales (Fase 3 Slice A) o null → defaults de CONFIG. */
  serverConfig?: CalcParams | null;
  /** Ciudades reales (Fase 3 Slice B) o undefined → fallback a CIUDADES. */
  ciudades?: Ciudad[];
}) {
  // Tarifa base real o default de CONFIG (cero regresión si no hay pública).
  const baseRate =
    serverRate?.per_cbm && serverRate.per_cbm > 0
      ? serverRate.per_cbm
      : CONFIG.tarifaBaseCBM;
  // Piso real (mínimo facturable). Viaja al cálculo y define el punto de cruce.
  const minChargeOverride = serverRate?.min_charge ?? undefined;
  const minCharge =
    minChargeOverride && minChargeOverride > 0
      ? minChargeOverride
      : CONFIG.minimoFacturable;
  // Punto de cruce: CBM donde el cálculo (CBM × tarifa) iguala al mínimo. Por
  // debajo se cobra el piso. Se DERIVA de la tarifa → si cambia per_cbm, el
  // cruce se reacomoda solo (nada hardcodeado).
  const crossoverCbm = baseRate > 0 ? minCharge / baseRate : 0;
  const crossoverLabel = parseFloat(crossoverCbm.toFixed(4)).toString();
  // Reglas escalares: las reales (de /studio/tarifas › Parámetros) o defaults.
  const params = serverConfig ?? DEFAULT_PARAMS;
  // Ciudades: las reales (de /studio/tarifas › Ciudades) o el array hardcoded.
  const cityList = ciudades && ciudades.length > 0 ? ciudades : CIUDADES;
  // Destino inicial: la 1ª ciudad de la lista (o casco-central si existe).
  const defaultCiudadId =
    cityList.find((c) => c.id === "casco-central")?.id ??
    cityList[0]?.id ??
    "casco-central";

  const [form, setForm] = useState<EnvioInput>({
    cbmTotal: 0,
    pesoKg: 0,
    embalaje: "estandar",
    ciudadId: defaultCiudadId,
    bateria: false,
    cargaEspecial: false,
    tarifaCBMOverride: baseRate,
    minChargeOverride,
  });

  // El estimado se activa con "Calcular envío" y luego queda VIVO: cualquier
  // cambio del form (incluido el toggle de baterías que vive debajo del CTA)
  // recalcula solo, para que el precio mostrado nunca quede desactualizado.
  // Antes del primer cálculo, `cotizacion` es null (no se muestra nada).
  const [activo, setActivo] = useState(false);
  const cotizacion = useMemo(
    () => (activo ? calcularEnvioLCL(form, params, cityList) : null),
    [activo, form, params, cityList],
  );

  // En móvil el resultado cae debajo del form (1 columna): cada vez que se
  // toca "Calcular envío" llevamos al usuario directo al estimado. En desktop
  // el panel es sticky (te sigue al scrollear), así que no movemos el scroll.
  const resultRef = useRef<HTMLDivElement>(null);
  const [calcTick, setCalcTick] = useState(0);
  useEffect(() => {
    if (calcTick === 0) return;
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    const el = resultRef.current;
    if (!el) return;
    // Offset para despejar el nav sticky (~76px) y que el header del estimado
    // no quede tapado. scrollIntoView no contempla el nav fijo.
    const y = el.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, [calcTick]);

  // Vibración mínima del precio: arranca 5 s DESPUÉS de que el cliente cotiza
  // (le damos tiempo a leer el número, y recién ahí el precio "pide" atención).
  // Se resetea en cada nuevo cálculo.
  const [vibratePrice, setVibratePrice] = useState(false);
  useEffect(() => {
    if (calcTick === 0) return;
    const t = setTimeout(() => setVibratePrice(true), 5000);
    return () => clearTimeout(t);
  }, [calcTick]);

  function update<K extends keyof EnvioInput>(key: K, value: EnvioInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCalcular() {
    setActivo(true);
    setVibratePrice(false); // reset: vuelve a esperar 5 s antes de vibrar
    setCalcTick((t) => t + 1);
  }

  // Aviso de peso (simétrico al del CBM): el máximo de peso depende del CBM.
  // Por cada m³ entran `pesoIncluidoKg` kg sin recargo; sobre eso, $/kg de
  // excedente; sobre `pesoMaxKg`/CBM ya es demasiado denso (FCL). Todo se
  // deriva del CBM que puso el cliente + los parámetros (nada hardcodeado).
  const pesoWarning = ((): string | null => {
    if (form.pesoKg > CONFIG.pesoMaxContenedorKg)
      return "Esto es más que el peso permitido por contenedor; consulte a su asesor";
    if (form.cbmTotal <= 0 || form.pesoKg <= 0) return null;
    const fmt = (n: number) => parseFloat(n.toFixed(2)).toString();
    const maxSinRecargo = form.cbmTotal * params.pesoIncluidoKg;
    const maxDenso = form.cbmTotal * params.pesoMaxKg;
    if (form.pesoKg > maxDenso)
      return `Para ${fmt(form.cbmTotal)} m³, más de ${fmt(maxDenso)} kg es demasiado denso — consultá con tu asesor (FCL).`;
    if (form.pesoKg > maxSinRecargo) {
      const exceso = form.pesoKg - maxSinRecargo;
      const recargo = exceso * params.recargoExcedenteKg;
      return `El máximo de peso sin recargo para ${fmt(form.cbmTotal)} m³ es ${fmt(maxSinRecargo)} kg. Te pasás por ${fmt(exceso)} kg → +$${fmt(recargo)} ($${params.recargoExcedenteKg}/kg extra).`;
    }
    return null;
  })();

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
              <DecimalInput
                id="tarifa-cbm"
                value={form.tarifaCBMOverride ?? 0}
                onValueChange={(n) =>
                  update("tarifaCBMOverride", n > 0 ? n : baseRate)
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
              warning={
                form.cbmTotal > CONFIG.cbmMaxContenedor
                  ? "Eso es más que un contenedor. Consulte a su asesor"
                  : form.cbmTotal > 0 && form.cbmTotal < crossoverCbm
                    ? `Nuestro mínimo de carga es ${crossoverLabel} m³ — por debajo, el envío sale $${minCharge}.`
                    : null
              }
            />
            <InputField
              label="Peso total (kg)"
              value={form.pesoKg}
              onChange={(v) => update("pesoKg", v)}
              placeholder="450"
              warning={pesoWarning}
            />
          </fieldset>

          {/* Embalaje especial + carga especial. La caja estándar es el default
              (no se muestra); solo se marca lo que aplica. */}
          <div className="flex flex-col gap-2">
            <ToggleField
              label={`Embalaje especial (madera o paleta) +$${params.recargoEmbalajeEspecial}`}
              hint="Marcá solo si tu carga necesita paleta o caja de madera."
              checked={form.embalaje === "especial"}
              onChange={(v) => update("embalaje", v ? "especial" : "estandar")}
            />
            <ToggleField
              label="Carga especial o de alto valor"
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
              {cityList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.casco || c.id === "casco-central" ? "" : ` (${c.km} km)`}
                </option>
              ))}
            </select>
            <p className="text-[12px] text-grey-500 mt-2">
              Casco central (Valencia, Maracay, Caracas): sin recargo.
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

          {/* Baterías — debajo del CTA: el recargo ×1.5 sigue aplicando, pero se
              de-prioriza visualmente (decisión founder, no es factor primario). */}
          <ToggleField
            label="Lleva baterías"
            hint={`Recargo por manejo (×${params.recargoBateriaMult} sobre el flete).`}
            checked={!!form.bateria}
            onChange={(v) => update("bateria", v)}
          />
        </div>
      </div>

      {/* Resultado o panel de financiamiento (pre-cálculo). Post-cálculo el
          panel es sticky en desktop: te sigue al scrollear (no hay que volver
          arriba para el CTA de WhatsApp). En móvil, handleCalcular hace scroll. */}
      <div
        ref={resultRef}
        className={`flex flex-col ${cotizacion ? "lg:sticky lg:self-start lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto" : ""}`}
      >
        {cotizacion ? (
          <CotizacionDisplay cotizacion={cotizacion} input={form} params={params} vibrate={vibratePrice} />
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
  warning,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  /** Aviso inline (ámbar) bajo el campo, ej. cuando supera un límite. */
  warning?: string | null;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-grey-700">{label}</span>
      <DecimalInput
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        className={`px-3 py-2.5 rounded-[10px] border text-[15px] text-ink bg-white focus:outline-none ${
          warning
            ? "border-status-warning focus:border-status-warning"
            : "border-grey-200 focus:border-ink"
        }`}
      />
      {warning && (
        <span className="text-[11.5px] leading-[1.4] font-medium text-status-warning">
          {warning}
        </span>
      )}
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
  params,
  vibrate,
}: {
  cotizacion: EnvioCotizacion;
  input: EnvioInput;
  params: CalcParams;
  /** Activa la vibración mínima del precio (5 s post-cálculo). */
  vibrate: boolean;
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
              className={`text-[56px] leading-[1] text-white inline-block ${
                vibrate ? "price-vibrate" : ""
              }`}
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
          {/* Badge financiamiento — destacado y con micro-animación (breathing
              + dot "vivo") para llamar la atención sobre el gancho comercial. */}
          <div className="fin-badge mt-4 inline-flex items-center gap-2.5 text-[13.5px] font-semibold rounded-[12px] px-4 py-2.5 bg-white/20 text-white">
            <span className="fin-badge-dot" aria-hidden="true" />
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
                label={`Excedente de peso (>${params.pesoIncluidoKg} kg/CBM)`}
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
                label={`Recargo por baterías (×${params.recargoBateriaMult})`}
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

      {/* Nudge "ya casi está" (gancho B) — solo en el estimado real. El mensaje
          de WhatsApp ya va pre-armado, así que "enviar" se siente como un clic. */}
      {!hasAlerta && (
        <p className="text-[13.5px] text-white text-center leading-[1.4] -mb-1">
          Tu cotización ya está lista — <span className="font-semibold">solo falta enviarla.</span>
        </p>
      )}

      {/* CTA WhatsApp. `.btn` ya da inline-flex + center + gap. En desktop usa
          self-center (auto-ancho, ícono+texto ajustados, sin verde flotando);
          en móvil estira a full-width para mejor target táctil. */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn bg-whatsapp text-white lg:self-center"
      >
        <WhatsAppIcon size={20} />
        {hasAlerta ? "Consultar con un asesor" : "Enviar mi cotización por WhatsApp"}
      </a>

      {/* Microcopy anti-fricción (gancho A) — desarma el miedo a comprometerse. */}
      {!hasAlerta && (
        <p className="text-[12.5px] text-white/85 leading-[1.5] -mt-1 text-center">
          <span className="font-semibold text-white">Sin compromiso.</span> Un asesor
          te responde en minutos y te confirma la tarifa final — financiamiento 100%,
          pagás al llegar.
        </p>
      )}

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
