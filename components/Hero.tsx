import Image from "next/image";
import Link from "next/link";
import { HERO, BRAND_ASSETS } from "@/lib/design-tokens";
import { HeroCotizador } from "./HeroCotizador";

/**
 * Hero principal — kicker (tagline) + H1 de acción + cotizador inline + ilustración.
 * Copy configurable desde `lib/design-tokens.ts` constant `HERO`.
 *
 * SDD-0064 (2026-06-08): "puerta a puerta" es el protagonista; el tagline
 * pasa a kicker y el H1 es de acción ("Importa desde China hasta tu puerta").
 * DDP queda como aclaración técnica en el microcopy. Ver BRAND-EXCEPTION en HERO.
 */
export function Hero() {
  return (
    <section className="relative py-15 lg:py-[60px] lg:pb-20 overflow-hidden">
      <div className="wrap grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
        <div>
          {/* Kicker = tagline de marca: "Con Confianza," en wine + resto
              en ink (tratamiento del brand book). Sub-tagline, NO eyebrow gris. */}
          <p className="text-[15px] lg:text-[16px] font-semibold leading-tight">
            <span style={{ color: "var(--color-wine)" }}>{HERO.kicker.accent}</span>{" "}
            <span style={{ color: "var(--color-ink)" }}>{HERO.kicker.rest}</span>
          </p>

          {/* H1 de acción — "tu puerta en Venezuela" en wine (acento de marca) */}
          <h1 className="h-display mt-4 leading-[1.02]">
            <span
              className="block"
              style={{ fontSize: "clamp(34px, 4.8vw, 64px)" }}
            >
              {HERO.title.lead}
            </span>
            <span
              className="block"
              style={{
                fontSize: "clamp(34px, 4.8vw, 64px)",
                color: "var(--color-wine)",
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

          {/* Cotizador inline — abre WhatsApp con mensaje pre-rellenado (origen/destino) */}
          <HeroCotizador />

          {/* Microcopy: explica puerta a puerta y deja DDP como aclaración */}
          <p className="mt-4 text-[13px] leading-[1.5] text-grey-500 max-w-[50ch]">
            {HERO.microcopy}
          </p>

          {/* Acciones secundarias: rastrear carga + alta de cliente */}
          <p className="mt-5 text-[14px] text-grey-500">
            <Link
              href="/track"
              className="font-semibold text-wine hover:text-wine-deep underline underline-offset-2 decoration-1"
            >
              Rastrear carga
            </Link>{" "}
            ·{" "}
            ¿Vas a importar seguido?{" "}
            <Link
              href="/registro"
              className="font-semibold text-wine hover:text-wine-deep underline underline-offset-2 decoration-1"
            >
              Regístrate como cliente
            </Link>{" "}
            y obtén tu MARKBOX.
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
            aria-label="Cobertura puerta a puerta de extremo a extremo"
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
