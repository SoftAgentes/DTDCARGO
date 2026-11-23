"use client";

/**
 * Vista y Tema dentro del menú del usuario (SDD-0714). Antes vivían en la barra
 * superior (`DensityToggle`, SDD-0688, y el sol/luna).
 *
 * Dos segmentados con el mismo estilo del selector de vista (`.studio-vista`):
 * cada botón mide 32 px como mínimo y el anillo de foco no se recorta. Elegir
 * aplica al instante y guarda en la cuenta (`useApariencia`).
 */

import type { RefObject } from "react";
import { useApariencia } from "../../_components/AparienciaUsuario";
import {
  DENSITY_LABEL,
  THEME_LABEL,
  type StudioDensity,
  type StudioThemePref,
} from "../../_components/appearance-prefs";

const VISTAS: StudioDensity[] = ["normal", "compact", "ultra"];
const TEMAS: StudioThemePref[] = ["light", "dark", "auto"];

function Segmentado<T extends string>({
  titulo,
  opciones,
  etiquetas,
  actual,
  onElegir,
  primerFocoRef,
}: {
  titulo: string;
  opciones: T[];
  etiquetas: Record<T, string>;
  actual: T;
  onElegir: (v: T) => void;
  primerFocoRef?: RefObject<HTMLButtonElement | null>;
}) {
  const idTitulo = `studio-menu-${titulo.toLowerCase()}`;
  return (
    <div className="studio-menu-ajuste">
      <span id={idTitulo} className="studio-menu-ajuste__titulo">
        {titulo}
      </span>
      <div className="studio-vista studio-vista--menu" role="group" aria-labelledby={idTitulo}>
        {opciones.map((v) => (
          <button
            key={v}
            ref={v === actual ? primerFocoRef : undefined}
            type="button"
            className="studio-vista__op"
            aria-pressed={actual === v}
            onClick={() => onElegir(v)}
          >
            {etiquetas[v]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AparienciaMenu({
  primerFocoRef,
}: {
  /** Recibe el botón de la vista marcada: ahí entra el foco al abrir el menú. */
  primerFocoRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { vista, tema, elegirVista, elegirTema } = useApariencia();
  return (
    <div className="studio-menu-apariencia">
      <Segmentado
        titulo="Vista"
        opciones={VISTAS}
        etiquetas={DENSITY_LABEL}
        actual={vista}
        onElegir={elegirVista}
        primerFocoRef={primerFocoRef}
      />
      <Segmentado titulo="Tema" opciones={TEMAS} etiquetas={THEME_LABEL} actual={tema} onElegir={elegirTema} />
    </div>
  );
}
