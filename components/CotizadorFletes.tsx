"use client";

import { useState, type FormEvent } from "react";
import { CONTACT } from "@/lib/design-tokens";
import {
  OCEAN_ORIGIN_CITIES,
  OCEAN_DESTINATIONS,
  OCEAN_CONTAINERS,
  validateOceanRouteInput,
  OCEAN_RATE_DISCLAIMER,
  type OceanContainer,
} from "@/lib/shared/ocean-rate";
import {
  applyFreightMarkup,
  buildFleteWhatsAppMessage,
  type OceanRateResponse,
} from "@/lib/public/cotizador-flete";
import { ArrowIcon, CheckIcon, WarningIcon } from "./Icon";

/**
 * Cotizador público de flete marítimo (SDD-0095 Slice B).
 *
 * Form ciudad/puerto→puerto: el origen es una CIUDAD de China que se resuelve a su
 * puerto export cacheado (Yiwu → Ningbo); el destino es un puerto de Venezuela. Pega
 * a `/api/public/ocean-rate` y muestra el flete CACHEADO — 0 llamadas a
 * SeaRates por visita. White-label: nunca se nombra al proveedor ni a la naviera.
 * El número visible pasa por `applyFreightMarkup` (default 0 = flete crudo).
 *
 * Frontera: importa el catálogo de `@/lib/shared/*` y los helpers de `lib/public/`;
 * cero código del ERP, cero @supabase. Pega por HTTP al route handler.
 */

type Status = "idle" | "loading" | "done" | "error";

const CONTAINER_LABELS: Record<string, string> = {
  ST20: "20' Estándar",
  ST40: "40' Estándar",
  HC40: "40' High Cube",
  REF20: "Refrigerado 20'",
  REF40: "Refrigerado 40'",
};

const FIELD =
  "h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-medium text-ink focus:ring-2 focus:ring-wine/40";

