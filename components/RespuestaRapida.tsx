import { ConGlosario } from "@/components/TerminoGlosario";

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
  id,
  glosarioEnNuevaPestana = false,
}: {
  pregunta: string;
  respuesta: React.ReactNode;
  /** id opcional para anclar el bloque (ej. selector `speakable` del home). */
  id?: string;
  /**
   * `true` en superficies de conversión (`/tarifas`, `/fcl`): el enlace al
   * glosario abre en pestaña nueva para no borrarle al visitante lo que llevaba
   * escrito en la calculadora. Ver el docblock de `CbmAyuda`.
   */
  glosarioEnNuevaPestana?: boolean;
}) {
  return (
    <section
      id={id}
      aria-label="Respuesta rápida"
      className="bg-white border-y border-grey-200"
    >
      <div className="wrap py-8 lg:py-10">
        <span className="eyebrow">Respuesta rápida</span>
        <h2 className="mt-3 text-[19px] lg:text-[22px] font-extrabold leading-[1.25] tracking-[-0.01em] text-ink max-w-[62ch]">
          {pregunta}
        </h2>
        <p className="mt-3 text-[15px] lg:text-[15.5px] leading-[1.6] text-grey-700 max-w-[70ch]">
          {/* La jerga se enlaza al glosario sólo cuando la respuesta viene como
              texto. Si una página pasa JSX (porque necesita negritas o un
              enlace propio), se respeta tal cual: envolverlo rompería su
              marcado. */}
          {typeof respuesta === "string" ? (
            <ConGlosario nuevaPestana={glosarioEnNuevaPestana}>
              {respuesta}
            </ConGlosario>
          ) : (
            respuesta
          )}
        </p>
      </div>
    </section>
  );
}
