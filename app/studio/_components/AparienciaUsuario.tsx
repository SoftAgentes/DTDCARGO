"use client";

/**
 * Vista y tema que siguen a la persona entre equipos (SDD-0714, opción B).
 *
 * - `<AparienciaUsuario guardada>` va una vez en el layout del Studio. Al montar,
 *   si la cuenta tiene algo guardado y difiere de lo local, lo aplica (y actualiza
 *   el respaldo local). Si la cuenta no tiene nada y este navegador sí tiene una
 *   elección explícita, la sube una vez. Mientras el tema sea Automático, sigue al
 *   sistema en vivo.
 * - `useApariencia()` da la vista y el tema actuales y las funciones para elegir:
 *   aplican al instante, guardan local y mandan los dos valores a la cuenta.
 *
 * Los guardados se encadenan: el último clic es el último en llegar.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { guardarAparienciaAction } from "@/app/studio/(app)/_actions/apariencia-actions";
import { useToast } from "./ui/ToastProvider";
import {
  APPEARANCE_EVENT,
  DEFAULT_DENSITY,
  DEFAULT_THEME,
  applyDensity,
  applyTheme,
  followSystemTheme,
  hasStoredAppearance,
  readDensity,
  readThemePref,
  type StudioDensity,
  type StudioThemePref,
} from "./appearance-prefs";
import type { AparienciaGuardada } from "./apariencia-usuario";

function suscribir(onChange: () => void): () => void {
  window.addEventListener(APPEARANCE_EVENT, onChange);
  return () => window.removeEventListener(APPEARANCE_EVENT, onChange);
}

let cola: Promise<unknown> = Promise.resolve();

/** Manda a la cuenta lo que hay ahora en este navegador. `false` si no se pudo. */
function guardarEnCuenta(): Promise<boolean> {
  const siguiente = cola.then(async () => {
    try {
      const r = await guardarAparienciaAction({ vista: readDensity(), tema: readThemePref() });
      return "ok" in r;
    } catch {
      return false;
    }
  });
  cola = siguiente;
  return siguiente;
}

export function AparienciaUsuario({ guardada }: { guardada: AparienciaGuardada | null }) {
  useEffect(() => {
    if (guardada) {
      if (guardada.vista !== readDensity()) applyDensity(guardada.vista);
      if (guardada.tema !== readThemePref()) applyTheme(guardada.tema);
    } else {
      const local = hasStoredAppearance();
      if (local.theme || local.density) void guardarEnCuenta();
    }
    // Solo al montar: lo que elija después la propia persona manda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => followSystemTheme(), []);

  return null;
}

export function useApariencia() {
  const toast = useToast();
  const vista = useSyncExternalStore<StudioDensity>(suscribir, readDensity, () => DEFAULT_DENSITY);
  const tema = useSyncExternalStore<StudioThemePref>(suscribir, readThemePref, () => DEFAULT_THEME);

  const avisarSiFalla = useCallback(
    (ok: boolean) => {
      if (ok) return;
      toast.show({
        eventKey: "studio:apariencia-no-guardada",
        tone: "warning",
        priority: "normal",
        scope: "system",
        dedupeKey: "studio:apariencia-no-guardada",
        message: "No se pudo guardar en tu usuario. El cambio quedó solo en este equipo.",
      });
    },
    [toast],
  );

  const elegirVista = useCallback(
    (v: StudioDensity) => {
      if (v === readDensity()) return;
      applyDensity(v);
      void guardarEnCuenta().then(avisarSiFalla);
    },
    [avisarSiFalla],
  );

  const elegirTema = useCallback(
    (t: StudioThemePref) => {
      if (t === readThemePref()) return;
      applyTheme(t);
      void guardarEnCuenta().then(avisarSiFalla);
    },
    [avisarSiFalla],
  );

  return { vista, tema, elegirVista, elegirTema };
}
