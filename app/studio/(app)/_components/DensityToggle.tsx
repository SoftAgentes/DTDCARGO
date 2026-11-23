"use client";

/**
 * Selector «Vista» · SDD-0688 fase 2 (§11.5), antes botón «Compacto» (SDD-0603).
 *
 * Tres vistas: Normal, Compacta (por defecto) y Súper compacta. Se guarda por
 * navegador, igual que el tema (sin migración); el script anti-FOUC de
 * `app/studio/layout.tsx` la vuelve a aplicar al cargar. Cada botón mide 32 px
 * como mínimo en cualquier vista. El nombre del archivo se conserva para no
 * mover importadores.
 */

import { useSyncExternalStore } from "react";
import {
  APPEARANCE_EVENT,
  DEFAULT_DENSITY,
  DENSITY_LABEL,
  applyDensity,
  readDensity,
  type StudioDensity,
} from "../../_components/appearance-prefs";

const VISTAS: { value: StudioDensity; corto: string }[] = [
  { value: "normal", corto: "Normal" },
  { value: "compact", corto: "Compacta" },
  { value: "ultra", corto: "Súper" },
];

function suscribir(onChange: () => void): () => void {
  window.addEventListener(APPEARANCE_EVENT, onChange);
  return () => window.removeEventListener(APPEARANCE_EVENT, onChange);
}

export function DensityToggle() {
  const actual = useSyncExternalStore(suscribir, readDensity, () => DEFAULT_DENSITY);
  return (
    <div className="studio-vista" role="group" aria-label="Vista">
      {VISTAS.map((v) => (
        <button
          key={v.value}
          type="button"
          className="studio-vista__op"
          aria-pressed={actual === v.value}
          aria-label={DENSITY_LABEL[v.value]}
          title={`Vista ${DENSITY_LABEL[v.value].toLowerCase()}`}
          onClick={() => applyDensity(v.value)}
        >
          {v.corto}
        </button>
      ))}
    </div>
  );
}
