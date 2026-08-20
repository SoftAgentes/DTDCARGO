"use client";

/**
 * Búsqueda y filtros de la pestaña Personas (SDD-0274 · Slice 3).
 *
 * QUÉ ARREGLA.
 *
 * - **El buscador no declaraba su alcance.** Sólo tenía un placeholder
 *   («Buscar por nombre o email…») y BUS-01 es explícito en que el placeholder
 *   no puede ser la única declaración: desaparece al escribir. Ahora hay label
 *   visible, y el alcance CRECIÓ a cargo y rol — buscar «Contabilidad» o
 *   «Analista» antes no encontraba a nadie aunque el dato estuviera a la vista.
 * - **No había conteo de resultados.** TBL-01 lo exige. Va en un `role="status"`
 *   con `aria-live`, así que también cubre el anuncio que pide BUS-01 y el
 *   estado dinámico de A11Y-01 §5 — un solo elemento cierra las tres.
 * - **El `<select>` de rol era redundante.** El módulo mostraba las 7 tarjetas
 *   de rol con su conteo Y un select que filtraba lo mismo. Las tarjetas se
 *   fueron a su propia pestaña; el filtro por rol lo absorbe el buscador.
 *
 * POR QUÉ NO HAY `?q=` EN LA URL. El estado de los chips y la ficha abierta sí
 * viajan en la URL (se puede compartir «mírala a ella»), pero el texto buscado
 * NO: es el nombre o el correo de una persona, y meterlo en la query string lo
 * deja escrito en el historial y en los logs de cualquier proxy. El filtro se
 * comparte igual; el dato personal no.
 */

import { ACCESS_STAGE_LABELS, type AccessStage } from "@/lib/studio/user-types";

export type FiltroEtapa = AccessStage | "todos";

const CHIPS: FiltroEtapa[] = ["todos", "nunca-entro", "activo", "suspendido"];

const CHIP_LABELS: Record<FiltroEtapa, string> = {
  todos: "Todos",
  ...ACCESS_STAGE_LABELS,
};

export function ToolbarPersonas({
  busqueda,
  onBusqueda,
  etapa,
  onEtapa,
  conteos,
  mostrando,
  total,
  onLimpiar,
}: {
  busqueda: string;
  onBusqueda: (v: string) => void;
  etapa: FiltroEtapa;
  onEtapa: (e: FiltroEtapa) => void;
  /** Cuántas personas hay en cada etapa, sobre el total sin filtrar. */
  conteos: Record<FiltroEtapa, number>;
  mostrando: number;
  total: number;
  onLimpiar: () => void;
}) {
  const hayFiltro = busqueda.trim() !== "" || etapa !== "todos";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--s-4)",
        alignItems: "flex-end",
        marginBottom: "var(--s-4)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", flex: "1 1 260px" }}>
        <label htmlFor="buscar-persona" className="studio-label">
          Buscar persona
        </label>
        <input
          id="buscar-persona"
          type="search"
          className="studio-input"
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder="Nombre, correo, cargo o rol"
          aria-describedby="alcance-busqueda"
        />
        <span
          id="alcance-busqueda"
          style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}
        >
          Busca en nombre, correo, cargo y rol.
        </span>
      </div>

      <div
        role="group"
        aria-label="Filtrar por estado de acceso"
        style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}
      >
        {CHIPS.map((c) => {
          const activo = etapa === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={activo}
              onClick={() => onEtapa(c)}
              className="studio-chip"
              data-activo={activo ? "true" : undefined}
            >
              {CHIP_LABELS[c]}
              <span className="studio-chip-n">{conteos[c]}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", marginLeft: "auto" }}>
        {/* TBL-01 (conteo visible) + BUS-01 (anuncio) + A11Y-01 §5 (estado
            dinámico) en un solo elemento. */}
        <p
          role="status"
          aria-live="polite"
          style={{ font: "400 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}
        >
          {mostrando === total
            ? `${total} ${total === 1 ? "miembro" : "miembros"}`
            : `Mostrando ${mostrando} de ${total} miembros`}
        </p>
        {hayFiltro && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onLimpiar}
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
