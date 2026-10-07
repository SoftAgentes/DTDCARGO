"use client";

import Image from "next/image";
import { useRef, useState } from "react";

const PHOTOS = [
  { src: "dtd-cargo-atencion-mapa", caption: "Atención y planificación", alt: "Dos personas revisan un mapa durante la atención de DTD Cargo" },
  { src: "dtd-cargo-equipo-oficina", caption: "Nuestro equipo de atención", alt: "Equipo de atención de DTD Cargo en sus puestos de oficina" },
  { src: "dtd-cargo-equipo-contenedor", caption: "Preparación del contenedor", alt: "Dos integrantes del equipo junto a las puertas de un contenedor" },
  { src: "dtd-cargo-carga-consolidada", caption: "Mercancía preparada para embarque", alt: "Cajas con cinta DTD Cargo dentro de un contenedor" },
  { src: "dtd-cargo-operacion-puerto", caption: "Manejo de carga en el puerto", alt: "Equipo con chalecos DTD Cargo manejando bultos junto a un contenedor" },
  { src: "dtd-cargo-recepcion-contenedor", caption: "Recepción de un contenedor", alt: "Dos integrantes del equipo frente a un contenedor con cajas" },
  { src: "dtd-cargo-descarga-bodega", caption: "Descarga de mercancía en bodega", alt: "Equipo descargando un camión con un montacargas" },
  { src: "dtd-cargo-camion-entrega", caption: "Carga en un camión DTD Cargo", alt: "Personas junto a la parte posterior de un camión con la marca DTD Cargo" },
] as const;

const controlClass = "inline-flex items-center justify-center rounded-[var(--r-md)] border border-[var(--color-grey-300)] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-wine)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-paper)]";

/* TODO: brand-review — composición nueva con controles nativos y tokens públicos. */
/** Manual gallery: only the selected large image is mounted; thumbnails use small sources. */
export function CompanyPhotoCarousel() {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const photo = PHOTOS[index];
  const select = (next: number) => setIndex((next + PHOTOS.length) % PHOTOS.length);

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Fotos de nuestro equipo y operación"
      className="mt-10 min-w-0"
      onKeyDown={(event) => {
        // Native button Enter/Space and Tab remain unchanged.
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const next = event.key === "ArrowRight" ? index + 1
          : event.key === "ArrowLeft" ? index - 1
          : event.key === "Home" ? 0
          : event.key === "End" ? PHOTOS.length - 1 : null;
        if (next !== null) { event.preventDefault(); select(next); }
      }}
    >
      <figure className="m-0">
        <div
          data-testid="company-photo-frame"
          className="relative aspect-square sm:aspect-video overflow-hidden rounded-[var(--r-xl)] border border-[var(--color-grey-300)] bg-[var(--color-ink)] touch-pan-y"
          onTouchStart={(event) => {
            const touch = event.touches.length === 1 ? event.touches[0] : null;
            touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
          }}
          onTouchCancel={() => { touchStart.current = null; }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            touchStart.current = null;
            const end = event.changedTouches[0];
            if (!start || !end) return;
            const dx = end.clientX - start.x;
            const dy = end.clientY - start.y;
            if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.5) select(index + (dx < 0 ? 1 : -1));
          }}
        >
          <Image
            key={photo.src}
            src={'/fotos/' + photo.src + '.webp'}
            alt={photo.alt}
            fill
            sizes="(min-width: 1280px) 1200px, (min-width: 640px) 90vw, 100vw"
            className="object-contain"
            loading="lazy"
            draggable={false}
          />
        </div>
        <figcaption aria-live="polite" aria-atomic="true" className="mt-4 flex min-h-12 flex-wrap items-start justify-between gap-2 text-base text-[var(--color-paper)]">
          <span>{photo.caption}</span>
          <span className="shrink-0 tabular-nums">{index + 1} de {PHOTOS.length}</span>
        </figcaption>
      </figure>
      <div className="mt-4 flex gap-3" aria-label="Navegar fotos">
        <button type="button" onClick={() => select(index - 1)} aria-label="Foto anterior" className={controlClass + " min-h-12 min-w-12 gap-2 px-4"}>
          <span aria-hidden="true">←</span> Anterior
        </button>
        <button type="button" onClick={() => select(index + 1)} aria-label="Foto siguiente" className={controlClass + " min-h-12 min-w-12 gap-2 px-4"}>
          Siguiente <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-8" role="group" aria-label="Seleccionar una foto">
        {PHOTOS.map((item, number) => (
          <button
            key={item.src}
            type="button"
            aria-label={'Ver foto ' + (number + 1) + ': ' + item.caption}
            aria-pressed={number === index}
            onClick={() => select(number)}
            className={controlClass + " relative aspect-square min-h-12 min-w-0 overflow-hidden " + (number === index ? "ring-2 ring-[var(--color-paper)] ring-offset-2 ring-offset-[var(--color-ink)]" : "")}
          >
            <Image src={'/fotos/' + item.src + '.webp'} alt="" fill sizes="(min-width: 640px) 128px, 80px" className="object-contain" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
