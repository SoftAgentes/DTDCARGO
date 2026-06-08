/**
 * "Respuesta rápida" — bloque GEO/SEO de respuesta directa (SDD-0064 Fase 6).
 *
 * Pregunta-encabezado + respuesta concisa y citable, cerca del tope de la
 * página. Los motores de IA (y los featured snippets de Google) extraen este
 * patrón directo. Server component, texto en DOM = crawleable. Grounded en el
 * FAQ (web ↔ FAQ deben decir lo mismo) — sin datos inventados.
 */
export function RespuestaRapida({
  pregunta,
  respuesta,
}: {
  pregunta: string;
  respuesta: React.ReactNode;
}) {
  return (
    <section
      aria-label="Respuesta rápida"
      className="bg-white border-y border-grey-200"
    >
      <div className="wrap py-8 lg:py-10">
        <span className="eyebrow">Respuesta rápida</span>
        <h2 className="mt-3 text-[19px] lg:text-[22px] font-extrabold leading-[1.25] tracking-[-0.01em] text-ink max-w-[62ch]">
          {pregunta}
        </h2>
        <p className="mt-3 text-[15px] lg:text-[15.5px] leading-[1.6] text-grey-700 max-w-[70ch]">
          {respuesta}
        </p>
      </div>
    </section>
  );
}
