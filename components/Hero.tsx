import Image from "next/image";
import Link from "next/link";
import { HERO, BRAND_ASSETS } from "@/lib/design-tokens";
import { HeroCotizador } from "./HeroCotizador";

/**
 * Hero principal — slogan + cotizador inline + ilustración contenedor.
 * Copy y assets configurables desde `lib/design-tokens.ts` constant `HERO`.
 * Estructura visual portada del Brand Book DTD § Hero.
 */
export function Hero() {
  return (
    <section className="relative py-15 lg:py-[60px] lg:pb-20 overflow-hidden">
      <div className="wrap grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
        <div>
          <span className="eyebrow">{HERO.eyebrow}</span>
          {/*
           * H1 · tagline oficial v3.0 (mayo 2026):
           *   "Con confianza, / de China a tu puerta."
           *
           * Spec del brand book: línea 1 en wine (#7F0F1A) como antesala del
           * valor diferencial, línea 2 en ink (default) como la promesa
           * funcional. Ambas mismo peso visual — la jerarquía la da el color,
           * no el tamaño (a diferencia del v2.x que tenía 3 líneas con stepped
           * hierarchy + kicker).
           */}
          <h1 className="h-display mt-5 leading-[0.95]">
            {HERO.headline.map((line, i) => (
              <span
                key={i}
                className="block"
                style={{
                  fontSize: "clamp(40px, 6.2vw, 92px)",
                  color:
                    line.accent === "wine"
                      ? "var(--color-wine)"
                      : line.accent === "grey"
                        ? "var(--color-grey-700)"
                        : undefined,
                  marginTop: i > 0 ? "-0.04em" : undefined,
                }}
              >
                {line.text}
              </span>
            ))}
          </h1>
          <p
            className="mt-6 mb-8 text-[17px] leading-[1.55] max-w-[48ch]"
            style={{ color: "var(--color-grey-500)" }}
          >
            {HERO.subtitle}
          </p>

          {/* Cotizador inline — abre WhatsApp con mensaje pre-rellenado (origen/destino) */}
          <HeroCotizador />

          <div className="flex flex-wrap gap-6 mt-6 text-[13.5px] font-medium text-grey-500">
            {HERO.trustMarks.map((mark) => (
              <span key={mark}>✓ {mark}</span>
            ))}
          </div>

          {/* CTA secundario: alta de cliente. La acción primaria del hero es el
              cotizador (WhatsApp); esto queda subordinado como link de texto. */}
          <p className="mt-6 text-[14px] text-grey-500">
            ¿Vas a importar seguido?{" "}
            <Link
              href="/registro"
              className="font-semibold text-wine hover:text-wine-deep underline underline-offset-2 decoration-1"
            >
              Registrate como cliente
            </Link>{" "}
            y obtené tu MARKBOX.
          </p>
        </div>

        {/* Ilustración contenedor */}
        <div className="relative min-h-[320px] lg:min-h-[420px]">
          <Image
            src={BRAND_ASSETS.containerSvg}
            alt="Contenedor DTD Cargo"
            width={560}
            height={349}
            priority
            className="container-ocean-drift w-full h-auto lg:w-[560px] lg:h-auto lg:max-w-none lg:absolute lg:right-[-100px] lg:top-8"
          />
          <div
            className="absolute left-[6%] top-[8%] w-[96px] h-[96px] rounded-full grid place-items-center text-white text-center z-[2]"
            style={{
              background: "var(--color-wine)",
              fontFamily: "var(--font-archivo-black)",
              boxShadow:
                "0 14px 30px -10px rgba(127,15,26,0.55), 0 0 0 6px rgba(127,15,26,0.10)",
            }}
            aria-label={`${HERO.badge.main} ${HERO.badge.sub}`}
          >
            <div>
              <div className="text-[22px] leading-none">{HERO.badge.main}</div>
              <small className="block text-[8.5px] font-semibold mt-1.5 opacity-90 tracking-[0.08em] uppercase leading-[1.2]">
                {HERO.badge.sub}
              </small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