export function CotizadorFletes() {
  const [originCityId, setOriginCity] = useState(OCEAN_ORIGIN_CITIES[0]?.id ?? "");
  const [pointIdTo, setTo] = useState(OCEAN_DESTINATIONS[0]?.id ?? "");
  // Este cotizador es SOLO FCL (full container). El LCL público vive en /tarifas.
  // Default: 40' High Cube (decisión founder).
  const [container, setContainer] = useState<OceanContainer>("HC40");

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<OceanRateResponse | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // La ciudad de origen se resuelve a su puerto export cacheado (Yiwu → Ningbo).
    const pointIdFrom = OCEAN_ORIGIN_CITIES.find((c) => c.id === originCityId)?.portId ?? "";
    const { input, fieldErrors } = validateOceanRouteInput({
      pointIdFrom,
      pointIdTo,
      shippingType: "FCL",
      container,
    });
    if (fieldErrors || !input) {
      setStatus("error");
      setResult(null);
      return;
    }
    setStatus("loading");
    setResult(null);
    try {
      const res = await fetch("/api/public/ocean-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res.json().catch(() => null)) as OceanRateResponse | null;
      if (!res.ok || !json) {
        setStatus("error");
        return;
      }
      setResult(json);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  const originName = OCEAN_ORIGIN_CITIES.find((c) => c.id === originCityId)?.name ?? "China";
  const destName = OCEAN_DESTINATIONS.find((p) => p.id === pointIdTo)?.name ?? "Venezuela";
  const modeLabel = `Marítimo FCL · ${CONTAINER_LABELS[container] ?? container}`;

  const rate = result?.rate ?? null;
  const priceUsd =
    result?.available && rate?.rateUsd != null ? applyFreightMarkup(rate.rateUsd) : null;

  const whatsappHref = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(
    buildFleteWhatsAppMessage({ originName, destName, modeLabel, priceUsd }),
  )}`;

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={onSubmit}
        className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9 flex flex-col gap-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Row label="Origen (ciudad o puerto)">
            <select
              className={FIELD}
              value={originCityId}
              onChange={(e) => setOriginCity(e.target.value)}
            >
              {OCEAN_ORIGIN_CITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Destino">
            <select className={FIELD} value={pointIdTo} onChange={(e) => setTo(e.target.value)}>
              {OCEAN_DESTINATIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Row>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Modo fijo: este cotizador es solo FCL. Chip informativo (no control). */}
          <div className="flex flex-col gap-2">
            <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
              Modo de envío
            </span>
            <div className="flex items-center h-12 px-3.5 rounded-[10px] bg-grey-100 text-[14.5px] font-medium text-grey-700">
              FCL · contenedor completo
            </div>
          </div>
          <Row label="Contenedor">
            <select
              className={FIELD}
              value={container}
              onChange={(e) => setContainer(e.target.value as OceanContainer)}
            >
              {OCEAN_CONTAINERS.map((c) => (
                <option key={c} value={c}>
                  {CONTAINER_LABELS[c] ?? c}
                </option>
              ))}
            </select>
          </Row>
        </div>

        <button
          type="submit"
          className="btn btn-primary h-14 mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Consultando…" : "Ver flete estimado"}
          {status !== "loading" && <ArrowIcon />}
        </button>
      </form>

      {/* Región de resultado · aria-live para que los lectores de pantalla
          anuncien el flete / no-disponible / error al aparecer tras el submit.
          empty:hidden evita el gap cuando está en idle (sin resultado aún). */}
      <div aria-live="polite" className="empty:hidden flex flex-col gap-6">
        {status === "loading" && (
          <div
            className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8 lg:p-10"
            aria-hidden
          >
            <div className="h-3 w-28 rounded bg-grey-100" />
            <div className="mt-4 h-12 w-2/3 rounded bg-grey-100 animate-pulse motion-reduce:animate-none" />
            <div className="mt-4 h-3 w-1/2 rounded bg-grey-100" />
          </div>
        )}

        {status === "done" && priceUsd != null && rate && (
          <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.12em] uppercase text-wine">
              <CheckIcon size={16} className="text-wine" />
              Flete estimado
            </div>
            <div
              className="mt-4 text-[40px] lg:text-[56px] leading-none text-ink"
              style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
            >
              Desde USD {priceUsd.toLocaleString("es-VE")}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[15px] text-grey-500">
              <span>
                {originName} → {destName}
              </span>
              {rate.transitDays != null && (
                <span>
                  Tránsito ~<strong className="text-ink">{rate.transitDays} días</strong>
                </span>
              )}
              {rate.offersCount != null && rate.offersCount > 1 && (
                <span>Comparamos {rate.offersCount} navieras</span>
              )}
            </div>
            <p className="mt-6 text-[14.5px] text-grey-700 leading-[1.55]">
              {result?.disclaimer ?? OCEAN_RATE_DISCLAIMER}
            </p>
            <div className="mt-7">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Cotizar en firme por WhatsApp <ArrowIcon />
              </a>
            </div>
          </div>
        )}

        {status === "done" && priceUsd == null && (
          <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8">
            <div className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
              <WarningIcon size={16} className="text-grey-500" />
              Sin estimado para esta ruta
            </div>
            <p className="mt-4 text-[15px] text-grey-700 leading-[1.55]">
              <strong className="text-ink">No tenemos un estimado para esa ruta ahora mismo.</strong>{" "}
              Escríbenos y te cotizamos el flete a la medida de tu carga.
            </p>
            <div className="mt-5">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Pedir cotización por WhatsApp <ArrowIcon />
              </a>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8">
            <div className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
              <WarningIcon size={16} className="text-grey-500" />
              No se pudo calcular
            </div>
            <p className="mt-4 text-[15px] text-grey-700 leading-[1.55]">
              <strong className="text-ink">No pudimos calcular el flete ahora mismo.</strong>{" "}
              Inténtalo de nuevo o escríbenos y te cotizamos a mano.
            </p>
            <div className="mt-5">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Escríbenos por WhatsApp <ArrowIcon />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </span>
      {children}
    </label>
  );
}
