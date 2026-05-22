import { PHILOSOPHY, buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon, QuoteIcon, WhatsAppIcon } from "./Icon";

/**
 * Sección de filosofía / cierre — boca a boca, paso a paso.
 * Fuente: brochure DTD Cargo § "Nuestra Filosofía" + cierre.
 */
export function Philosophy() {
  return (
    <section className="py-20 lg:py-25 bg-paper" id="filosofia">
      <div className="wrap max-w-[960px]">
        <div className="text-center">
          <span className="eyebrow inline-flex">Nuestra filosofía</span>
        </div>

        <h2
          className="h-display text-center mt-6 whitespace-pre-line"
          style={{ fontSize: "clamp(34px, 5vw, 64px)" }}
        >
          {PHILOSOPHY.headline.split("\n").map((line, i, arr) => (
            <span key={i} className="block">
              {i === arr.length - 1 ? (
                <span style={{ color: "var(--color-wine)" }}>{line}</span>
              ) : (
                line
              )}
            </span>
          ))}
        </h2>

        <p className="text-[18px] lg:text-[19px] leading-[1.6] text-grey-700 text-center mt-8 max-w-[680px] mx-auto">
          {PHILOSOPHY.body}
        </p>

        {/* Pull quote */}
        <figure className="mt-14 mx-auto max-w-[720px] relative">
          <QuoteIcon
            className="absolute -top-4 -left-4 lg:-left-10 text-wine/15"
            size={64}
          />
          <blockquote
            className="text-[22px] lg:text-[26px] leading-[1.45] tracking-[-0.01em] text-ink relative z-10 pl-6 lg:pl-0"
            style={{ fontFamily: "var(--font-archivo-black)" }}
          >
            <span style={{ color: "var(--color-wine)" }}>“</span>
            {PHILOSOPHY.pull}
            <span style={{ color: "var(--color-wine)" }}>”</span>
          </blockquote>
        </figure>

        <div className="text-center mt-14">
          <p
            className="text-[18px] lg:text-[20px] leading-[1.4] text-ink mb-6"
            style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
          >
            {PHILOSOPHY.cta}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href={buildWhatsAppLink(
                "Hola DTD-CARGO, vi su página y quiero cotizar un envío. ¿Pueden ayudarme?"
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Cotiza tu envío <ArrowIcon />
            </a>
            <a
              href={buildWhatsAppLink(
                "Hola DTD-CARGO, quería hablar con un asesor sobre logística China-Venezuela."
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              <span style={{ color: "#25D366" }}>
                <WhatsAppIcon size={18} />
              </span>{" "}
              Escríbenos por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
