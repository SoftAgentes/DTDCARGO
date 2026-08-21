import Link from "next/link";
import {
  hrefGlosario,
  partirPorTerminos,
  type Segmento,
} from "@/lib/glosario-enlaces";

/**
 * `<ConGlosario>` — envuelve un texto y enlaza su jerga a `/glosario#<ancla>`.
 *
 * Idea del founder (2026-08-19): que tocar "DDP" lleve a la explicación en vez
 * de dejar al visitante con la duda. Las reglas de QUÉ se enlaza (y qué no)
 * viven en `lib/glosario-enlaces.ts`, con sus pruebas.
 *
 * Server component a propósito: no tiene estado ni handlers, así que puede
 * usarse desde cualquier página sin arrastrar JS al cliente.
 *
 * ```tsx
 * <ConGlosario>Viaja en modalidad DDP y pagas por CBM.</ConGlosario>
 * ```
 *
 * ⚠️ **Abre en pestaña nueva SIEMPRE** (regla del founder, 2026-08-20). Consultar
 * qué significa una sigla es un desvío lateral, no una navegación: quien está
 * leyendo una FAQ o llenando la calculadora quiere la definición *sin* perder
 * dónde estaba. Es la misma razón por la que `CbmAyuda` resuelve la duda del CBM
 * en un popover y deja el enlace al detalle para el final (ver su docblock).
 *
 * Por eso `nuevaPestana` viene en `true` por defecto. La prop sigue existiendo
 * para poder apagarla en un caso puntual, pero apagarla es la excepción.
 *
 * 🔴 **Y si abre pestaña nueva, hay que AVISARLO.** Un enlace que cambia de
 * contexto sin decirlo desorienta a quien usa lector de pantalla — es la falla
 * que WCAG cubre con G201. El aviso va en el `aria-label`, donde lo recibe la
 * tecnología asistiva sin ensuciar el texto que se ve.
 */
export function ConGlosario({
  children,
  excluir,
  nuevaPestana = true,
}: {
  /** El texto a procesar. Sólo string: si necesitás JSX, envolvé cada trozo. */
  children: string;
  /** Anclas a NO enlazar (p. ej. la propia /glosario, o una sigla ya explicada al lado). */
  excluir?: string[];
  /** Abre en pestaña nueva. `true` por defecto — apagarlo es la excepción. */
  nuevaPestana?: boolean;
}) {
  return (
    <SegmentosGlosario
      segmentos={partirPorTerminos(children, { excluir })}
      nuevaPestana={nuevaPestana}
    />
  );
}

/**
 * Pinta segmentos YA resueltos. Es la mitad de render de `<ConGlosario>`,
 * separada para los textos que se parten con `ambitoGlosario()` — varios
 * textos cortos que el lector ve como una sola pieza (una ficha de servicio) y
 * que por eso comparten el registro de lo ya enlazado.
 *
 * ```tsx
 * const glosar = ambitoGlosario();
 * const incluye = service.incluye.map((t) => glosar(t));
 * // …
 * {incluye.map((segs, i) => <SegmentosGlosario key={i} segmentos={segs} />)}
 * ```
 */
export function SegmentosGlosario({
  segmentos,
  nuevaPestana = true,
}: {
  segmentos: Segmento[];
  nuevaPestana?: boolean;
}) {
  // Sin jerga que enlazar: el texto tal cual, sin envoltorio ni nodos de más.
  // Es el caso mayoritario y no debe costar nada.
  if (!segmentos.some((s) => s.tipo === "termino")) {
    return <>{segmentos.map((s) => s.valor).join("")}</>;
  }

  return (
    <>
      {segmentos.map((s, i) =>
        s.tipo === "texto" ? (
          <span key={i}>{s.valor}</span>
        ) : (
          <TerminoEnlace
            key={i}
            valor={s.valor}
            ancla={s.ancla}
            nuevaPestana={nuevaPestana}
          />
        ),
      )}
    </>
  );
}

/** Un término suelto ya resuelto. Exportado por si una página quiere enlazar a mano. */
export function TerminoEnlace({
  valor,
  ancla,
  nuevaPestana = true,
}: {
  valor: string;
  ancla: string;
  nuevaPestana?: boolean;
}) {
  return (
    <Link
      href={hrefGlosario(ancla)}
      className="termino-glosario"
      // El texto del enlace es una sigla: fuera de contexto ("DDP") no dice a
      // dónde lleva. El aria-label lo completa para lector de pantalla sin
      // ensuciar lo que se ve — e incluye el aviso de que cambia de contexto
      // cuando abre pestaña nueva (WCAG G201).
      aria-label={
        nuevaPestana
          ? `${valor} — ver definición en el glosario (abre en una pestaña nueva)`
          : `${valor} — ver definición en el glosario`
      }
      title={`${valor}: ver en el glosario`}
      {...(nuevaPestana ? { target: "_blank", rel: "noopener" } : {})}
    >
      {valor}
    </Link>
  );
}

export type { Segmento };
