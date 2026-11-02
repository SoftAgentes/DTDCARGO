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
 *  - Foco perdido: el botón que se deshabilita durante el envío lo suelta a
 *    `body`. Tab no sale del panel y, al terminar `pending`, vuelve adentro.
 *
 * Lo usa `DrawerShell` internamente. Los overlays ricos que NO encajan en el
 * header de DrawerShell (editores con tabs, previews casi-fullscreen) lo llaman
 * directo pasando su propio ref de panel — así heredan la misma a11y sin
 * forzar su chrome dentro del shell.
 *
 * El panel debe tener `tabIndex={-1}` para poder recibir el foco inicial.
 */

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const MODAL_SELECTOR = '[role="dialog"][aria-modal="true"]';

/** Solo la capa modal superior debe manejar foco, Tab y Escape. */
function isTopmostDialog(panel: HTMLElement): boolean {
  const dialogs = document.querySelectorAll<HTMLElement>(MODAL_SELECTOR);
  return dialogs.length === 0 || dialogs.item(dialogs.length - 1) === panel;
}

/**
 * El foco no está en ningún control: quedó en `body` o, según el navegador, en
 * el control que se deshabilitó. Un control válido fuera del panel, como un menú
 * flotante en un portal, no cuenta como perdido.
 */
function isFocusLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body || active.matches(":disabled");
}

export function useDialogA11y(
  panelRef: RefObject<HTMLElement | null>,
  {
    onClose,
    pending,
    initialFocusRef,
    enabled = true,
  }: {
    onClose: () => void;
    pending: boolean;
    /**
     * SDD-0290 · `false` mientras el diálogo NO está abierto.
     *
     * Hace falta para los modales que se renderizan INLINE dentro de un
     * componente que vive siempre (`{abierto && <div role="dialog">…}`). Ahí el
     * hook se monta con el componente, no con el modal: sin esto, el efecto de
     * foco inicial corre una vez —con el panel todavía sin montar— y el
     * operador que abre el modal se queda con el foco donde estaba.
     *
     * Los modales que SON su propio componente (el caso de `DrawerShell` y de
     * casi todos los drawers) no necesitan tocarlo: montan y desmontan con el
     * diálogo, así que el default `true` ya es correcto.
     */
    enabled?: boolean;
    /**
     * Elemento a enfocar al abrir en vez del panel. Útil en prompts, donde el
     * operador debe poder tipear de inmediato (ej. el input del PromptModal).
     */
    initialFocusRef?: RefObject<HTMLElement | null>;
  },
) {
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Dónde estaba la persona, para devolverla ahí si el foco se pierde. Va antes
  // del foco inicial para contarlo: en ConfirmDialog suele ser el único.
  useEffect(() => {
    const panel = panelRef.current;
    if (!enabled || !panel) return;
    function remember(e: FocusEvent) {
      lastFocusedRef.current = e.target as HTMLElement;
    }
    panel.addEventListener("focusin", remember);
    return () => panel.removeEventListener("focusin", remember);
  }, [panelRef, enabled]);

  // Foco inicial + restauración al cerrar.
  useEffect(() => {
    if (!enabled) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel && isTopmostDialog(panel)) {
      (initialFocusRef?.current ?? panel)?.focus();
    }
    return () => previouslyFocused?.focus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Escape para cerrar + focus-trap.
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      const panel = panelRef.current;
      if (!panel || !isTopmostDialog(panel)) return;
      if (e.key === "Escape") {
        if (!pending) {
          e.stopPropagation();
          onClose();
        }
        return;
      }
      if (e.key !== "Tab") return;
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
      if (isFocusLost()) {
        e.preventDefault();
        (e.shiftKey ? lastEl : firstEl).focus();
        return;
      }
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
  }, [panelRef, pending, onClose, enabled]);

  // Al terminar el envío, el foco perdido vuelve al panel: al primer campo con
  // error (ERR-01) o a donde estaba. Si el panel enfoca su propio aviso, este
  // efecto corre antes (hijo) o ya no encuentra el foco perdido, y el aviso gana.
  useEffect(() => {
    const panel = panelRef.current;
    if (!enabled || pending || !panel || !isTopmostDialog(panel) || !isFocusLost()) return;
    const candidates = [
      panel.querySelector<HTMLElement>('[aria-invalid="true"]'),
      lastFocusedRef.current,
      panel,
    ];
    // Un candidato deshabilitado o que ya no está no recibe el foco: se pasa al siguiente.
    for (const el of candidates) {
      el?.focus();
      if (document.activeElement === el) break;
    }
  }, [panelRef, pending, enabled]);
}
