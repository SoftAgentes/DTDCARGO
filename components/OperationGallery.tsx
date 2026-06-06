import Image from "next/image";

/**
 * Galería "El sello DoorTuDoor" — 2 fotos reales de la operación en China con
 * la marca DTD/DoorTuDoor visible (precinto en el contenedor + carga marcada).
 * Complementa <WorkBand /> (video): el video muestra la operación en movimiento,
 * la galería el detalle del sello de marca. Server component (solo <Image>).
 *
 * Las fotos tienen aspect distinto (una 4:3, otra 3:4); van en contenedores 4:3
 * uniformes con object-cover para que el grid quede balanceado. El logo queda
 * dentro del recorte en ambas (en of_06 a la derecha, en of_05 al centro).
 *
 * SEO: nombre de archivo + alt descriptivos con keywords (DTD Cargo · puerta a
 * puerta · China-Venezuela), únicos por foto. Assets en public/fotos/.
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
      </div>
    </section>
  );
}
