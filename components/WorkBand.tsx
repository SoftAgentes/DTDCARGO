import type { CSSProperties } from "react";

/**
 * Banda "Operación real · Yiwu" — clip mudo en loop de la bodega en China.
 * Prueba visual del diferenciador "equipo y bodega propios" (no intermediario
 * remoto). Va después de <YiwuAdvantage />. Server component: <video> con
 * autoPlay/muted/loop/playsInline es HTML puro, no necesita "use client".
 *
 * El clip es VERTICAL (filmado con teléfono) → layout de 2 columnas: copy a la
 * izquierda, video enmarcado tipo reel a la derecha. El frame fija el aspect
 * (64/91 ≈ el ratio del clip) para que el <video> absolute lo llene y para que,
 * en prefers-reduced-motion, el poster fijo conserve la altura (ver globals.css
 * .work-band-frame / .work-band-video). Assets en public/videos/ (mp4 + webm +
 * poster), recortados desde material real (sin marcas de terceros).
 */
export function WorkBand() {
  return (
    <section className="py-20 lg:py-25 bg-paper" id="operacion">
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
              style={{ "--wb-poster": "url('/videos/yiwu-poster.jpg')" } as CSSProperties}
            >
              <video
                className="work-band-video absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster="/videos/yiwu-poster.jpg"
                aria-label="Equipo de DTD Cargo consolidando y asegurando carga en la bodega de Yiwu, China"
              >
                <source src="/videos/yiwu.webm" type="video/webm" />
                <source src="/videos/yiwu.mp4" type="video/mp4" />
              </video>
            </div>
            <figcaption className="mt-3 text-[13px] text-grey-500 text-center">
              Bodega DTD Cargo · Yiwu, China.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
