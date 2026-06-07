"use client";

import { useMemo, useState } from "react";
import {
  ORIGENES_DISPONIBLES,
  getDestinosDisponibles,
  MULTIPLICADOR_DTD_DEFAULT,
  destinoEsCasco,
  CASCO_CENTRAL_DTD,
  type Origen,
  type ModoCotizacionTerrestre,
} from "@/lib/data/tarifas-terrestres-vzla";
import { calcularFleteTerrestre } from "@/lib/calc/fleteTerrestre";
import { DecimalInput } from "@/components/DecimalInput";
import { CONFIG } from "@/lib/calculadora";

/**
 * Calculadora del "último km" en Venezuela.
 *
 * Vive en su propia página `/calculadora-terrestre` (SDD-0059 Fase A; antes era
 * una sección embebida en `/cotizar`). El cliente trae carga del exterior y
 * opcionalmente estima el flete terrestre interno (Puerto Cabello → su destino)
 * sin tener que escribir por WhatsApp. `/estimacion` linkea acá.
 *
 * UX:
 * - Origen default = Valencia (sede DTD)
 * - Destino dropdown filtrado por origen
 * - Peso obligatorio; volumen opcional
 * - Cálculo en vivo (useMemo) cuando cambian inputs
 * - Resultado expandible con desglose detallado
 */
