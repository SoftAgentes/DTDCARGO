import Image from "next/image";
import { TESTIMONIALS } from "@/lib/design-tokens";
import { QuoteIcon } from "./Icon";

/**
 * Sección de testimonios de clientes.
 *
 * Se AUTO-OCULTA si `TESTIMONIALS` está vacío (no renderiza nada) — así queda
 * "listo y oculto" hasta cargar reseñas reales en lib/design-tokens.ts.
 * Nunca usar datos inventados (regla de marca: clientes reales, no basura).
 */
export function Testimonials() {
  if (TESTIMONIALS.length === 0) return null;

  return (
    <section className="py-16 lg:py-20 bg-paper" id="testimonios">
      <div className="wrap">
        <span className="eyebrow">Lo que dicen nuestros clientes</span>
        <h2 className="h-section mt-4">
          Confianza que se gana
          <br />
          cliente a cliente.
        </h2>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <figure
              key={`${t.name}-${i}`}
              className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 flex flex-col"
            >
              <QuoteIcon className="text-wine/25 flex-shrink-0" size={30} />
              <blockquote className="mt-3 flex-1 text-[15px] leading-[1.6] text-grey-700">
                {t.quote}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                {t.photo ? (
                  <Image
                    src={t.photo}
                    alt={t.name}
                    width={44}
                    height={44}
                    className="rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <span
                    className="w-11 h-11 rounded-full bg-grey-100 grid place-items-center text-ink flex-shrink-0"
                    style={{ fontFamily: "var(--font-archivo-black)" }}
                    aria-hidden="true"
                  >
                    {t.name.charAt(0)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-ink truncate">
                    {t.name}
                  </span>
                  <span className="block text-[12.5px] text-grey-500 truncate">
                    {t.detail}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
