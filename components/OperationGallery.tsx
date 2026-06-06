import Image from "next/image";
import { LazyVideo } from "./LazyVideo";

/**
 * Sección "El sello DoorTuDoor" — la marca DTD/DoorTuDoor visible en la
 * operación real en China. Dos partes:
 *   1) Fotos del precinto en el contenedor (detalle estático).
 *   2) Clips verticales (mudos, loop) del marcado en movimiento: la cinta de
 *      embalaje DoorTuDoor y el shipping mark "DTD-…" en los pallets.
 * Server component (Image + <video> HTML nativo, sin "use client"). Los videos
 * reusan el patrón de <WorkBand /> (clases .work-band-frame / .work-band-video
 * en globals.css: sin lift en hover + poster fijo en prefers-reduced-motion).
 *
 * SEO: nombre de archivo + alt/title con keywords (DTD Cargo · puerta a puerta ·
 * China-Venezuela), únicos por asset. Fotos en public/fotos/, videos en public/videos/.
 */
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

const VIDEOS = [
  {
    base: "/videos/cinta-embalaje-doortudoor-dtd-cargo-puerta-a-puerta-china-venezuela",
    alt: "Cajas selladas con la cinta de embalaje DoorTuDoor de DTD Cargo en la bodega de China — carga puerta a puerta a Venezuela",
    caption: "Cinta DoorTuDoor en cada bulto",
  },
  {
    base: "/videos/shipping-mark-dtd-pallets-dtd-cargo-puerta-a-puerta-china-venezuela",
    alt: "Pallets con el shipping mark DTD en la bodega de China — carga consolidada puerta a puerta a Venezuela",
    caption: "Tu shipping mark DTD en cada pallet",
  },
];

export function OperationGallery() {
  return (
    <section className="py-20 lg:py-25 bg-grey-100" id="marca-operacion">
      <div className="wrap">
        <div className="max-w-[58ch]">
          <span className="eyebrow">Nuestra marca, en cada envío</span>
          <h2 className="h-section mt-4">El sello DoorTuDoor en tu carga.</h2>
          <p className="lead mt-6">
            Cada caja y cada contenedor sale precintado y marcado por nosotros en
            China. Así sabés que tu mercancía la maneja DTD Cargo — de la fábrica
            a tu puerta, sin intermediarios.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
          {PHOTOS.map((p) => (
            <figure key={p.src} className="m-0">
              <div className="relative aspect-[4/3] rounded-[18px] overflow-hidden card-shadow border border-grey-300 bg-grey-200">
                <Image
                  src={p.src}
                  alt={p.alt}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-3 text-[13px] text-grey-500">
                {p.caption}
              </figcaption>
            </figure>
          ))}
        </div>

        {/* El sello en movimiento — clips verticales, mudos, en loop */}
        <p className="eyebrow mt-10">El sello, en movimiento</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4 max-w-[300px] sm:max-w-[520px]">
          {VIDEOS.map((v) => (
            <figure key={v.base} className="m-0">
              <LazyVideo
                base={v.base}
                title={v.alt}
                frameClassName="work-band-frame relative aspect-[9/16] rounded-[18px] overflow-hidden card-shadow border border-grey-300 bg-ink"
              />
              <figcaption className="mt-3 text-[13px] text-grey-500">
                {v.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
