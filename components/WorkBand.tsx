import type { CSSProperties } from "react";

/**
 * Banda "Operación real · Yiwu" — clip mudo en loop de la bodega en China.
 * Prueba visual del diferenciador "equipo y bodega propios" (no intermediario
 * remoto). Va después de <YiwuAdvantage />. Server component: <video> con
 * autoPlay/muted/loop/playsInline es HTML puro, no necesita "use client".
 *
 * SEO: un único título descriptivo (con keywords DTD Cargo / puerta a puerta /
 * Yiwu-China) se reusa en el nombre de archivo, el alt/title del <video> y el
 * VideoObject (JSON-LD). Esa coherencia de señal es la buena práctica real —
 * NO el mismo texto idéntico en todos los assets (eso sería keyword stuffing).
 *
 * El clip es VERTICAL → layout de 2 columnas; el frame fija aspect 64/91 para
 * que el <video> absolute lo llene y, en prefers-reduced-motion, el poster fijo
 * conserve la altura (ver globals.css .work-band-frame / .work-band-video).
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/** Base del nombre de archivo = título SEO en kebab-case (sin acentos). */
const VIDEO_BASE = "/videos/bodega-dtd-cargo-yiwu-china-puerta-a-puerta";

/** Mismo título legible para alt / title / VideoObject.name. */
const VIDEO_TITLE =
  "Bodega de DTD Cargo en Yiwu, China — carga consolidada puerta a puerta a Venezuela";

const VIDEO_DESC =
  "Equipo propio de DTD Cargo consolidando, embalando y asegurando carga en su bodega de Yiwu (China) para envío puerta a puerta (DDP) a Venezuela.";

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center lg:items-start">
          <div>
            <span className="eyebrow">Operación real · 义乌 Yiwu</span>
            <h2 className="h-section mt-4">Dentro de nuestra bodega en Yiwu.</h2>
            <p className="lead mt-6 max-w-[46ch]">
              No es stock ni un render: es nuestro equipo en China consolidando,
              embalando y asegurando tu carga. Gente nuestra del lado de allá —
              no un intermediario remoto.
            </p>
          </div>

          <figure className="m-0 mx-auto w-full max-w-[340px]">
            <div
              className="work-band-frame relative aspect-[64/91] rounded-[20px] overflow-hidden card-shadow border border-grey-200 bg-ink"
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
            <figcaption className="mt-3 text-[13px] text-grey-500 text-center">
              Bodega de DTD Cargo · Yiwu, China — carga puerta a puerta a Venezuela.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
