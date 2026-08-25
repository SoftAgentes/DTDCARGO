import { YIWU_ADVANTAGES } from "@/lib/design-tokens";

/**
 * Sección "Yiwu — Nuestra ventaja estratégica" — 6 ventajas competitivas.
 * Fuente: brochure DTD Cargo § "Yiwu: Nuestra Ventaja Estratégica".
 */
export function YiwuAdvantage() {
  return (
    <section
      className="py-20 lg:py-25 bg-ink text-white relative overflow-hidden"
      id="yiwu"
    >
      <div className="wrap relative z-10">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-10 mb-14">
          <div>
            <span
              className="eyebrow"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              义乌 · China
            </span>
            <h2
              className="mt-3"
              style={{
                fontFamily: "var(--font-archivo-black)",
                color: "white",
                fontSize: "clamp(64px, 8vw, 112px)",
                letterSpacing: "-0.04em",
                lineHeight: 0.9,
                margin: 0,
              }}
            >
              YIWU
            </h2>
            <p
              className="mt-3"
              style={{
                fontFamily: "var(--font-archivo-black)",
                color: "white",
                fontSize: "clamp(22px, 2.6vw, 34px)",
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              Nuestra base.{" "}
              <span style={{ color: "var(--color-wine-soft)" }}>
                Nuestra ventaja.
              </span>
            </p>
          </div>
          <p
            className="lead max-w-[40ch]"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            No es solo nuestra sede: es nuestro activo competitivo. Operar
            desde Yiwu —con bodega y equipo propios— nos diferencia: operamos
            directo en el origen.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-[920px]">
          {YIWU_ADVANTAGES.map((adv, i) => (
            <div
              key={adv.title}
              className="card-shadow-dark border border-white/10 rounded-[18px] p-7 lg:p-8 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-baseline gap-4 mb-4">
                {adv.definition ? (
                  <button
                    type="button"
                    className="group relative cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft rounded-md"
                    aria-label={`${adv.metric}: ${adv.definition}`}
                  >
                    <span
                      className="block text-[52px] leading-none"
                      style={{
                        fontFamily: "var(--font-archivo-black)",
                        color: "var(--color-wine-soft)",
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {adv.metric}
                    </span>
                    <span
                      role="tooltip"
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0 top-[calc(100%+12px)] w-[280px] p-3.5 rounded-[10px] bg-paper text-left opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-visible:opacity-100 group-focus-visible:visible transition-[opacity,visibility] duration-200 z-[60] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]"
                    >
                      <span className="block text-[12px] leading-[1.5] text-ink">
                        {adv.definition}
                      </span>
                      <span className="absolute left-6 -top-1.5 w-3 h-3 rotate-45 bg-paper" />
                    </span>
                  </button>
                ) : (
                  <div
                    className="text-[52px] leading-none"
                    style={{
                      fontFamily: "var(--font-archivo-black)",
                      color: "var(--color-wine-soft)",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {adv.metric}
                  </div>
                )}
                <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">
                  {adv.metricLabel}
                </div>
              </div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-white/40 mb-2">
                {String(i + 1).padStart(2, "0")} / 04
              </div>
              <h3 className="h-card mb-3">
                {adv.title}
              </h3>
              <p className="text-[14px] leading-[1.55] text-white/65">
                {adv.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
