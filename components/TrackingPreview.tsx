"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon } from "./Icon";

/**
 * Preview del tracking — input en home que redirige a /track/[code].
 * Portada del Brand Book DTD § Tracking, con timeline de muestra.
 */
export function TrackingPreview() {
  const [code, setCode] = useState("DTDU-472816-22G1");
  const router = useRouter();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const clean = code.trim();
    if (clean) router.push(`/track/${encodeURIComponent(clean)}`);
  }

  const timeline = [
    {
      state: "done" as const,
      title: "Inspección de fábrica · OK",
      meta: "Yiwu · 8 cajas · 0 observaciones",
      time: "08 MAY",
    },
    {
      state: "done" as const,
      title: "Carga en depósito DTD",
      meta: "Yiwu Bonded Warehouse · YBW-12",
      time: "11 MAY",
    },
    {
      state: "done" as const,
      title: "Embarque COSCO PISCES · ETD",
      meta: "Ningbo → Puerto Cabello",
      time: "14 MAY",
    },
    {
      state: "active" as const,
      title: "En tránsito — Pacífico Sur",
      meta: "Próximo evento: Canal de Panamá",
      time: "HOY",
    },
    {
      state: "pending" as const,
      title: "Arribo Puerto Cabello · ETA",
      meta: "Terminal Bolipuertos",
      time: "12 JUN",
    },
    {
      state: "pending" as const,
      title: "Entrega puerta · DDP cerrado",
      meta: "Valencia, VE",
      time: "15 JUN",
    },
  ];

  return (
    <section className="py-20 lg:py-25 bg-ink" id="track">
      <div className="wrap">
        <div className="card-shadow-dark bg-ink text-white rounded-[24px] p-8 lg:p-14 grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-12 items-center">
          <div>
            <span className="eyebrow" style={{ color: "rgba(255,255,255,0.5)" }}>
              Rastreo en vivo
            </span>
            <h2 className="h-section mt-4" style={{ color: "white" }}>
              ¿Dónde está
              <br />
              tu envío?
            </h2>
            <p
              className="text-[16px] leading-[1.55] max-w-[34ch]"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              Ingresa tu BL, AWB o código DTDU. Eventos en tiempo real, sin
              registro, sin fricción.
            </p>
            <form
              onSubmit={onSubmit}
              className="flex items-stretch h-14 bg-white rounded-[12px] overflow-hidden mt-5"
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="BL / AWB / DTDU"
                aria-label="Código de tracking"
                className="flex-1 min-w-0 border-0 outline-none bg-transparent px-5 text-[16px] font-semibold tracking-[0.04em] text-ink placeholder:text-grey-500"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-6 text-white font-semibold text-[14.5px] tracking-[0.01em] transition-colors hover:opacity-90"
                style={{ background: "var(--color-wine)" }}
              >
                Rastrear <ArrowIcon />
              </button>
            </form>

            {/* Bifurcación cliente/prospecto — captura leads que llegan a esta sección */}
            <p className="mt-4 text-[13px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              ¿Todavía no eres cliente?{" "}
              <a
                href={buildWhatsAppLink(
                  "Hola DTD Cargo, vi el demo de tracking y quiero cotizar mi primer envío. ¿Pueden ayudarme?"
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2 hover:text-white"
                style={{ color: "var(--color-wine-soft)" }}
              >
                Cotiza tu primer envío →
              </a>
            </p>
          </div>

          <div className="flex flex-col gap-5.5">
            {timeline.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[22px_1fr_auto] gap-4 items-center"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border-2"
                  style={{
                    background:
                      row.state === "done" || row.state === "active"
                        ? "var(--color-wine)"
                        : "var(--color-grey-700)",
                    borderColor:
                      row.state === "active"
                        ? "white"
                        : row.state === "done"
                        ? "var(--color-wine)"
                        : "var(--color-grey-700)",
                    boxShadow:
                      row.state === "active"
                        ? "0 0 0 4px rgba(127,15,26,0.4)"
                        : undefined,
                  }}
                />
                <div>
                  <div className="text-[14.5px] font-medium leading-[1.3] text-white">
                    {row.title}
                  </div>
                  <div className="text-[12.5px] leading-[1.3] text-white/50 mt-0.5">
                    {row.meta}
                  </div>
                </div>
                <div className="text-[12px] font-semibold tracking-[0.06em] text-white/40">
                  {row.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
