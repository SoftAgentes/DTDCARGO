import { Fragment, type ReactNode } from "react";

/**
 * Renderiza texto con marcado simple `<b>X</b>` como JSX puro — sin
 * `dangerouslySetInnerHTML`.
 *
 * Por qué existe: la versión anterior usaba
 * `paragraph.replace(/<b>(.*?)<\/b>/g, "<strong>$1</strong>")` + `dangerouslySetInnerHTML`.
 * Esa combinación dejaba pasar cualquier otro HTML del input (XSS latente si
 * los contenidos se reactivaran via CMS o se copy-pasteaba sin cuidado).
 *
 * Esta versión hace split sobre el patrón `<b>...</b>` y arma JSX: React
 * auto-escapa todo lo que no sea el match capturado. Imposible inyectar
 * scripts, atributos, ni otros tags.
 *
 * @example
 * renderBolded("Hola <b>mundo</b>")
 * // → <>Hola <strong className="text-ink">mundo</strong></>
 */
export function renderBolded(text: string): ReactNode {
  const parts = text.split(/<b>(.*?)<\/b>/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="text-ink">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
