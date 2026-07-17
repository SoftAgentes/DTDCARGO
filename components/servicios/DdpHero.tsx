/**
 * DdpHero — el servicio principal (Puerta a puerta) como PROTAGONISTA de
 * /servicios (slice "DDP héroe", panel UX 2026-06-14).
 *
 * Por qué: el ~90% de los clientes elige el puerta a puerta, pero antes era 1
 * card paraguas más entre 20 (se diluía). Acá toma una sección propia, alta, con su CTA de
 * conversión (Calculadora) — y las otras 19 cosas quedan como complementos
 * abajo (el explorador). Server component presentacional: cero estado.
 *
 * Reusa `FichaCuerpo` (presentacional puro, mismo contenido que las fichas del
 * explorador → una sola fuente de verdad, SSR/SEO intacto). El contenido sale
 * de `getServiciosParaSitio()` (DB publicada + fallback estático), no se inventa.
 * Los ganchos NO se repiten arriba: el `incluye` completo ya lo muestra la
 * FichaCuerpo justo debajo (review UI/UX 2026-06-14, anti-duplicación).
 */
import Link from "next/link";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { FichaCuerpo } from "@/components/servicios/FichaCuerpo";
import type { ServicioDetalle } from "@/lib/servicios-detalle";

export function DdpHero({ ddp }: { ddp: ServicioDetalle | null }) {
  if (!ddp) return null;

  const wa = buildWhatsAppLink(
    "Hola DTD Cargo, quiero cotizar un envío puerta a puerta de China a Venezuela.",
  );

  return (
    <section id={ddp.slug} className="scroll-mt-28 pt-6 lg:pt-10">
      <div className="wrap">
        <div className="card-shadow-static bg-white border border-wine rounded-[20px] overflow-hidden">
          {/* Cabecera: valor (izq) + tarjeta de acción (der) */}
          <div className="px-6 lg:px-9 pt-7 lg:pt-9 pb-7 lg:pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-8 lg:gap-12 lg:items-start">
              {/* Izquierda — el valor */}
              <div>
                <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] uppercase text-wine">
                  <span className="w-1.5 h-1.5 rounded-full bg-wine" aria-hidden />
                  Servicio principal · lo elige 9 de cada 10 clientes
                </span>
                <h2
                  className="mt-4 text-[30px] lg:text-[46px] leading-[1.04] tracking-[-0.01em] text-ink"
                  style={{ fontFamily: "var(--font-archivo-black)" }}
                >
                  Puerta a puerta.
                  <br />
                  <span style={{ color: "var(--color-wine)" }}>Pagas al llegar.</span>
                </h2>
                <p className="mt-5 text-[15px] lg:text-[16.5px] leading-[1.55] text-grey-700 max-w-[56ch]">
                  {ddp.resumen}
                </p>
              </div>

              {/* Derecha — la acción (conversión principal de la página) */}
              <aside className="rounded-[16px] border border-grey-200 bg-paper p-6">
                <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-grey-500">
                  Cómo se cobra
                </span>
                <p className="mt-2 text-[14px] leading-[1.5] text-grey-700">
                  Se calcula por volumen (CBM) y ciudad de destino.{" "}
                  <strong className="text-ink">60 a 90 días</strong> puerta a puerta.
                </p>
                <div className="mt-5 flex flex-col gap-2.5">
                  <Link href="/calculadora" className="btn btn-primary w-full">
                    Calcula tu estimado
                  </Link>
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost w-full"
                  >
                    Pregunta por WhatsApp
                  </a>
                </div>
                <p className="mt-3 text-[12px] leading-[1.45] text-grey-500">
                  O{" "}
                  <Link
                    href="/registro"
                    className="font-semibold text-wine hover:text-wine-deep underline underline-offset-2"
                  >
                    regístrate
                  </Link>{" "}
                  para tu Shipping Mark y cotiza desde tu portal.
                </p>
              </aside>
            </div>
          </div>

          {/* Detalle completo — siempre visible (qué incluye, qué no, precio,
              tiempos, cómo se solicita). Misma FichaCuerpo de las fichas. */}
          <FichaCuerpo service={ddp} />
        </div>
      </div>
    </section>
  );
}
