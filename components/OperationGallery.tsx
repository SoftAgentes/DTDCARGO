import { CompanyPhotoCarousel } from "./CompanyPhotoCarousel";
import { LazyVideo } from "./LazyVideo";
import { serializeJsonLd } from "@/lib/public/json-ld";

/** Equipo y operación: carrusel manual, video y clips con su contexto original. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

const MAIN_VIDEO_BASE =
  "/videos/equipo-cargando-contenedor-dtd-cargo-puerta-a-puerta-china-venezuela";
const MAIN_VIDEO_TITLE =
  "Equipo de DTD Cargo cargando un contenedor en Yiwu, China — envío puerta a puerta a Venezuela";
const MAIN_VIDEO_DESC =
  "Equipo propio de DTD Cargo estibando carga consolidada en el contenedor en Yiwu (China), con las cajas marcadas, para envío puerta a puerta (DDP) a Venezuela.";

const videoJsonLd = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: MAIN_VIDEO_TITLE,
  description: MAIN_VIDEO_DESC,
  thumbnailUrl: [`${SITE_URL}${MAIN_VIDEO_BASE}-poster.jpg`],
  contentUrl: `${SITE_URL}${MAIN_VIDEO_BASE}.mp4`,
  uploadDate: "2026-06-05T12:00:00-04:00",
  // @id → consolida con el nodo #organization del root layout (una sola entidad).
  publisher: {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "DTD Cargo",
    url: SITE_URL,
  },
};

const CLIPS = [
  {
    base: "/videos/shipping-mark-dtd-pallets-dtd-cargo-puerta-a-puerta-china-venezuela",
    alt: "Pallets con el Shipping Mark DTD en la bodega de China — carga consolidada puerta a puerta a Venezuela",
    caption: "Tu Shipping Mark en cada pallet",
  },
];

export function OperationGallery() {
  return (
    <section className="py-20 lg:py-25 bg-ink text-white" id="operacion">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(videoJsonLd) }}
      />
      <div className="wrap">
        <div className="max-w-[60ch]">
          <span className="eyebrow" style={{ color: "rgba(255,255,255,0.5)" }}>
            Nuestro equipo y operación
          </span>
          <h2 className="h-section mt-4" style={{ color: "white" }}>
            Conoce el trabajo detrás de tu envío.
          </h2>
          <p className="lead mt-5" style={{ color: "rgba(255,255,255,0.7)" }}>
            Personas, atención y manejo de mercancía en las distintas etapas de nuestro servicio.
          </p>
        </div>

        {/* Video principal — equipo cargando el contenedor (16:9) */}
        <figure className="m-0 mt-12 max-w-[1040px]">
          <LazyVideo
            base={MAIN_VIDEO_BASE}
            title={MAIN_VIDEO_TITLE}
            frameClassName="work-band-frame relative aspect-video rounded-[20px] overflow-hidden card-shadow-dark border border-white/10 bg-black/30"
          />
          <figcaption className="mt-3 text-[13px] text-white/55">
            Carga consolidada saliendo de nuestra bodega en Yiwu, China — DTD Cargo.
          </figcaption>
        </figure>

        <CompanyPhotoCarousel />

        {/* El sello en movimiento — clip vertical, mudo, en loop */}
        <p className="eyebrow mt-10" style={{ color: "rgba(255,255,255,0.5)" }}>
          El sello, en movimiento
        </p>
        <div className="mt-4 max-w-[300px]">
          {CLIPS.map((v) => (
            <figure key={v.base} className="m-0">
              <LazyVideo
                base={v.base}
                title={v.alt}
                frameClassName="work-band-frame relative aspect-[9/16] rounded-[18px] overflow-hidden card-shadow-dark border border-white/10 bg-black/30"
              />
              <figcaption className="mt-3 text-[13px] text-white/55">
                {v.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
