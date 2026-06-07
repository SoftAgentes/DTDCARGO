"use client";

import { useMemo, useState } from "react";
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
import Link from "next/link";
import { DecimalInput } from "@/components/DecimalInput";
import { CONTACT } from "@/lib/design-tokens";
import { ArrowIcon, WhatsAppIcon } from "@/components/Icon";
import { EstimadoModal, type EstimadoContact } from "@/components/EstimadoModal";
import { buildEstimadoWhatsAppMessage } from "@/lib/public/estimado-web";

/**
 * Calculadora LCL DDP — UI del formulario + render del resultado.
 *
 * Diseño Cloud Design (Fase 2, 2026-06-06): una sola card en 2 columnas con
 * divisor — izquierda = entrada (header + tarifa + carga + opciones + destino),
 * derecha = resultado (contenedor que se llena + panel del total + desglose +
 * badge + nudge + CTA). 100% EN VIVO: sin botón "Calcular", el estimado se
 * recalcula con cada cambio. Toda la lógica de pricing vive en lib/calculadora.ts.
 */
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
  serverConfig?: CalcParams | null;
  ciudades?: Ciudad[];
}) {
  // Tarifa base real o default de CONFIG (cero regresión si no hay pública).
  const baseRate =
    serverRate?.per_cbm && serverRate.per_cbm > 0
      ? serverRate.per_cbm
      : CONFIG.tarifaBaseCBM;
  const minChargeOverride = serverRate?.min_charge ?? undefined;
  const minCharge =
    minChargeOverride && minChargeOverride > 0
      ? minChargeOverride
      : CONFIG.minimoFacturable;
  // Punto de cruce: CBM donde el cálculo iguala al mínimo. Derivado de la tarifa.
  const crossoverCbm = baseRate > 0 ? minCharge / baseRate : 0;
  const crossoverLabel = parseFloat(crossoverCbm.toFixed(4)).toString();
  const params = serverConfig ?? DEFAULT_PARAMS;
  const cityList = ciudades && ciudades.length > 0 ? ciudades : CIUDADES;
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

  // SDD-0061 Fase B1 · modal de captura del estimado web (nota + nombre + tel).
  const [modalOpen, setModalOpen] = useState(false);
  // SDD-0061 Fase B2 · código del estimado guardado (para el CTA de registro).
  const [savedEstimateCode, setSavedEstimateCode] = useState<string | null>(null);

  function update<K extends keyof EnvioInput>(key: K, value: EnvioInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Estimado SIEMPRE en vivo (no hay botón Calcular). Si falta CBM/peso, la
  // función devuelve una alerta "carga_invalida" que tratamos como estado vacío.
  const cotizacion = useMemo(
    () => calcularEnvioLCL(form, params, cityList),
    [form, params, cityList],
  );
  const tieneCarga = form.cbmTotal > 0 && form.pesoKg > 0;

  // Aviso del CBM: mínimo (punto de cruce) o máximo (contenedor).
  const cbmWarning =
    form.cbmTotal > params.cbmMaxContenedor
      ? "Eso es más que un contenedor. Consulte a su asesor."
      : form.cbmTotal > 0 && form.cbmTotal < crossoverCbm
        ? `Nuestro mínimo de carga es ${crossoverLabel} m³ — por debajo, el envío sale $${minCharge}.`
        : null;

  // Aviso del peso (simétrico al del CBM): máximo de peso según el CBM.
  const pesoWarning = ((): string | null => {
    if (form.pesoKg > params.pesoMaxContenedorKg)
      return "Esto es más que el peso permitido por contenedor; consulte a su asesor.";
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

  // Confirmar desde el modal: ya tenemos el EST del ERP (o null), abrimos wa.me.
  function handleConfirm(contact: EstimadoContact, estimateCode: string | null) {
    const base = whatsappTextFromCotizacion(cotizacion, form);
    const text = buildEstimadoWhatsAppMessage({
      baseMessage: base,
      nota: contact.nota,
      estimateCode,
    });
    const url = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setSavedEstimateCode(estimateCode);
    setModalOpen(false);
  }

  return (
    <>
    <div className="card-shadow bg-white border border-grey-200 rounded-[20px] overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* ── COLUMNA IZQUIERDA · ENTRADA ── */}
        <div className="p-6 lg:p-9 lg:border-r border-grey-200 flex flex-col gap-5">
          {/* Wordmark + eyebrow */}
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-[19px] leading-none"
              style={{ fontFamily: "var(--font-brand-display)" }}
            >
              <span className="text-wine">DTD</span>{" "}
              <span className="text-ink">Cargo</span>
            </span>
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine">
              Calculadora LCL DDP
            </span>
          </div>

          {/* Título + subtítulo */}
          <div>
            <h2
              className="text-[26px] lg:text-[30px] leading-[1.1] tracking-[-0.01em] text-ink"
              style={{ fontFamily: "var(--font-archivo-black)" }}
            >
              Cotizá tu carga China → Venezuela
            </h2>
            <p className="mt-2.5 text-[14px] text-grey-700 leading-[1.5]">
              Puerta a puerta, financiamiento 100%. Indicá tu volumen y peso y te
              damos un estimado al instante.
            </p>
          </div>

          {/* Tarifa de CBM */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label
                htmlFor="tarifa-cbm"
                className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-500"
              >
                Tarifa de CBM
              </label>
              <span className="text-[9.5px] font-bold tracking-[0.08em] uppercase text-wine bg-wine/10 rounded-[6px] px-2 py-[3px]">
                Auto · editable
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-[12px] border border-grey-200 px-3.5 h-[52px] bg-white focus-within:border-ink transition-colors">
              <span className="text-grey-500 text-[16px] font-medium">$</span>
              <DecimalInput
                id="tarifa-cbm"
                value={form.tarifaCBMOverride ?? 0}
                onValueChange={(n) =>
                  update("tarifaCBMOverride", n > 0 ? n : baseRate)
                }
                placeholder={String(baseRate)}
                className="num flex-1 min-w-0 bg-transparent text-[18px] font-semibold text-ink outline-none"
              />
              <span className="text-[12px] text-grey-500 whitespace-nowrap">
                USD/CBM
              </span>
            </div>
            <p className="text-[11.5px] text-grey-500 mt-1.5 leading-[1.4]">
              La genera el sistema. Ajustala si tu cotización es distinta.
            </p>
          </div>

          {/* CBM total + Peso total */}
          <div className="grid grid-cols-2 gap-3">
            <BigInput
              label="CBM total"
              suffix="m³"
              value={form.cbmTotal}
              onChange={(v) => update("cbmTotal", v)}
              placeholder="12"
              warning={cbmWarning}
            />
            <BigInput
              label="Peso total"
              suffix="kg"
              value={form.pesoKg}
              onChange={(v) => update("pesoKg", v)}
              placeholder="4800"
              warning={pesoWarning}
            />
          </div>

          {/* Opciones (switches) */}
          <div className="flex flex-col gap-2.5">
            <SwitchField
              label="Embalaje especial"
              hint="Madera o paleta"
              badge={`+$${params.recargoEmbalajeEspecial}`}
              checked={form.embalaje === "especial"}
              onChange={(v) => update("embalaje", v ? "especial" : "estandar")}
            />
            <SwitchField
              label="Lleva baterías"
              hint="Recargo por manejo de litio"
              badge={`×${params.recargoBateriaMult}`}
              checked={!!form.bateria}
              onChange={(v) => update("bateria", v)}
            />
            <SwitchField
              label="Carga especial o de alto valor"
              hint="Frágil, peligrosa o con permisos — la vemos a medida"
              checked={!!form.cargaEspecial}
              onChange={(v) => update("cargaEspecial", v)}
            />
          </div>

          {/* Destino */}
          <div>
            <label
              htmlFor="ciudad"
              className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-500 mb-2 block"
            >
              Destino en Venezuela
            </label>
            <select
              id="ciudad"
              value={form.ciudadId}
              onChange={(e) => update("ciudadId", e.target.value)}
              className="w-full px-3.5 h-[52px] rounded-[12px] border border-grey-200 text-[15px] text-ink bg-white focus:outline-none focus:border-ink"
            >
              {cityList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── COLUMNA DERECHA · RESULTADO ── */}
        <div className="p-6 lg:p-9 bg-paper flex flex-col gap-4">
          <ContainerFill cbm={form.cbmTotal} max={params.cbmMaxContenedor} />
          <ResultPanel
            cotizacion={cotizacion}
            input={form}
            tieneCarga={tieneCarga}
            onEstimar={() => setModalOpen(true)}
          />
        </div>
      </div>

      {/* Nota al pie · ancho completo */}
      <div className="border-t border-grey-200 px-6 lg:px-9 py-4">
        <p className="text-[11.5px] text-grey-500 leading-[1.5]">
          <strong className="text-grey-700">* Financiamiento 100%:</strong> pagás
          el flete al llegar a Venezuela. <strong className="text-grey-700">Aplican
          restricciones.</strong>{" "}
          Este estimado es aproximado y refleja nuestra tarifa base DDP (puerta a
          puerta).
        </p>
      </div>
    </div>

      {/* SDD-0061 Fase B2 — confirmación post-estimado + CTA opcional de registro
          (baja fricción). Solo si el ERP devolvió código (si falló, no hay qué
          vincular). */}
      {savedEstimateCode && (
        <div className="mt-4 card-shadow bg-white border border-grey-200 rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine">
              Estimado guardado ·{" "}
              <span style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}>
                {savedEstimateCode}
              </span>
            </div>
            <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.45]">
              <strong className="text-ink">Registrate y obtené tu MARKBOX.</strong>{" "}
              Vinculamos este estimado a tu cuenta automáticamente.
            </p>
          </div>
          <Link
            href={`/portal/registro?est=${encodeURIComponent(savedEstimateCode)}`}
            className="btn btn-primary flex-shrink-0"
          >
            Crear cuenta <ArrowIcon />
          </Link>
        </div>
      )}

      <EstimadoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirm}
        buildPayload={() => ({
          calc: "lcl",
          origin: "China",
          destination: cotizacion.ciudad?.label ?? "Venezuela",
          cbm: form.cbmTotal,
          weightKg: form.pesoKg,
          packaging: form.embalaje === "especial" ? "madera" : "carton",
          totalUsd: cotizacion.total,
          subtotalUsd: cotizacion.total,
        })}
      />
    </>
  );
}

// ─────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────

/** Input grande con sufijo (m³/kg) y aviso inline ámbar. Número en mono. */
function BigInput({
  label,
  suffix,
  value,
  onChange,
  placeholder,
  warning,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  warning?: string | null;
}) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </span>
      <div
        className={`flex items-center gap-2 rounded-[12px] border px-3.5 h-[60px] bg-white transition-colors ${
          warning
            ? "border-status-warning"
            : "border-grey-200 focus-within:border-ink"
        }`}
      >
        <DecimalInput
          value={value}
          onValueChange={onChange}
          placeholder={placeholder}
          className="num flex-1 min-w-0 bg-transparent text-[24px] font-bold text-ink outline-none"
        />
        <span className="text-[13px] text-grey-500 whitespace-nowrap">{suffix}</span>
      </div>
      {warning && (
        <span className="text-[11px] leading-[1.35] font-medium text-status-warning">
          {warning}
        </span>
      )}
    </label>
  );
}

