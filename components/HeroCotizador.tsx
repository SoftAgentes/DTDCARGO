"use client";

import { useState, type FormEvent } from "react";
import { HERO, CONTACT } from "@/lib/design-tokens";
import { FlagCN, FlagVE, WhatsAppIcon } from "./Icon";

/**
 * Cotizador inline del Hero — versión MVP.
 *
 * Mientras el ERP no exponga `POST /api/public/estimacion` con respuesta real,
 * el cotizador NO simula precios falsos. En su lugar, abre WhatsApp con un
 * mensaje pre-rellenado que interpola origen y destino de los inputs.
 *
 * El asesor humano del otro lado recibe un lead calificado con la ruta
 * declarada y puede dar tarifa real en minutos.
 *
 * Cuando el ERP esté listo, basta cambiar `onSubmit` para hacer `router.push`
 * a `/estimacion?origen=X&destino=Y` con el form ya pre-llenado.
 */
export function HeroCotizador() {
  const [origen, setOrigen] = useState<string>(HERO.search.originDefault);
  const [destino, setDestino] = useState<string>(HERO.search.destDefault);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message = `Hola DTD Cargo, quiero cotizar un envío desde ${origen.trim()} a ${destino.trim()}. ¿Cuál es la tarifa actual por CBM?`;
    const url = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="card-shadow bg-white border border-grey-200 rounded-[14px] p-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2.5 max-w-[620px]"
        role="search"
      >
        <label className="flex items-center gap-2.5 px-3.5 rounded-[10px] bg-grey-100 h-14">
          <FlagCN className="flex-shrink-0 opacity-90" size={22} />
          <input
            name="origen"
            type="text"
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            placeholder={HERO.search.originPlaceholder}
            aria-label="Origen"
            className="flex-1 border-0 outline-none bg-transparent text-[19px] font-bold text-ink text-center placeholder:font-normal placeholder:text-grey-500"
          />
        </label>
        <label className="flex items-center gap-2.5 px-3.5 rounded-[10px] bg-grey-100 h-14">
          <FlagVE className="flex-shrink-0 opacity-90" size={22} />
          <input
            name="destino"
            type="text"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder={HERO.search.destPlaceholder}
            aria-label="Destino"
            className="flex-1 border-0 outline-none bg-transparent text-[19px] font-bold text-ink text-center placeholder:font-normal placeholder:text-grey-500"
          />
        </label>
        <button type="submit" className="btn btn-primary h-14">
          <WhatsAppIcon size={18} /> {HERO.search.cta}
        </button>
      </form>
      <p className="mt-2.5 text-[12.5px] text-grey-500 max-w-[620px]">
        Un asesor en Valencia te responde con presupuesto inicial · Lun–Vie 9:00–17:00 hora VE
      </p>
    </>
  );
}
