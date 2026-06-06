"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Props = {
  /** Ruta base del clip sin extensión, ej "/videos/equipo-...". */
  base: string;
  /** Título/alt accesible (mismo texto que el VideoObject). */
  title: string;
  /** Clases del frame (aspect-ratio + bordes). Debe incluir `work-band-frame`. */
  frameClassName: string;
};

/**
 * Clip mudo en loop con carga DIFERIDA. El `<video>` (poster + fuentes) recién
 * se monta cuando el frame está por entrar al viewport (IntersectionObserver,
 * margen 300px). Así el poster y los MB del clip NO compiten con el render del
 * hero en móvil → mejora LCP/FCP. El frame reserva la altura por aspect-ratio →
 * cero CLS. Poster en .webp (liviano); el `-poster.jpg` queda solo para el
 * thumbnail del VideoObject (JSON-LD) y el fallback de prefers-reduced-motion.
 *
 * SSR: el `<video>` no va en el HTML inicial (se monta en cliente al hacer
 * scroll). La data de video para SEO vive en el JSON-LD server-rendered del
 * componente padre, no en este tag.
 */
export function LazyVideo({ base, title, frameClassName }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show]);

  const poster = `${base}-poster.webp`;

  return (
    <div
      ref={ref}
      className={frameClassName}
      // El bg (var --wb-poster) solo lo usa el CSS en prefers-reduced-motion.
      // Lo seteamos recién cuando montamos, para no cargar el poster antes.
      style={show ? ({ "--wb-poster": `url('${poster}')` } as CSSProperties) : undefined}
    >
      {show && (
        <video
          className="work-band-video absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          title={title}
          aria-label={title}
        >
          <source src={`${base}.webm`} type="video/webm" />
          <source src={`${base}.mp4`} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
