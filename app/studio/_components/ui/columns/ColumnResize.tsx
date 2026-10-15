"use client";

/**
 * Columnas de ancho ajustable · primitiva del Studio (SDD-0520).
 *
 * `useColumnWidths(storageKey, specs)` guarda los anchos en un solo estado: de
 * ahí sale el ÚNICO `grid-template-columns` que comparten el encabezado y las
 * filas, así que nunca se desalinean. `ColumnResizeHandle` es el asa que va en
 * el borde derecho de cada celda del encabezado.
 *
 * - Mouse/touch: arrastrar el asa (eventos pointer con captura del puntero:
 *   el arrastre sigue aunque el cursor salga del asa).
 * - Teclado: el asa es `role="separator"` enfocable; ArrowLeft/ArrowRight
 *   cambian el ancho en `COLUMN_WIDTH_STEP` px, Home lleva al mínimo y End al
 *   máximo.
 * - Doble clic en el asa: esa columna vuelve a su ancho por defecto.
 *   `resetAll()` vuelve todas (el consumidor le pone su botón «Restablecer columnas»).
 * - Una columna `grow` que absorbe el espacio libre se ajusta desde el ancho
 *   que se VE (se mide la celda), no desde su piso: así el primer arrastre o
 *   la primera flecha responden donde está el borde.
 *
 * Persistencia por navegador (`localStorage`) con la clave versionada que pase
 * el módulo. SSR-safe igual que `useColumnConfig`: el primer render usa los
 * defaults (el servidor no tiene `localStorage`) y lo guardado se lee después
 * del montaje, en un microtask cancelable; recién entonces empieza a escribir.
 * Toda lectura y escritura va en try/catch: sin almacenamiento la tabla sigue
 * con los anchos por defecto. Mientras se arrastra no se escribe en cada
 * movimiento: se escribe al soltar.
 *
 * La lógica (rango, lectura de lo guardado, reset, template) es pura y vive en
 * `column-widths.ts`.
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  NO_COLUMN_WIDTHS,
  columnGridTemplate,
  columnsTotalWidth,
  effectiveColumnWidth,
  flexColumnKey,
  isCustomized,
  isResizable,
  parseStoredColumnWidths,
  resetColumnWidth,
  serializeColumnWidths,
  setColumnWidth,
  widthForKey,
  type ColumnWidthSpec,
  type ColumnWidths,
} from "./column-widths";

export type ColumnWidthsController = {
  specs: readonly ColumnWidthSpec[];
  /** Anchos que el usuario fijó (sin entrada = default). */
  widths: ColumnWidths;
  /** `grid-template-columns` para el encabezado Y las filas. */
  template: string;
  /** Suma de anchos en uso, en px (sin gaps ni padding). */
  totalWidth: number;
  /** Columna que absorbe el espacio libre ahora, o `null`. */
  flexKey: string | null;
  /** Hay al menos una columna fijada por el usuario. */
  customized: boolean;
  /** Columna que se está arrastrando, o `null`. */
  resizing: string | null;
  widthOf: (key: string) => number;
  setWidth: (key: string, px: number) => void;
  beginResize: (key: string) => void;
  endResize: () => void;
  resetColumn: (key: string) => void;
  resetAll: () => void;
};

/** Guarda los anchos fijados (o borra la clave si no hay ninguno). Nunca lanza. */
function writeStoredWidths(
  storageKey: string,
  specs: readonly ColumnWidthSpec[],
  widths: ColumnWidths,
) {
  try {
    const value = serializeColumnWidths(widths, specs);
    if (value === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, value);
  } catch {
    /* lleno o bloqueado: los anchos viven en memoria esta sesión */
  }
}

