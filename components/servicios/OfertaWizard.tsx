"use client";

/**
 * OfertaWizard — "¿Qué necesitas?" (SDD-0090 Pieza 1).
 *
 * Capa guiada sobre /servicios: en vez de scrollear 20 fichas, el cliente dice qué
 * necesita y le armamos la oferta — núcleo recomendado + add-ons que le convienen +
 * cómo se cobra cada uno. El cerebro es `armarOferta()` (lib/shared/service-offer.ts),
 * PURO: este componente solo lo pinta. Cero carrito (decisión founder: CTA por servicio).
 *
 * `overrides` viene del server (getOfferOverridesParaSitio): lo que el founder configuró
 * en el Studio pisa el default del catálogo. Si no hay nada configurado → default.
 */

import { useState } from "react";
import Link from "next/link";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import {
  armarOferta,
  nucleosElegibles,
  INTENCION_OPTIONS,
  CHARGE_MODE_LABEL,
  type IntencionCliente,
  type OfferOverrides,
} from "@/lib/shared/service-offer";
import {
  SERVICE_CATALOG_BY_ID,
  type ServicioId,
} from "@/lib/shared/service-catalog";

const nombre = (id: ServicioId) => SERVICE_CATALOG_BY_ID[id]?.nombre ?? id;
const ancla = (id: ServicioId) => {
  const slug = SERVICE_CATALOG_BY_ID[id]?.legacySlug;
  return slug ? `#${slug}` : null;
};

const INTENCION_HINT: Record<IntencionCliente, string> = {
  embarque: "Tienes mercancía en China y la quieres en tu puerta.",
  origen: "Aún no compras: necesitas conseguir o verificar un proveedor.",
  suelto: "Solo un trámite puntual (visado, marca, courier).",
  estimar: "Quieres una idea del costo antes de hablar con nadie.",
};