/** Toggle tipo switch (iOS-like) con label + hint + badge opcional. */
function SwitchField({
  label,
  hint,
  badge,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  badge?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 p-3.5 rounded-[12px] border cursor-pointer transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-ink focus-within:outline-offset-2 ${
        checked ? "border-wine bg-wine/5" : "border-grey-200 hover:border-grey-500"
      }`}
    >
      <span
        className={`relative inline-flex shrink-0 h-[26px] w-[46px] rounded-full transition-colors ${
          checked ? "bg-wine" : "bg-grey-300"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow transition-all ${
            checked ? "left-[23px]" : "left-[3px]"
          }`}
        />
      </span>
      <span className="flex flex-col flex-1 min-w-0">
        <span className="text-[14px] font-semibold text-ink leading-[1.2]">
          {label}
        </span>
        <span className="text-[11.5px] text-grey-500 leading-[1.35]">{hint}</span>
      </span>
      {badge && (
        <span className="num text-[12px] font-semibold text-grey-500 whitespace-nowrap">
          {badge}
        </span>
      )}
    </label>
  );
}

/**
 * Contenedor 40'HC que se LLENA con el CBM. El relleno wine escala con `cbm/max`
 * vía `transform: scaleX()` (no `width %`). Corrugado vertical de fondo, "% LLENO"
 * centrado, y una "puerta" como segmento aparte a la derecha.
 */
function ContainerFill({ cbm, max }: { cbm: number; max: number }) {
  const ratio = max > 0 ? Math.min(Math.max(cbm, 0) / max, 1) : 0;
  const pct = max > 0 ? Math.round((Math.max(cbm, 0) / max) * 100) : 0;
  const over = cbm > max;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-500">
          En un contenedor 40&apos;HC
        </span>
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-500">
          <span className="num">{max}</span> CBM
        </span>
      </div>
      <div className="flex gap-2 items-stretch h-[140px]">
        {/* Cuerpo del contenedor */}
        <div className="relative flex-1 rounded-[12px] border-2 border-ink overflow-hidden bg-white">
          {/* Corrugado vertical */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0, transparent 13px, rgba(15,30,61,0.10) 13px, rgba(15,30,61,0.10) 14px)",
            }}
          />
          {/* Relleno wine (scaleX desde la izquierda) */}
          <div
            className="absolute inset-y-0 left-0 w-full bg-wine"
            style={{
              transformOrigin: "left",
              transform: `scaleX(${ratio})`,
              transition: "transform 600ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
          {/* % lleno centrado */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="num text-[34px] leading-none text-ink"
              style={{ fontFamily: "var(--font-archivo-black)" }}
            >
              {over ? "100%+" : `${pct}%`}
            </span>
            <span className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-grey-500 mt-1">
              Lleno
            </span>
          </div>
        </div>
        {/* Puerta del contenedor */}
        <div className="w-[40px] rounded-[12px] border-2 border-ink flex items-center justify-center gap-1.5">
          <span className="block w-[3px] h-[44px] rounded bg-ink/45" />
          <span className="block w-[3px] h-[44px] rounded bg-ink/45" />
        </div>
      </div>
    </div>
  );
}

/**
 * Panel del resultado: total (gradiente navy) + badge financiamiento + nudge
 * "ya está lista" (vibración mínima) + CTA WhatsApp + microcopy. Maneja 3
 * estados: vacío (sin CBM/peso), deriva al asesor (alerta), normal. Muestra
 * SOLO el monto total — sin desglose itemizado (el recargo por distancia es
 * interno y va dentro del total, decisión founder).
 */
function ResultPanel({
  cotizacion: cot,
  input,
  tieneCarga,
  onEstimar,
}: {
  cotizacion: EnvioCotizacion;
  input: EnvioInput;
  tieneCarga: boolean;
  /** Abre el modal de captura del estimado web (caso con precio válido). */
  onEstimar: () => void;
}) {
  const hasAlerta = !!cot.alerta && tieneCarga;
  const money = (n: number) =>
    `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
  // Caso "deriva al asesor" (carga especial / fuera de contenedor): no hay un
  // estimado que capturar → CTA directo a WhatsApp con el texto de la alerta.
  const whatsappText = whatsappTextFromCotizacion(cot, input);
  const whatsappUrl = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(whatsappText)}`;

  return (
    <>
      {/* Panel del total (gradiente navy) */}
      <div
        className="rounded-[16px] p-5 lg:p-6 text-white"
        style={{ background: "linear-gradient(150deg, var(--color-ink), #1F3055)" }}
      >
        <div
          className="text-[11px] font-bold tracking-[0.12em] uppercase"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Total estimado
        </div>
        {!tieneCarga ? (
          <p
            className="mt-2 text-[14.5px] leading-[1.5]"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            Ingresá tu CBM y peso para ver el estimado al instante.
          </p>
        ) : hasAlerta ? (
          <p
            className="mt-2 text-[14.5px] leading-[1.5]"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            {cot.alerta!.mensaje}
          </p>
        ) : (
          <div className="mt-1.5 flex items-end justify-between gap-3 flex-wrap">
            <span
              className="num text-[44px] lg:text-[52px] leading-none text-white"
              style={{ fontFamily: "var(--font-archivo-black)" }}
            >
              {money(cot.total)}
            </span>
            <span
              className="text-[12px] leading-[1.4] text-right"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              aprox · DDP
              <br />
              puerta a puerta
            </span>
          </div>
        )}
      </div>

      {/* Badge financiamiento (pill verde claro) */}
      {!hasAlerta && (
        <div
          className="inline-flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold text-ink"
          style={{ background: "rgba(31,138,91,0.12)" }}
        >
          <span className="fin-badge-dot-green" aria-hidden="true" />
          Financiamiento 100%* · pagás al llegar a Venezuela
        </div>
      )}

      {/* Empuja el CTA al fondo cuando hay espacio (desktop sticky/altura) */}
      <div className="flex-1 min-h-[8px]" />

      {tieneCarga && (
        <>
          {/* Nudge "ya está lista" — pill navy con vibración mínima + flecha */}
          {!hasAlerta && (
            <div className="flex flex-col items-center -mb-1">
              <div className="nudge-vibrate w-full rounded-[12px] bg-ink text-white text-center text-[13.5px] leading-[1.35] py-3 px-4">
                Tu cotización ya está lista —{" "}
                <strong>solo falta enviarla.</strong>
              </div>
              <svg width="22" height="11" viewBox="0 0 22 11" fill="none" aria-hidden="true">
                <path d="M2 1l9 8 9-8" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {/* CTA WhatsApp · con precio válido abre el modal de captura del
              estimado (POST al ERP + wa.me); con alerta va directo a WhatsApp. */}
          {hasAlerta ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn bg-whatsapp text-white"
            >
              <WhatsAppIcon size={20} />
              Consultar con un asesor
            </a>
          ) : (
            <button
              type="button"
              onClick={onEstimar}
              className="btn bg-whatsapp text-white"
            >
              <WhatsAppIcon size={20} />
              Enviar por WhatsApp
            </button>
          )}

          {/* Microcopy */}
          <p className="text-[11.5px] text-grey-500 text-center leading-[1.45]">
            Tu mensaje se arma solo con estos datos. Con Confianza, de China a tu
            puerta.
          </p>
        </>
      )}
    </>
  );
}
