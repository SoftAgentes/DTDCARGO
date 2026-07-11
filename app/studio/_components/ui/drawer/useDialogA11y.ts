"use client";

/**
 * useDialogA11y — comportamiento de accesibilidad compartido para cualquier
 * overlay `role="dialog"` del Studio (WCAG 2.1.2 + 2.4.3):
 *
 *  - Foco inicial al panel al abrir (el lector de pantalla anuncia el diálogo
 *    por su título; no dejamos el foco en "cerrar" para que Enter no cierre).
 *  - Restauración del foco al elemento previo al desmontar.
 *  - Escape para cerrar (respeta `pending`).
 *  - Focus-trap: Tab cicla dentro del panel.
 *
 * Lo usa `DrawerShell` internamente. Los overlays ricos que NO encajan en el
 * header de DrawerShell (editores con tabs, previews casi-fullscreen) lo llaman
 * directo pasando su propio ref de panel — así heredan la misma a11y sin
 * forzar su chrome dentro del shell.
 *
 * El panel debe tener `tabIndex={-1}` para poder recibir el foco inicial.
 */

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogA11y(
  panelRef: RefObject<HTMLElement | null>,
  {
    onClose,
    pending,
    initialFocusRef,
  }: {
    onClose: () => void;
    pending: boolean;
    /**
     * Elemento a enfocar al abrir en vez del panel. Útil en prompts, donde el
     * operador debe poder tipear de inmediato (ej. el input del PromptModal).
     */
    initialFocusRef?: RefObject<HTMLElement | null>;
  },
) {
  // Foco inicial + restauración al cerrar.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    (initialFocusRef?.current ?? panelRef.current)?.focus();
    return () => previouslyFocused?.focus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape para cerrar + focus-trap.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!pending) {
          e.stopPropagation();
          onClose();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === firstEl || active === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [panelRef, pending, onClose]);
}