export function OfertaWizard({ overrides = {} }: { overrides?: OfferOverrides }) {
  const [intencion, setIntencion] = useState<IntencionCliente | null>(null);
  const [nucleoId, setNucleoId] = useState<ServicioId | null>(null);

  const necesitaNucleo = intencion === "embarque";
  const listo = intencion != null && (!necesitaNucleo || nucleoId != null);
  const oferta = listo ? armarOferta({ intencion, nucleoId }, overrides) : null;

  function elegirIntencion(v: IntencionCliente) {
    setIntencion(v);
    setNucleoId(null);
  }

  return (
    <section className="py-14 lg:py-20 bg-paper" id="arma-tu-oferta">
      <div className="wrap">
        <span className="eyebrow">Arma tu oferta</span>
        <h2
          className="h-section mt-4"
          style={{ fontSize: "clamp(28px, 4vw, 46px)" }}
        >
          ¿Qué necesitas?
        </h2>
        <p className="lead mt-5 max-w-[52ch]">
          Dinos en qué punto estás y te decimos qué servicio te conviene y cómo se
          cobra. Sin compromiso.
        </p>

        {/* Paso 1 — intención */}
        <div className="mt-9">
          <StepLabel n={1} text="¿En qué punto estás?" />
          <div
            role="group"
            aria-label="¿En qué punto estás?"
            className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {INTENCION_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                active={intencion === o.value}
                title={o.label}
                hint={INTENCION_HINT[o.value]}
                onClick={() => elegirIntencion(o.value)}
              />
            ))}
          </div>
        </div>

        {/* Paso 2 — núcleo (solo si trae carga) */}
        {necesitaNucleo && (
          <div className="mt-8">
            <StepLabel n={2} text="¿Cómo quieres mover la carga?" />
            <div
              role="group"
              aria-label="¿Cómo quieres mover la carga?"
              className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              {nucleosElegibles().map((id) => (
                <OptionCard
                  key={id}
                  active={nucleoId === id}
                  title={nombre(id)}
                  badge={id === "puerta-a-puerta-ddp" ? "Recomendado" : undefined}
                  onClick={() => setNucleoId(id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Resultado */}
        {oferta && (
          <div className="mt-9">
            {oferta.modo === "estimar" ? (
              <ResultadoEstimar />
            ) : (
              <Resultado
                modo={oferta.modo}
                nucleo={oferta.nucleo}
                incluidos={oferta.incluidos}
                sugeridos={oferta.sugeridos}
                transversales={oferta.transversales}
                cobro={oferta.cobro}
              />
            )}
            <button
              type="button"
              onClick={() => {
                setIntencion(null);
                setNucleoId(null);
              }}
              className="mt-5 rounded-[4px] text-[13px] font-semibold text-grey-500 hover:text-wine underline underline-offset-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-wine focus-visible:outline-offset-2"
            >
              Empezar de nuevo
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid place-items-center w-6 h-6 rounded-full bg-wine text-white text-[12px] font-bold">
        {n}
      </span>
      <span className="text-[13px] font-bold tracking-[0.04em] uppercase text-grey-700">
        {text}
      </span>
    </div>
  );
}

function OptionCard({
  active,
  title,
  hint,
  badge,
  onClick,
}: {
  active: boolean;
  title: string;
  hint?: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left rounded-[14px] border p-4 transition-all hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 focus:outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ink focus-visible:outline-offset-2 ${
        active
          ? "border-wine bg-white ring-1 ring-wine"
          : "border-grey-200 bg-white hover:border-ink"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-semibold leading-[1.25] text-ink">
          {title}
        </span>
        {badge && (
          <span className="flex-shrink-0 text-[10px] font-bold tracking-[0.1em] uppercase text-wine bg-wine/10 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {hint && (
        <span className="mt-1.5 block text-[12.5px] leading-[1.4] text-grey-500">
          {hint}
        </span>
      )}
    </button>
  );
}

function ResultadoEstimar() {
  return (
    <div className="card-shadow-static bg-white border border-grey-200 rounded-[18px] p-7 lg:p-8">
      <p className="text-[15px] leading-[1.5] text-grey-700 max-w-[52ch]">
        Para tener una idea del costo, usa la calculadora: la estimas por volumen
        (CBM) y ciudad de destino, sin registrarte.
      </p>
      <Link href="/tarifas" className="btn btn-primary mt-5">
        Ir a la calculadora
      </Link>
    </div>
  );
}

function Resultado({
  modo,
  nucleo,
  incluidos,
  sugeridos,
  transversales,
  cobro,
}: {
  modo: IntencionCliente;
  nucleo: ServicioId | null;
  incluidos: ServicioId[];
  sugeridos: ServicioId[];
  transversales: ServicioId[];
  cobro: Record<string, string>;
}) {
  // Mensaje de WhatsApp: enumera lo recomendado (núcleo + sugeridos principales).
  const listaSugeridos = sugeridos.slice(0, 6).map(nombre).join(", ");
  const wa = buildWhatsAppLink(
    nucleo
      ? `Hola DTD Cargo, me interesa ${nombre(nucleo)}.` +
          (listaSugeridos ? ` Quiero información sobre: ${listaSugeridos}.` : "")
      : `Hola DTD Cargo, me interesa: ${listaSugeridos}.`,
  );
  // Mensaje corto para una duda genérica (botón ghost): sin la lista pre-armada.
  const waDuda = buildWhatsAppLink(
    `Hola DTD Cargo, tengo una duda sobre ${nucleo ? nombre(nucleo) : "sus servicios"}.`,
  );
  const esDDP = nucleo === "puerta-a-puerta-ddp";

  return (
    <div className="card-shadow-static bg-white border border-wine rounded-[18px] overflow-hidden">
      {/* Núcleo recomendado */}
      {nucleo && (
        <div className="px-6 lg:px-8 pt-6 pb-6 border-b border-grey-200">
          <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-wine">
            Tu servicio
          </span>
          <h3
            className="mt-2 text-[22px] lg:text-[26px] leading-[1.1] text-ink"
            style={{ fontFamily: "var(--font-archivo-black)" }}
          >
            {nombre(nucleo)}
          </h3>
          <p className="mt-2 text-[13.5px] text-grey-600">
            {CHARGE_MODE_LABEL[
              (cobro[nucleo] as keyof typeof CHARGE_MODE_LABEL) ?? "asesor"
            ] ?? "Lo cotiza el asesor"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {esDDP ? (
              <Link href="/tarifas" className="btn btn-primary">
                Calcula tu estimado
              </Link>
            ) : (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Pídelo por WhatsApp
              </a>
            )}
            {esDDP && (
              <a
                href={waDuda}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
              >
                Pregunta por WhatsApp
              </a>
            )}
          </div>

          {incluidos.length > 0 && (
            <div className="mt-5">
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-grey-500">
                Ya viene incluido
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {incluidos.map((id) => (
                  <span
                    key={id}
                    className="inline-flex px-2.5 py-1 rounded-[7px] bg-grey-100 text-[12.5px] font-medium text-grey-700"
                  >
                    {nombre(id)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sugeridos */}
      {sugeridos.length > 0 && (
        <div className="px-6 lg:px-8 py-6">
          <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-grey-500">
            {modo === "embarque" ? "Te conviene sumar" : "Esto es lo que te ofrecemos"}
          </span>
          <ul className="mt-3 flex flex-col divide-y divide-grey-200 list-none p-0 m-0">
            {sugeridos.map((id) => {
              const a = ancla(id);
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0">
                    {a ? (
                      <a
                        href={a}
                        className="rounded-[4px] text-[14.5px] font-medium text-ink hover:text-wine underline-offset-2 hover:underline focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-wine focus-visible:outline-offset-2"
                      >
                        {nombre(id)}
                      </a>
                    ) : (
                      <span className="text-[14.5px] font-medium text-ink">
                        {nombre(id)}
                      </span>
                    )}
                  </span>
                  <span className="flex-shrink-0 text-[12px] text-grey-500">
                    {CHARGE_MODE_LABEL[
                      (cobro[id] as keyof typeof CHARGE_MODE_LABEL) ?? "asesor"
                    ] ?? "Lo cotiza el asesor"}
                  </span>
                </li>
              );
            })}
          </ul>
          {!nucleo && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary mt-5"
            >
              Pídelo por WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Transversales */}
      {transversales.length > 0 && (
        <div className="px-6 lg:px-8 pb-6 pt-1">
          <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-grey-500">
            También gestionamos
          </span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {transversales.map((id) => {
              const a = ancla(id);
              return a ? (
                <a
                  key={id}
                  href={a}
                  className="inline-flex px-2.5 py-1 rounded-[7px] bg-grey-100 text-[12.5px] font-medium text-grey-700 hover:bg-grey-200 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-wine focus-visible:outline-offset-2"
                >
                  {nombre(id)}
                </a>
              ) : (
                <span
                  key={id}
                  className="inline-flex px-2.5 py-1 rounded-[7px] bg-grey-100 text-[12.5px] font-medium text-grey-700"
                >
                  {nombre(id)}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
