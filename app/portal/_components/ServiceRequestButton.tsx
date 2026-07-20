"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ChevronDownIcon, ArrowIcon, WhatsAppIcon } from "@/components/Icon";

/**
 * Menú "Otros servicios" del portal (Norte · `ServiceRequestButton` de
 * docs/design/studio/_norte/portal/app.jsx). Despliega los servicios DTD que el
 * cliente puede solicitar; todo termina en un ESTIMADO (solo el cliente genera
 * estimados; al aprobar la cotización la pasa el asesor).
 *
 * Sam (2026-07-04): "Nueva compra / Pre-alerta" ya cubre la compra, así que este
 * menú vive en **Alertas · mis envíos** y se llama **Otros servicios** (antes
 * "Solicitar un servicio", en el header del Inicio). La calculadora se fue al FAB
 * flotante.
 */
export function ServiceRequestButton({ markbox }: { markbox: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const wa = (msg: string) => buildWhatsAppLink(`Hola DTD Cargo, soy ${markbox}. ${msg}`);
  const services: {
    label: string;
    sub: string;
    href: string;
    external: boolean;
  }[] = [
    {
      label: "Importación de carga",
      sub: "LCL / FCL · puerta a puerta",
      href: "/tarifas",
      external: false,
    },
    {
      label: "Compra asistida",
      sub: "Te ayudamos a comprar en China",
      href: wa("Quiero solicitar el servicio de compra asistida."),
      external: true,
    },
    {
      label: "Inspección en fábrica",
      sub: "Verificamos tu mercancía antes de embarcar",
      href: wa("Quiero solicitar una inspección en fábrica."),
      external: true,
    },
    {
      label: "Consolidación / almacenaje",
      sub: "Juntamos tu carga en bodega China",
      href: wa("Quiero solicitar consolidación / almacenaje."),
      external: true,
    },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center gap-2.5 rounded-full bg-white border border-grey-200 hover:border-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        style={{ padding: "8px 16px" }}
      >
        <span className="flex flex-col items-start leading-none">
          <span className="text-[14px] font-bold text-ink">Otros servicios</span>
          <span
            className="text-[9px] font-bold tracking-[0.14em] text-wine mt-1"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            = ESTIMADO
          </span>
        </span>
        <ChevronDownIcon
          size={13}
          className={`text-grey-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-[282px] card-shadow bg-white border border-grey-200 rounded-[14px] overflow-hidden z-40">
          <div className="px-3.5 py-2.5 border-b border-grey-200 text-[9px] font-bold tracking-[0.12em] uppercase text-grey-500">
            Servicios DTD Cargo · genera un estimado
          </div>
          {services.map((s, i) => {
            const inner = (
              <>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-ink">{s.label}</span>
                  <span className="block text-[11px] text-grey-700">{s.sub}</span>
                </span>
                <span className="text-wine flex-shrink-0">
                  {s.external ? <WhatsAppIcon size={14} /> : <ArrowIcon size={13} />}
                </span>
              </>
            );
            const cls =
              "flex items-center justify-between gap-2.5 px-3.5 py-3 hover:bg-paper transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink" +
              (i < services.length - 1 ? " border-b border-grey-200" : "");
            return s.external ? (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={cls}
              >
                {inner}
              </a>
            ) : (
              <Link key={s.label} href={s.href} onClick={() => setOpen(false)} className={cls}>
                {inner}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
