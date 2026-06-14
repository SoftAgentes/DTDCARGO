import { STATS } from "@/lib/design-tokens";

/**
 * Banda de stats — fondo navy, 4 KPI hero + línea de hitos históricos FIJA
 * abajo (China 2008 → empresa 2010 → Venezuela 2015). La "historia que se movía"
 * queda acá quieta; el resto del sitio habla del corredor a Venezuela (2015).
 * Valores de los KPI desde `lib/design-tokens.ts` constant `STATS`.
 */

// Hitos históricos (fijos, founder 2026-06-13): solo el arco clave; el detalle
// completo vive en /nosotros. Reemplaza el timeline que se movía en el home.
const HISTORIA = [
  { year: "2008", label: "Comercio con China" },
  { year: "2010", label: "Empresa de carga" },
  { year: "2015", label: "Operación en Venezuela" },
];

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

        {/* Hitos históricos — línea fija, letra chica (founder 2026-06-13).
            El año en wine-soft (ancla) + la etiqueta en blanco tenue; envuelve
            en móvil. Texto real (lo lee el lector de pantalla). */}
        <div className="mt-12 lg:mt-14 pt-6 border-t border-white/10">
          {/* Móvil: apila vertical (lee como secuencia/timeline, no lista suelta).
              Desktop: fila horizontal. (ajuste ui-ux 2026-06-13) */}
          <ul className="flex flex-col items-center sm:flex-row sm:flex-wrap sm:items-baseline justify-center gap-x-7 gap-y-1.5 list-none p-0 m-0">
            {HISTORIA.map((h) => (
              <li
                key={h.year}
                className="inline-flex items-baseline gap-2 text-[12.5px] leading-[1.5]"
              >
                {/* Año en Archivo regular bold (NO Black): ancla cromática wine-soft
                    pero subordinado a los KPI, que sí usan Archivo Black. */}
                <span
                  style={{
                    fontFamily: "var(--font-archivo)",
                    fontWeight: 700,
                    color: "var(--color-wine-soft)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {h.year}
                </span>
                {/* 0.62 (no 0.55) → 4.74:1 sobre navy = AA a 12.5px (ui-ux). */}
                <span style={{ color: "rgba(255,255,255,0.62)" }}>{h.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
