import Link from "next/link";
import { PHILOSOPHY, buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon, QuoteIcon, WhatsAppIcon } from "./Icon";

/**
 * Sección de filosofía / cierre — la confianza se construye envío a envío.
 * Fuente: brochure DTD Cargo § "Nuestra Filosofía" + cierre.
 *
 * Las 4 razones usan el patrón de tarjeta del sistema (card-shadow + border
 * grey-200 + rounded-[18px] + h-card) — el mismo de "Por qué DTD" del brochure.
 */
export function Philosophy() {
  return (
    <section className="py-20 lg:py-25 bg-paper" id="filosofia">
      <div className="wrap max-w-[1040px]">
        <div className="text-center">
          <span className="eyebrow inline-flex">Nuestra filosofía</span>
        </div>

        <h2
          className="h-display text-center mt-6 whitespace-pre-line"
          style={{ fontSize: "clamp(30px, 4vw, 52px)" }}
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

        <div className="mt-8 max-w-[600px] mx-auto flex flex-col gap-5">
          {PHILOSOPHY.body.map((paragraph, i) => (
            <p
              key={i}
              className="text-[17px] lg:text-[18px] leading-[1.6] text-grey-700 text-center"
            >
              {paragraph}
            </p>
          ))}
        </div>

        {/* Pull quote */}
        <figure className="mt-12 mx-auto max-w-[720px] relative">
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

        {/* 4 razones — patrón de tarjeta del sistema */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {PHILOSOPHY.cards.map((card) => (
            <div
              key={card.title}
              className="card-shadow-static bg-white border border-grey-200 rounded-[18px] p-7 lg:p-8 flex flex-col"
            >
              <div
                className="text-[14px] tracking-[0.1em] mb-3"
                style={{
                  color: "var(--color-wine)",
                  fontFamily:
                    "var(--font-archivo-black), var(--font-noto-sc), sans-serif",
                }}
              >
                {card.kicker}
              </div>
              <h3 className="h-card text-ink mb-2">{card.title}</h3>
              <p className="text-[14px] leading-[1.55] text-grey-500">
                {card.copy}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-20">
          <p
            className="text-[18px] lg:text-[20px] leading-[1.4] text-ink mb-6"
            style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
          >
            {PHILOSOPHY.cta}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/tarifas" className="btn btn-primary">
              Cotizar mi envío <ArrowIcon />
            </Link>
            <a
              href={buildWhatsAppLink(
                "Hola DTD Cargo, vi su página y quiero hablar con un asesor sobre mi importación de China a Venezuela."
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              <span style={{ color: "var(--color-whatsapp)" }}>
                <WhatsAppIcon size={18} />
              </span>{" "}
              Hablar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