export function useColumnWidths(
  storageKey: string,
  specs: readonly ColumnWidthSpec[],
): ColumnWidthsController {
  const [widths, setWidths] = useState<ColumnWidths>(NO_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(storageKey);
      } catch {
        /* almacenamiento bloqueado: quedan los defaults */
      }
      const parsed = parseStoredColumnWidths(raw, specs);
      // Lo corrupto o fuera de rango no sólo se ignora: se limpia.
      if (raw !== null && raw !== serializeColumnWidths(parsed, specs)) {
        writeStoredWidths(storageKey, specs, parsed);
      }
      setWidths(parsed);
      hydrated.current = true;
    });
    return () => {
      cancelled = true;
    };
    // specs es constante por módulo; storageKey identifica la tabla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated.current || resizing) return;
    writeStoredWidths(storageKey, specs, widths);
  }, [storageKey, specs, widths, resizing]);

  const specOf = (key: string) => specs.find((s) => s.key === key);

  return {
    specs,
    widths,
    template: columnGridTemplate(specs, widths),
    totalWidth: columnsTotalWidth(specs, widths),
    flexKey: flexColumnKey(specs, widths),
    customized: isCustomized(widths, specs),
    resizing,
    widthOf: (key) => {
      const spec = specOf(key);
      return spec ? effectiveColumnWidth(spec, widths) : 0;
    },
    setWidth: (key, px) => setWidths((prev) => setColumnWidth(prev, specs, key, px)),
    beginResize: (key) => setResizing(key),
    endResize: () => setResizing(null),
    resetColumn: (key) => setWidths((prev) => resetColumnWidth(prev, key)),
    resetAll: () => setWidths(NO_COLUMN_WIDTHS),
  };
}

type DragState = { pointerId: number; startX: number; startWidth: number };

const HANDLE_WIDTH = 16;

/**
 * Asa de una columna. Va dentro de la celda del encabezado, que tiene que
 * tener `position: relative`; se centra en el gap con la columna siguiente.
 */
export function ColumnResizeHandle({
  controller,
  columnKey,
  gap = 12,
  insetBlock = 0,
}: {
  controller: ColumnWidthsController;
  columnKey: string;
  /** Gap de la grilla en px: el asa se centra en él. */
  gap?: number;
  /** Cuánto se estira hacia arriba y abajo (el padding vertical del encabezado). */
  insetBlock?: number;
}) {
  const drag = useRef<DragState | null>(null);
  const spec = controller.specs.find((s) => s.key === columnKey);
  if (!spec || !isResizable(spec)) return null;
  const width = controller.widthOf(columnKey);
  const flexing = controller.flexKey === columnKey;

  // Si la columna está absorbiendo el espacio libre, lo que se ve es más que su
  // piso: el ajuste arranca desde la celda medida.
  const startWidth = (handle: HTMLElement): number => {
    if (!flexing) return width;
    const cell = handle.parentElement?.getBoundingClientRect().width ?? 0;
    return cell > 0 ? cell : width;
  };

  const finish = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* el navegador ya la soltó */
    }
    controller.endResize();
  };

  const style: CSSProperties = {
    top: -insetBlock,
    bottom: -insetBlock,
    right: -(gap / 2 + HANDLE_WIDTH / 2),
    width: HANDLE_WIDTH,
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={`Ajustar ancho de ${spec.label}`}
      aria-valuenow={width}
      aria-valuemin={spec.minWidth}
      aria-valuemax={spec.maxWidth}
      aria-valuetext={
        flexing ? `Automático, ocupa el espacio libre; mínimo ${width} px` : `${width} px`
      }
      title="Arrastra para ajustar el ancho · doble clic para restablecerlo"
      className="studio-col-resize"
      data-resizing={controller.resizing === columnKey ? "true" : undefined}
      style={style}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          /* sin captura el arrastre sigue mientras el puntero esté encima */
        }
        drag.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startWidth: startWidth(e.currentTarget),
        };
        controller.beginResize(columnKey);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.pointerId !== e.pointerId) return;
        controller.setWidth(columnKey, d.startWidth + (e.clientX - d.startX));
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      onDoubleClick={() => controller.resetColumn(columnKey)}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        const next = widthForKey(spec, startWidth(e.currentTarget), e.key);
        if (next === null) return;
        e.preventDefault();
        controller.setWidth(columnKey, next);
      }}
    />
  );
}
