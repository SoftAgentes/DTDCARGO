import type { CSSProperties } from "react";

/**
 * Banda "Operación real · Yiwu" — clip mudo en loop del equipo cargando un
 * contenedor en China, con la marca DTD/DoorTuDoor visible (camisetas, stickers
 * en cajas, shipping marks). Prueba del diferenciador "equipo y bodega propios".
 * Va después de <YiwuAdvantage />. Server component (video HTML nativo).
 *
 * SEO: un único título descriptivo (keywords DTD Cargo / puerta a puerta /
 * Yiwu-China / Venezuela) reusado en nombre de archivo, alt/title del <video> y
 * el VideoObject (JSON-LD).
 *
 * El clip es HORIZONTAL (16:9) → banda con copy arriba y el video ancho debajo.
 * El frame fija aspect-video para que el <video> absolute lo llene y, en
 * prefers-reduced-motion, el poster fijo conserve la altura (ver globals.css
 * .work-band-frame / .work-band-video).
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

const VIDEO_BASE =
  "/videos/equipo-cargando-contenedor-dtd-cargo-puerta-a-puerta-china-venezuela";

const VIDEO_TITLE =
  "Equipo de DTD Cargo cargando un contenedor en Yiwu, China — envío puerta a puerta a Venezuela";

const VIDEO_DESC =
  "Equipo propio de DTD Cargo estibando carga consolidada en el contenedor en Yiwu (China), con las cajas marcadas, para envío puerta a puerta (DDP) a Venezuela.";

const videoJsonLd = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: VIDEO_TITLE,
  description: VIDEO_DESC,
  thumbnailUrl: [`${SITE_URL}${VIDEO_BASE}-poster.jpg`],
  contentUrl: `${SITE_URL}${VIDEO_BASE}.mp4`,
  uploadDate: "2026-06-05",
  publisher: { "@type": "Organization", name: "DTD Cargo", url: SITE_URL },
};

export function WorkBand() {
  return (
    <section className="py-20 lg:py-25 bg-paper" id="operacion">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
      />
      <div className="wrap">
        <div className="max-w-[58ch]">
          <span className="eyebrow">Operación real · 义乌 Yiwu</span>
          <h2 className="h-section mt-4">Así cargamos tu contenedor en Yiwu.</h2>
          <p className="lead mt-5">
            No es stock ni un render: es nuestro equipo en Yiwu estibando tu
            mercancía, con las cajas marcadas. Gente nuestra del lado de allá —
            puerta a puerta hasta Venezuela.
          </p>
        </div>

        <figure className="m-0 mt-12 max-w-[1040px]">
          <div
            className="work-band-frame relative aspect-video rounded-[20px] overflow-hidden card-shadow border border-grey-200 bg-ink"
            style={{ "--wb-poster": `url('${VIDEO_BASE}-poster.jpg')` } as CSSProperties}
          >
            <video
              className="work-band-video absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={`${VIDEO_BASE}-poster.jpg`}
              title={VIDEO_TITLE}
              aria-label={VIDEO_TITLE}
            >
              <source src={`${VIDEO_BASE}.webm`} type="video/webm" />
              <source src={`${VIDEO_BASE}.mp4`} type="video/mp4" />
            </video>
          </div>
          <figcaption className="mt-3 text-[13px] text-grey-500">
            Carga consolidada saliendo de nuestra bodega en Yiwu, China — DTD Cargo.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
