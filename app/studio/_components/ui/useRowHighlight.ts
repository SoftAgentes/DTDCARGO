"use client";

/**
 * useRowHighlight · trazabilidad visual de mutaciones (regla 1 + 2 del
 * principio "Trazabilidad visual" del Studio · ver app/studio/CLAUDE.md).
 *
 * Lee los query params `?highlight=<id>` y `?hl-tone=warm|success` del URL.
 * Devuelve una función `flashClassFor(id)` que cada row del listado consulta
 * para decidir qué clase CSS aplicar:
 *   - `""` si no hay match
 *   - `"studio-row-flash-warm"` si el tone es `warm` (creación de row nueva)
 *   - `"studio-row-flash-success"` si el tone es `success` (default · cambio
 *     de state)
 *
 * Después de `clearAfterMs` (default 4500ms · debe ser > duración de la
 * animación CSS de 4000ms para que termine bien) hace `router.replace`
 * sin los params, para que un reload no re-dispare el highlight.
 *
 * Scroll-into-view:
 *   - Si la row YA está visible en viewport (con tolerancia de top/bottom),
 *     no se hace scroll · evita movimiento jarring en listados largos.
 *   - Si NO está visible, scroll suave hacia el centro (o `instant` si el
 *     user tiene `prefers-reduced-motion: reduce`).
 *
 * Uso:
 *   const flashClassFor = useRowHighlight();
 *   {quotes.map(q => (
 *     <tr
 *       data-row-id={q.code}
 *       className={`studio-row ${flashClassFor(q.code)}`}
 *     >
 *       ...
 *     </tr>
 *   ))}
 *
 * Convención del query param `highlight`: el valor puede ser cualquier ID
 * estable de la entidad (code, slug, uuid). Cada listado decide qué usar.
 *
 * Convención del query param `hl-tone`:
 *   - omitido o `"success"` → `studio-row-flash-success` (verde, default).
 *   - `"warm"` → `studio-row-flash-warm` (amarillo, para entidades recién
 *     creadas que aparecen por primera vez en el listado).
 */

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type HighlightTone = "warm" | "success";

interface UseRowHighlightOptions {
  /** Nombre del query param que contiene el ID. Default `highlight`. */
  param?: string;
  /** Nombre del query param para tono. Default `hl-tone`. */
  toneParam?: string;
  /** Tiempo total antes de limpiar los query params. Default 4500ms. */
  clearAfterMs?: number;
  /**
   * Selector CSS del row para scroll-into-view. Por convención cada `tr`
   * o card del listado debe tener `data-row-id={id}`. Si no se quiere
   * scroll automático, pasar `null`.
   */
  scrollSelector?: string | null;
}

const VIEWPORT_TOP_MARGIN = 80;
const VIEWPORT_BOTTOM_MARGIN = 40;

function parseTone(raw: string | null): HighlightTone {
  if (raw === "warm") return "warm";
  return "success";
}

function classForTone(tone: HighlightTone): string {
  return tone === "warm"
    ? "studio-row-flash-warm"
    : "studio-row-flash-success";
}

export function useRowHighlight(options: UseRowHighlightOptions = {}) {
  const {
    param = "highlight",
    toneParam = "hl-tone",
    clearAfterMs = 4500,
    scrollSelector = "[data-row-id]",
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const highlightedId = searchParams.get(param);
  const tone = parseTone(searchParams.get(toneParam));

  const [activeId, setActiveId] = useState<string | null>(highlightedId);
  const [activeTone, setActiveTone] = useState<HighlightTone>(tone);

  useEffect(() => {
    if (!highlightedId) {
      setActiveId(null);
      return;
    }
    setActiveId(highlightedId);
    setActiveTone(tone);

    if (scrollSelector) {
      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      requestAnimationFrame(() => {
        const escapedId = CSS.escape(highlightedId);
        const el = document.querySelector(
          `${scrollSelector}[data-row-id="${escapedId}"]`,
        );
        if (!el) return;

        // Solo scrollear si la row NO está ya visible en viewport. Evita
        // movimiento jarring en listados largos cuando el operador ya
        // estaba mirando la row.
        const rect = el.getBoundingClientRect();
        const inView =
          rect.top >= VIEWPORT_TOP_MARGIN &&
          rect.bottom <= window.innerHeight - VIEWPORT_BOTTOM_MARGIN;
        if (inView) return;

        el.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "center",
        });
      });
    }

    // Limpiar query params después del flash · evita que un reload
    // re-dispare la animación.
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete(param);
      next.delete(toneParam);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      setActiveId(null);
    }, clearAfterMs);

    return () => clearTimeout(timer);
  }, [
    highlightedId,
    tone,
    param,
    toneParam,
    clearAfterMs,
    scrollSelector,
    pathname,
    router,
    searchParams,
  ]);

  /**
   * Devuelve la clase CSS de flash que corresponde a la `id` dada, o `""`
   * si la row no es la resaltada. Pensado para concatenar:
   *
   *   className={`studio-row ${flashClassFor(id)}`}
   */
  return (id: string | null | undefined): string => {
    if (!activeId || !id) return "";
    if (id !== activeId) return "";
    return classForTone(activeTone);
  };
}
