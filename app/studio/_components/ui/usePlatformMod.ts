"use client";

/**
 * usePlatformMod — detección Mac vs Windows/Linux para atajos de teclado.
 *
 * Un solo lugar para la lógica que antes estaba duplicada inline en
 * StudioTopbar, ShortcutsModal y CommentsThread. En Mac mostramos los
 * símbolos (⌘ ⇧ ⌥); en Windows/Linux mostramos las palabras (Ctrl, Shift, Alt).
 *
 * Default = Windows/Linux para que SSR y el primer render client coincidan
 * (cero mismatch de hidratación + cero flash). Mac se detecta tras montar.
 */

import { useSyncExternalStore } from "react";

/** Símbolo Mac → etiqueta Windows/Linux. */
const WIN_LABEL: Record<string, string> = {
  "⌘": "Ctrl",
  "⌃": "Ctrl",
  "⇧": "Shift",
  "⌥": "Alt",
};

/** Detecta si el usuario está en Mac (client-side, tras montar). */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => /Mac|iPod|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
}

/** Traduce una tecla de un combo al idioma de la plataforma. */
export function platformKeyLabel(key: string, isMac: boolean): string {
  if (isMac) return key;
  return WIN_LABEL[key] ?? key;
}
