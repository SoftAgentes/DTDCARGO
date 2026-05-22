"use client";

import { useMemo, useState } from "react";
import {
  ORIGENES_DISPONIBLES,
  getDestinosDisponibles,
  MULTIPLICADOR_DTD_DEFAULT,
  type Origen,
} from "@/lib/data/tarifas-terrestres-vzla";
import { calcularFleteTerrestre } from "@/lib/calc/fleteTerrestre";

/**
 * Calculadora del "último km" en Venezuela.
 *
 * Pensada como sección OPCIONAL dentro del formulario /cotizar. El cliente
 * trae carga del exterior y opcionalmente cotiza el flete terrestre interno
 * (Puerto Cabello → su destino) sin tener que escribir por WhatsApp.
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
  const [destino, setDestino] = useState<string>("Caracas");
  const [pesoKg, setPesoKg] = useState<number>(100);
  const [volumenM3, setVolumenM3] = useState<number>(0);
  const [valorDeclaradoUsd, setValorDeclaradoUsd] = useState<number>(0);
  const [mostrarDesglose, setMostrarDesglose] = useState<boolean>(false);

  // Lista de destinos disponibles según origen (cambia dinámicamente)
  const destinos = useMemo(() => getDestinosDisponibles(origen), [origen]);

  // Si cambia origen y el destino actual no existe en el nuevo mapa, ajustar
  useMemo(() => {
    if (!destinos.includes(destino)) {
      setDestino(destinos[0] ?? "Caracas");
    }
  }, [destinos, destino]);

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
      }),
    [origen, destino, pesoKg, volumenM3, valorDeclaradoUsd],
  );

  const hayError = !!resultado.error;

  return (
    <div className="border-t-2 border-grey-200 pt-7 mt-2">
      <div className="flex items-baseline justify-between mb-4">
        <span className="eyebrow inline-flex">
          <span className="mr-1.5">🚛</span> Último km en Venezuela (opcional)
        </span>
        <span className="text-[11.5px] text-grey-500">Estimación referencial · DTD-CARGO</span>
      </div>

      <p className="text-[13px] text-grey-500 leading-[1.5] mb-5">
        Si querés ver una estimación del costo de entrega desde el puerto hasta
        tu ciudad en Venezuela, completá los campos. Es una <strong>tarifa de referencia</strong>
        — la final te la cierra el asesor por WhatsApp.
      </p>

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
            onChange={(e) => setDestino(e.target.value)}
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
          <input
            type="number"
            min={0}
            step="0.1"
            value={pesoKg}
            onChange={(e) => setPesoKg(Number(e.target.value))}
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-semibold text-ink text-center"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
            Volumen (m³)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={volumenM3}
            onChange={(e) => setVolumenM3(Number(e.target.value))}
            placeholder="opcional"
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-semibold text-ink text-center"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
            Valor declarado USD
          </span>
          <input
            type="number"
            min={0}
            step="1"
            value={valorDeclaradoUsd}
            onChange={(e) => setValorDeclaradoUsd(Number(e.target.value))}
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
                <DetailRow label="FPO (6%)" value={`USD ${resultado.fpoUsd.toFixed(2)}`} />
                {resultado.seguroUsd > 0 && (
                  <DetailRow label="Seguro (3%)" value={`USD ${resultado.seguroUsd.toFixed(2)}`} />
                )}
                <DetailRow label="Subtotal" value={`USD ${resultado.subtotalUsd.toFixed(2)}`} />
                <DetailRow label="IVA (16%)" value={`USD ${resultado.ivaUsd.toFixed(2)}`} />
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
