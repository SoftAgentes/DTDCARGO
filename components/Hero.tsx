import Link from "next/link";
import { HERO } from "@/lib/design-tokens";
import { ArrowIcon } from "./Icon";
import { CicloCliente } from "./CicloCliente";

/**
 * Hero principal — eyebrow + H1 (tagline-headline) + subtítulo + CTA + el
 * Ciclo del Cliente (cinta en bucle). Copy configurable desde `lib/design-tokens.ts` const `HERO`.
 *
 * Founder 2026-06-14: el H1 es el tagline-headline ("Con Confianza, desde China
 * hasta tu puerta."); se removió el kicker (repetía) y el cotizador inline (el
 * CTA primario va a /calculadora). DDP queda como aclaración en el microcopy.
 */
export function Hero() {
  return (
    <section className="relative py-15 lg:py-[60px] lg:pb-20 overflow-hidden">
      <div className="wrap grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
        <div>
          {/* Eyebrow gris: categoría + año del corredor a Venezuela (2015), no la empresa. */}
          <p className="eyebrow">{HERO.eyebrow}</p>
          {/* H1 = tagline-headline: `lead` ("Con Confianza,") en wine, resto en ink. */}
          <h1 className="h-display mt-4 leading-[1.02]">
            <span
              className="block"
              style={{
                fontSize: "clamp(34px, 4.8vw, 64px)",
                color: "var(--color-wine)",
              }}
            >
              {HERO.title.lead}
            </span>
            <span
              className="block"
              style={{
                fontSize: "clamp(34px, 4.8vw, 64px)",
                marginTop: "-0.02em",
              }}
            >
              {HERO.title.accent}
            </span>
          </h1>

          <p
            className="mt-6 mb-8 text-[17px] leading-[1.55] max-w-[52ch]"
            style={{ color: "var(--color-grey-500)" }}
          >
            {HERO.subtitle}
          </p>

          {/* CTA único → /calculadora (estimación al instante). El botón "Cotizar
              por WhatsApp" se retiró (founder 2026-06-20): la calculadora es el
              único camino primario. El botón se alarga y suma "Calculadora" como
              sub-rótulo (el destino real del CTA). */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/tarifas"
              className="btn btn-primary"
              style={{
                width: "100%",
                maxWidth: 420,
                height: 62,
                padding: "0 26px",
                flexDirection: "column",
                gap: 3,
                lineHeight: 1.1,
              }}
            >
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 16 }}
              >
                Cotizar mi envío <ArrowIcon />
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.82 }}>
                Calculadora
              </span>
            </Link>
          </div>

          {/* Microcopy: explica puerta a puerta y deja DDP como aclaración */}
          <p className="mt-4 text-[13px] leading-[1.5] text-grey-700 max-w-[50ch]">
            {HERO.microcopy}
          </p>

          {/* Acciones secundarias: rastrear carga + alta de cliente */}
          <p className="mt-5 text-[14px] text-grey-700">
            <Link
              href="/portal/login"
              className="font-semibold text-wine hover:text-wine-deep underline underline-offset-2 decoration-1"
            >
              Rastrear envío
            </Link>{" "}
            ·{" "}
            ¿Vas a importar seguido?{" "}
            <Link
              href="/registro"
              className="font-semibold text-wine hover:text-wine-deep underline underline-offset-2 decoration-1"
            >
              Regístrate como cliente
            </Link>{" "}
            y obtén tu Shipping Mark.
          </p>
        </div>

        {/* Ciclo del Cliente — cinta en bucle (reemplaza el contenedor estático +
            el badge "360°/puerta a puerta"). Handoff Norte 2026-06-13 · v3.7. */}
        <CicloCliente />
      </div>
    </section>
  );
}
