import Image from "next/image";
import { LazyVideo } from "./LazyVideo";

/**
 * Sección "Operación real · Yiwu" — fusión de la galería del sello + el clip del
 * equipo (antes <OperationGallery /> + <WorkBand />, dos secciones que rimaban).
 * Ahora UN solo bloque de prueba sobre fondo navy (bg-ink): video del equipo
 * cargando el contenedor arriba + fotos del precinto + clips verticales de apoyo.
 *
 * El navy da ritmo al scroll (auditoría ui-ux 2026-06-13: evita el "muro claro"
 * de varias secciones paper seguidas) y hace leer todo como una sola prueba real
 * de "equipo y bodega propios", con la marca DTD visible.
 *
 * SEO: VideoObject JSON-LD del video principal; alts/captions con keywords
 * (DTD Cargo · puerta a puerta · Yiwu-China · Venezuela). Server component.
 */
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

const PHOTOS = [
  {
    src: "/fotos/carga-contenedor-precinto-doortudoor-dtd-cargo-puerta-a-puerta-china-venezuela.jpg",
    alt: "Carga consolidada en el contenedor con el precinto DoorTuDoor de DTD Cargo en Yiwu, China — envío puerta a puerta a Venezuela",
    caption: "Carga precintada por DTD Cargo · Yiwu, China",
  },
  {
    src: "/fotos/precinto-doortudoor-contenedor-dtd-cargo-puerta-a-puerta-china-venezuela.jpg",
    alt: "Precinto DoorTuDoor de DTD Cargo en la puerta del contenedor — carga puerta a puerta de China a Venezuela",
    caption: "El sello DoorTuDoor en cada contenedor",
  },
];

const CLIPS = [
  {
    base: "/videos/cinta-embalaje-doortudoor-dtd-cargo-puerta-a-puerta-china-venezuela",
    alt: "Cajas selladas con la cinta de embalaje DoorTuDoor de DTD Cargo en la bodega de China — carga puerta a puerta a Venezuela",
    caption: "Cinta DoorTuDoor en cada bulto",
  },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
      />
      <div className="wrap">
        <div className="max-w-[60ch]">
          <span className="eyebrow" style={{ color: "rgba(255,255,255,0.5)" }}>
            Operación real · 义乌 Yiwu
          </span>
          <h2 className="h-section mt-4" style={{ color: "white" }}>
            Así trabajamos tu carga en Yiwu.
          </h2>
          <p className="lead mt-5" style={{ color: "rgba(255,255,255,0.7)" }}>
            No es stock ni un render: es nuestro equipo en Yiwu recibiendo,
            marcando y estibando tu mercancía, con la marca DTD visible. Gente
            nuestra del lado de allá — de la fábrica a tu puerta.
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

        {/* Evidencia de apoyo: el sello DoorTuDoor (fotos del precinto) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
          {PHOTOS.map((p) => (
            <figure key={p.src} className="m-0">
              <div className="relative aspect-[4/3] rounded-[18px] overflow-hidden card-shadow-dark border border-white/10 bg-white/[0.04]">
                <Image
                  src={p.src}
                  alt={p.alt}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-3 text-[13px] text-white/55">
                {p.caption}
              </figcaption>
            </figure>
          ))}
        </div>

        {/* El sello en movimiento — clips verticales, mudos, en loop */}
        <p className="eyebrow mt-10" style={{ color: "rgba(255,255,255,0.5)" }}>
          El sello, en movimiento
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4 max-w-[300px] sm:max-w-[520px]">
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
