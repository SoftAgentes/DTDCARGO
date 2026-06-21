"use client";

import { useMemo, useState } from "react";
import { calcFclEstimate, fclRouteLabel } from "@/lib/calc/fcl";
import type { PublicFclRoute } from "@/lib/public/rates-queries";
import { buildWhatsAppLink } from "@/lib/design-tokens";

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * Calculadora FCL pública (contenedor completo). El cliente elige una ruta de las
 * tarifas publicadas (`getPublicFclRoutes`) y la cantidad de contenedores → ve el
 * total al instante (motor puro `calcFclEstimate`). CTA a WhatsApp con el detalle.
 *
 * Si no hay rutas publicadas (el admin aún no marcó ninguna FCL como pública en
 * /studio/tarifas), muestra el estado vacío que deriva a WhatsApp — nunca una
 * pantalla rota.
 */
export function FclCalculator({ routes }: { routes: PublicFclRoute[] }) {
  const [idx, setIdx] = useState(0);
  const [containers, setContainers] = useState(1);

  const route = routes[idx] ?? null;
  const estimate = useMemo(
    () => (route ? calcFclEstimate(route, { containers }) : null),
    [route, containers],
  );

  if (routes.length === 0 || !route || !estimate) {
    const waEmpty = buildWhatsAppLink(
      "Hola DTD Cargo, quiero cotizar un contenedor completo (FCL). ¿Me ayudan con la tarifa?",
    );
    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8 max-w-[560px]">
        <div className="text-[17px] font-bold text-ink">
          Cotizamos tu contenedor completo.
        </div>
        <p className="mt-2 text-[14px] text-grey-700 leading-[1.6]">
          El precio de un FCL depende de la ruta y la naviera. Escríbenos con tu
          origen, destino y qué vas a traer, y un asesor te arma la tarifa.
        </p>
        <a
          href={waEmpty}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary mt-6 inline-flex"
        >
          Pedir mi tarifa FCL
        </a>
      </div>
    );
  }

  const label = fclRouteLabel(route);
  const waLink = buildWhatsAppLink(
    `Hola DTD Cargo, quiero coordinar un FCL.\n` +
      `Ruta: ${label}\n` +
      `Contenedores: ${estimate.containers}\n` +
      `Estimado: ${usd(estimate.total)} USD` +
      (route.transitDays ? `\nTránsito aprox: ${route.transitDays} días` : ""),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-start max-w-[900px]">
      {/* Entrada */}
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-7">
        <div className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
          Tu contenedor
        </div>

        <label htmlFor="fcl-route" className="block mt-5 text-[13px] font-semibold text-grey-700 mb-1.5">
          Ruta
        </label>
        <select
          id="fcl-route"
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          className="w-full rounded-[12px] border border-grey-200 bg-white px-3.5 h-[52px] text-[14px] text-ink outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-wine/40"
        >
          {routes.map((r, i) => (
            <option key={`${r.origin}-${r.destination}-${i}`} value={i}>
              {fclRouteLabel(r)}
            </option>
          ))}
        </select>

        <label htmlFor="fcl-containers" className="block mt-5 text-[13px] font-semibold text-grey-700 mb-1.5">
          Contenedores
        </label>
        <input
          id="fcl-containers"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={containers}
          onChange={(e) =>
            setContainers(Math.max(1, Math.floor(Number(e.target.value)) || 1))
          }
          className="w-full rounded-[12px] border border-grey-200 bg-white px-3.5 h-[52px] text-[14px] text-ink outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-wine/40"
        />
        <p className="mt-2 text-[12px] text-grey-500 leading-[1.5]">
          Tarifa por contenedor completo, puerta de origen a puerto de destino. El
          tipo (20′/40′/HC) y la naviera los confirma tu asesor.
        </p>
      </div>

      {/* Resultado */}
      <div className="card-shadow bg-paper border border-grey-200 rounded-[18px] p-6 sm:p-7">
        <div className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
          Estimado
        </div>
        <div className="num mt-2 text-[14px] text-grey-700">{label}</div>

        <div className="mt-5">
          <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
            Total estimado
          </div>
          <div className="num mt-1.5 text-[44px] lg:text-[48px] leading-none text-wine font-bold">
            {usd(estimate.total)}
            <span className="text-[16px] text-grey-500"> USD</span>
          </div>
        </div>

        <dl className="mt-6 flex flex-col gap-2.5 border-t border-grey-200 pt-5">
          <Row k="Tarifa por contenedor" v={`${usd(estimate.flatRate)} USD`} />
          <Row k="Contenedores" v={String(estimate.containers)} />
          {route.transitDays ? (
            <Row k="Tránsito estimado" v={`${route.transitDays} días`} />
          ) : null}
        </dl>

        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary mt-6 inline-flex w-full justify-center"
        >
          Coordinar este FCL
        </a>
        <p className="mt-3 text-[12px] text-grey-500 leading-[1.5]">
          Estimado de referencia. La tarifa final la confirma un asesor según
          naviera, tipo de contenedor y disponibilidad.
        </p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[13px] text-grey-700">{k}</dt>
      <dd className="num text-[14px] font-semibold text-ink">{v}</dd>
    </div>
  );
}
