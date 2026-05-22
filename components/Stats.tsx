import { STATS } from "@/lib/design-tokens";

/**
 * Banda de stats — fondo navy, 4 KPI hero.
 * Valores configurables desde `lib/design-tokens.ts` constant `STATS`.
 * Estructura visual portada del Brand Book DTD § Stats.
 */
export function Stats() {
  return (
    <section className="bg-ink text-white py-20" id="cobertura">
      <div className="wrap">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-12 lg:gap-x-8">
          {STATS.map((s) => (
            <div key={s.num + s.suffix} className="min-w-0">
              <div
                className="text-white leading-none tracking-[-0.03em] flex items-baseline flex-wrap"
                style={{
                  fontFamily: "var(--font-archivo-black)",
                  fontSize: "clamp(44px, 5.5vw, 76px)",
                }}
              >
                <span>{s.num}</span>
                <span
                  style={{
                    color: "var(--color-wine-soft)",
                    fontSize: "0.5em",
                    marginLeft: "0.18em",
                    letterSpacing: "0.01em",
                  }}
                >
                  {s.suffix}
                </span>
              </div>
              <div
                className="mt-3 text-[13.5px] leading-[1.4] tracking-[0.06em] uppercase"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