export function UltimoKmCalculator() {
  const [origen, setOrigen] = useState<Origen>("Valencia");
  // `destinoPicked` = lo que el usuario eligió (intent). Puede quedar stale
  // cuando cambia origen, pero `destino` (computado abajo) siempre refleja
  // un destino válido para el origen actual.
  const [destinoPicked, setDestinoPicked] = useState<string>("Caracas");
  const [pesoKg, setPesoKg] = useState<number>(100);
  const [volumenM3, setVolumenM3] = useState<number>(0);
  const [valorDeclaradoUsd, setValorDeclaradoUsd] = useState<number>(0);
  const [mostrarDesglose, setMostrarDesglose] = useState<boolean>(false);
  const [modoCotizacion, setModoCotizacion] =
    useState<ModoCotizacionTerrestre>("solo-terrestre");

  // Lista de destinos disponibles según origen (cambia dinámicamente).
  const destinos = useMemo(() => getDestinosDisponibles(origen), [origen]);

  // Destino efectivo derivado durante render — sin side-effects de setState.
  // Si el destino que eligió el usuario ya no es válido para el origen actual
  // (ej. cambió origen de Valencia a Caracas y el destino "Maracay" no existe
  // desde Caracas), caemos al primer destino disponible. Cuando el usuario
  // vuelva a elegir, `setDestinoPicked` lo guarda como nueva intención.
  const destino = destinos.includes(destinoPicked)
    ? destinoPicked
    : (destinos[0] ?? "Caracas");

  // Cálculo en vivo
  const resultado = useMemo(
    () =>
      calcularFleteTerrestre({
        origen,
        destino,
        pesoRealKg: pesoKg,
        volumenM3,
        valorDeclaradoUsd,
        multiplicadorDtd: MULTIPLICADOR_DTD_DEFAULT,
        modoCotizacion,
      }),
    [origen, destino, pesoKg, volumenM3, valorDeclaradoUsd, modoCotizacion],
  );

  const destinoActualEsCasco = destinoEsCasco(destino);

  const hayError = !!resultado.error;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <span className="eyebrow inline-flex">
          <span className="mr-1.5">🚛</span> Último km en Venezuela
        </span>
        <span className="text-[11.5px] text-grey-500">Estimación referencial · DTD Cargo</span>
      </div>

      <p className="text-[13px] text-grey-500 leading-[1.5] mb-5">
        Si querés ver una estimación del costo de entrega desde el puerto hasta
        tu ciudad en Venezuela, completá los campos. Es una <strong>tarifa de referencia</strong>
        — la final te la cierra el asesor por WhatsApp.
      </p>

      {/* Modo de cotización: 3 escenarios según relación con servicio CBM */}
      <fieldset className="mb-5">
        <legend className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500 mb-3">
          ¿Cuál es tu caso?
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <ModoOption
            value="solo-terrestre"
            current={modoCotizacion}
            onChange={setModoCotizacion}
            title="Solo transporte interno"
            subtitle="Sin envío CBM China-VZLA"
          />
          <ModoOption
            value="cbm-casco"
            current={modoCotizacion}
            onChange={setModoCotizacion}
            title="CBM + zona cubierta"
            subtitle="Tengo CBM activo · destino dentro del casco"
          />
          <ModoOption
            value="cbm-lejos"
            current={modoCotizacion}
            onChange={setModoCotizacion}
            title="CBM + destino lejos"
            subtitle="Tengo CBM · destino fuera del casco"
          />
        </div>
        {modoCotizacion !== "solo-terrestre" && (
          <p className="mt-3 text-[12px] text-grey-500 leading-[1.5]">
            <strong className="text-ink">Casco central DTD:</strong>{" "}
            {CASCO_CENTRAL_DTD.join(", ")}.
          </p>
        )}
      </fieldset>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
            Origen (ciudad VZLA)
          </span>
          <select
            value={origen}
            onChange={(e) => setOrigen(e.target.value as Origen)}
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-medium text-ink"
          >
            {ORIGENES_DISPONIBLES.map((o) => (
              <option key={o} value={o}>
                {o}
                {o === "Valencia" ? " · sede DTD" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
            Destino
          </span>
          <select
            value={destino}
            onChange={(e) => setDestinoPicked(e.target.value)}
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-medium text-ink"
          >
            {destinos.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <label className="flex flex-col gap-2">
          <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
            Peso (kg)
          </span>
          <DecimalInput
            value={pesoKg}
            onValueChange={setPesoKg}
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-semibold text-ink text-center"
          />
          {pesoKg > CONFIG.pesoMaxContenedorKg && (
            <span className="text-[11.5px] leading-[1.4] font-medium text-status-warning">
              Esto es más que el peso permitido por contenedor; consulte a su
              asesor
            </span>
          )}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
            Volumen (m³)
          </span>
          <DecimalInput
            value={volumenM3}
            onValueChange={setVolumenM3}
            placeholder="opcional"
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-semibold text-ink text-center"
          />
          {volumenM3 > CONFIG.cbmMaxContenedor && (
            <span className="text-[11.5px] leading-[1.4] font-medium text-status-warning">
              Eso es más que un contenedor. Consulte a su asesor
            </span>
          )}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
            Valor declarado USD
          </span>
          <DecimalInput
            value={valorDeclaradoUsd}
            onValueChange={setValorDeclaradoUsd}
            placeholder="para seguro"
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-semibold text-ink text-center"
          />
        </label>
      </div>

      {/* RESULTADO */}
      <div
        className={`mt-5 rounded-[14px] p-5 lg:p-6 border ${
          hayError
            ? "bg-wine/5 border-wine/30"
            : "bg-ink text-white border-ink"
        }`}
        style={!hayError ? { background: "var(--color-ink)" } : undefined}
      >
        {hayError ? (
          <div>
            <div className="text-[12px] font-bold tracking-[0.12em] uppercase text-wine mb-1">
              ⚠️ No se puede calcular
            </div>
            <p className="text-[14px] text-ink/80">{resultado.error}</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <div
                  className="text-[10.5px] font-bold tracking-[0.14em] uppercase"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  Total estimado · {origen} → {destino}
                </div>
                <div
                  className="mt-2 leading-none"
                  style={{
                    fontFamily: "var(--font-archivo-black)",
                    fontSize: "clamp(28px, 4vw, 44px)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  USD {resultado.totalUsd.toLocaleString("es-VE", { maximumFractionDigits: 2 })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarDesglose((s) => !s)}
                className="text-[12px] underline underline-offset-2"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                {mostrarDesglose ? "Ocultar desglose" : "Ver desglose"}
              </button>
            </div>

            {mostrarDesglose && (
              <div
                className="mt-5 pt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]"
                style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}
              >
                <DetailRow label="Zona destino" value={`${resultado.zona ?? "—"}`} />
                <DetailRow label="Peso facturable" value={`${resultado.pesoFacturableKg.toFixed(2)} kg`} />
                {resultado.pesoVolumetricoKg > 0 && (
                  <DetailRow
                    label="Peso volumétrico"
                    value={`${resultado.pesoVolumetricoKg.toFixed(2)} kg`}
                  />
                )}
                {resultado.tramoAplicado && (
                  <DetailRow label="Tramo tarifa" value={resultado.tramoAplicado} />
                )}
                {!resultado.esSobre && (
                  <>
                    <DetailRow label="Tarifa base USD/kg" value={`${resultado.tarifaBaseUsdKg.toFixed(3)}`} />
                    <DetailRow
                      label="Tarifa DTD (+15%) USD/kg"
                      value={`${resultado.tarifaDtdUsdKg.toFixed(3)}`}
                    />
                  </>
                )}
                <DetailRow label="Flete base" value={`USD ${resultado.fleteBaseUsd.toFixed(2)}`} />
                {resultado.descuentoCascoUsd > 0 && (
                  <DetailRow
                    label="Descuento casco (CBM)"
                    value={`− USD ${resultado.descuentoCascoUsd.toFixed(2)}`}
                  />
                )}
                <DetailRow label="FPO (6%)" value={`USD ${resultado.fpoUsd.toFixed(2)}`} />
                {resultado.seguroUsd > 0 && (
                  <DetailRow label="Seguro (3%)" value={`USD ${resultado.seguroUsd.toFixed(2)}`} />
                )}
                <DetailRow label="Subtotal" value={`USD ${resultado.subtotalUsd.toFixed(2)}`} />
                <DetailRow label="IVA (16%)" value={`USD ${resultado.ivaUsd.toFixed(2)}`} />
              </div>
            )}

            {/* Nota CBM contextual */}
            {(resultado.notaCasco || resultado.warning) && (
              <div
                className="mt-4 rounded-[10px] p-3.5 text-[12.5px] leading-[1.5]"
                style={{
                  background: resultado.warning
                    ? "rgba(184,137,58,0.2)"
                    : "rgba(31,138,91,0.18)",
                  color: "rgba(255,255,255,0.92)",
                  border: resultado.warning
                    ? "1px solid rgba(184,137,58,0.5)"
                    : "1px solid rgba(31,138,91,0.5)",
                }}
              >
                {resultado.warning && (
                  <div className="font-semibold mb-1">⚠️ {resultado.warning}</div>
                )}
                {resultado.notaCasco && (
                  <div>
                    {resultado.modoAplicado === "cbm-casco" ? "✓" : "ⓘ"}{" "}
                    {resultado.notaCasco}
                  </div>
                )}
              </div>
            )}

            <p
              className="mt-5 text-[11.5px] leading-[1.5]"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Tarifa de referencia basada en tabuladores Fletes GAG 2026 + margen DTD 15%.
              No incluye peajes, escoltas ni gastos especiales. La cotización final se
              cierra por WhatsApp en menos de 24 hs.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Pill clickeable para elegir el modo de cotización (3 opciones).
 * Diseño tipo "radio card" con título + subtítulo.
 */
function ModoOption({
  value,
  current,
  onChange,
  title,
  subtitle,
}: {
  value: ModoCotizacionTerrestre;
  current: ModoCotizacionTerrestre;
  onChange: (v: ModoCotizacionTerrestre) => void;
  title: string;
  subtitle: string;
}) {
  const selected = current === value;
  return (
    <label
      className={`flex flex-col gap-1 rounded-[10px] border p-3 cursor-pointer transition-all ${
        selected
          ? "border-wine bg-wine/5"
          : "border-grey-200 bg-white hover:border-grey-500"
      }`}
    >
      <input
        type="radio"
        name="modo-cotizacion-terrestre"
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span
        className={`text-[13px] font-bold leading-[1.2] ${
          selected ? "text-wine" : "text-ink"
        }`}
      >
        {title}
      </span>
      <span className="text-[11.5px] text-grey-500 leading-[1.4]">
        {subtitle}
      </span>
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div style={{ color: "rgba(255,255,255,0.55)" }}>{label}</div>
      <div className="font-semibold text-right" style={{ color: "rgba(255,255,255,0.92)" }}>
        {value}
      </div>
    </>
  );
}
