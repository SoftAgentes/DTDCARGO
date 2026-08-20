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
 * ⚠️ **En superficies de conversión, pasá `nuevaPestana`.** La calculadora de
 * `/tarifas` es el caso: mandar al visitante al glosario en la MISMA pestaña le
 * borra lo que llevaba escrito. Es la misma razón por la que `CbmAyuda` resuelve
 * la duda del CBM en un popover y deja el enlace al detalle para el final —
 * ver su docblock. Acá se respeta esa decisión en vez de contradecirla.
 */
export function ConGlosario({
  children,
  excluir,
  nuevaPestana = false,
}: {
  /** El texto a procesar. Sólo string: si necesitás JSX, envolvé cada trozo. */
  children: string;
  /** Anclas a NO enlazar (p. ej. la propia /glosario, o una sigla ya explicada al lado). */
  excluir?: string[];
  /** `true` en superficies de conversión: abre en pestaña nueva y no pierde el formulario. */
  nuevaPestana?: boolean;
}) {
  const segmentos = partirPorTerminos(children, { excluir });

  // Sin jerga que enlazar: se devuelve el texto tal cual, sin envoltorio ni
  // nodos de más. Es el caso mayoritario y no debe costar nada.
  if (!segmentos.some((s) => s.tipo === "termino")) return <>{children}</>;

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
  nuevaPestana = false,
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
      // ensuciar lo que se ve.
      aria-label={`${valor} — ver definición en el glosario`}
      title={`${valor}: ver en el glosario`}
      {...(nuevaPestana ? { target: "_blank", rel: "noopener" } : {})}
    >
      {valor}
    </Link>
  );
}

export type { Segmento };
