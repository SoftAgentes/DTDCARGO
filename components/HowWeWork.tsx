import Link from "next/link";
import { STEPS, buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon, LoopIcon } from "./Icon";

/**
 * Sección "Cómo trabajamos" — 4 pasos en grid.
 * Portada del Brand Book DTD § HowWeWork.
 */
export function HowWeWork() {
  return (
    <section className="py-20 lg:py-25 bg-paper" id="how">
      <div className="wrap">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-10 mb-14">
          <div>
            <span className="eyebrow">Cómo trabajamos</span>
            <h2 className="h-section mt-4">
              De China a tu puerta,
              <br />
              en cuatro pasos.
            </h2>
          </div>
          <p className="lead max-w-[38ch]">
            Tú cotizas y pre-alertas; nosotros recibimos y entregamos — con un
            solo equipo responsable, sin call centers ni handoffs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-8 flex flex-col"
            >
              <div
                className="text-[14px] tracking-[0.1em] mb-3"
                style={{
                  color: "var(--color-wine)",
                  fontFamily: "var(--font-archivo-black)",
                }}
              >
                {s.n} / 04
              </div>
              <h3 className={`h-card text-ink ${s.tag ? "mb-1" : "mb-2"}`}>
                {s.title}
              </h3>
              {s.tag && (
                <div
                  className="text-[12.5px] font-semibold tracking-[0.02em] mb-2.5"
                  style={{ color: "var(--color-wine)" }}
                >
                  {s.tag}
                </div>
              )}
              <p className="text-[14px] leading-[1.55] text-grey-700">
                {s.copy}
              </p>
            </div>
          ))}
        </div>

        {/* Cierre del bucle: el ciclo se repite (recompra) — "de China a tu puerta, una y otra vez". */}
        <div className="mt-12 flex items-center justify-center gap-2.5 text-center">
          <LoopIcon size={18} className="text-wine flex-shrink-0" />
          <p className="text-[14px] leading-[1.5] text-grey-700">
            Cuando la recibes, vuelves a pedir —{" "}
            <strong className="text-ink">de China a tu puerta, una y otra vez.</strong>
          </p>
        </div>

        {/* CTA — momento de máxima intención del scroll. Primario: /calculadora. */}
        <div className="mt-8 text-center">
          <Link href="/calculadora" className="btn btn-primary">
            Cotizar mi envío <ArrowIcon />
          </Link>
          <p className="mt-3 text-[13px] text-grey-700">
            Estimación al instante, sin registro — o{" "}
            <a
              href={buildWhatsAppLink(
                "Hola DTD Cargo, quiero cotizar mi envío de China a Venezuela. ¿Pueden ayudarme?"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-wine hover:text-wine-deep underline underline-offset-2 decoration-1"
            >
              escríbenos por WhatsApp
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
