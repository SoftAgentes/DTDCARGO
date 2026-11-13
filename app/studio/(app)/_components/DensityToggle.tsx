"use client";

/**
 * DensityToggle · SDD-0603.
 *
 * La preferencia de densidad existe desde SDD-0120, pero solo se elegía en
 * Administración › Apariencia. Este botón la deja a la vista en la barra superior.
 * Se guarda por navegador, igual que el tema; el script anti-FOUC de
 * `app/studio/layout.tsx` la vuelve a aplicar al cargar. Por defecto va compacto.
 */

import { useSyncExternalStore } from "react";
import { Icon } from "../../_components/icons";
import {
  APPEARANCE_EVENT,
  DEFAULT_DENSITY,
  applyDensity,
  readDensity,
} from "../../_components/appearance-prefs";

function suscribir(onChange: () => void): () => void {
  window.addEventListener(APPEARANCE_EVENT, onChange);
  return () => window.removeEventListener(APPEARANCE_EVENT, onChange);
}

export function DensityToggle() {
  const compacto = useSyncExternalStore(suscribir, readDensity, () => DEFAULT_DENSITY) === "compact";
  return (
    <button
      type="button"
      className="studio-densidad"
      aria-label="Compacto"
      aria-pressed={compacto}
      title={compacto ? "Volver a la vista normal" : "Ver más compacto"}
      onClick={() => applyDensity(compacto ? "normal" : "compact")}
    >
      {Icon.menu(16)}
      <span className="studio-densidad__texto">Compacto</span>
    </button>
  );
}
