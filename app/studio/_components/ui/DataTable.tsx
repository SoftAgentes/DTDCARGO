"use client";

/**
 * DataTable · primitivas de tabla ACCIONABLE del Studio.
 *
 * Resuelve de raíz, en un solo lugar, los hallazgos sistémicos de la
 * auditoría `/ui-pro` (2026-07-06) que se repiten en ~35 módulos:
 *
 *   🔴 Trampa de teclado (WCAG 2.1.1 · nivel A) — las filas se abrían con
 *      `<tr onClick>` sin `tabIndex` ni manejo de teclado: el detalle NO se
 *      alcanzaba sin mouse. <ActionableRow> hace la fila operable con Tab +
 *      Enter/Espacio y le da nombre accesible.
 *   🟡 Reflow (WCAG 1.4.10) — los contenedores de tabla usaban
 *      `overflow: hidden` y se recortaban a 320px. <TableFrame> le da a la
 *      tabla su PROPIO scroll horizontal (las tablas densas están exentas
 *      del reflow a 1 columna si scrollean solas).
 *   🟡 Motion hardcodeado — el hover/focus va por la clase
 *      `.studio-actionable-row` (studio.css) con `var(--dur-fast) var(--ease)`,
 *      no transiciones en px/segundos crudos.
 *
 * NO es una tabla data-driven que obligue a migrar columnas ni celdas: son
 * dos primitivas de bajo acoplamiento para adoptar módulo por módulo
 * cambiando solo el wrapper y el `<tr>`. Las celdas `<td>`, el sistema de
 * columnas configurables (useColumnConfig) y la trazabilidad visual
 * (`data-row-id` + useRowHighlight) siguen igual.
 *
 * ── Uso típico (patrón reclamos / listado con detalle) ──────────────────
 *
 *   <TableFrame>
 *     <table style={{ width: "100%", borderCollapse: "collapse" }}>
 *       <thead>…</thead>
 *       <tbody>
 *         {rows.map((c) => (
 *           <ActionableRow
 *             key={c.id}
 *             onSelect={() => onSelect(c.id)}
 *             label={`Ver reclamo ${c.claim_code}`}
 *             active={selected === c.id}
 *             data-row-id={c.claim_code}
 *             className={flashClassFor(c.claim_code)}
 *           >
 *             <td>…</td>
 *             …
 *           </ActionableRow>
 *         ))}
 *       </tbody>
 *     </table>
 *   </TableFrame>
 *
 * ── Cuándo NO usar <ActionableRow> ──────────────────────────────────────
 *   - Si la fila NAVEGA a otra ruta → usá `<a>`/`<Link>` (ya es accesible
 *     por ser ancla; ver el patrón grid-de-Links del cotizador). Reservá
 *     <ActionableRow> para filas que disparan un callback (abrir drawer,
 *     seleccionar detalle inline) dentro de un `<table>` real.
 *   - Filas puramente informativas (sin acción) → `<tr>` normal, sin esto.
 *
 * Decisión de accesibilidad: <ActionableRow> es un `<tr>` que CONSERVA su
 * rol implícito `row` (NO le ponemos `role="button"`, que rompería la
 * semántica de tabla). La operabilidad la dan `tabIndex={0}` + `onKeyDown`
 * (Enter/Espacio) + `aria-label`, que es exactamente lo que exige WCAG
 * 2.1.1. Los controles anidados (botones/links dentro de una celda) siguen
 * funcionando: el handler de fila se ignora cuando el evento nace en un
 * elemento interactivo hijo.
 */

import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  TdHTMLAttributes,
} from "react";

/** Selector de elementos interactivos anidados que NO deben disparar la fila. */
const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, [role="button"], [tabindex]';

// ─────────────────────────────────────────────────────────────────────────
// TableFrame · card con scroll horizontal propio (reflow-safe)
// ─────────────────────────────────────────────────────────────────────────

interface TableFrameProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Contenedor de tabla del Studio: borde + radio del sistema y scroll
 * horizontal PROPIO (`overflow-x: auto` + `overscroll-behavior-x: contain`).
 * Reemplaza los wrappers con `overflow: hidden` que se recortaban a 320px.
 *
 * El focus ring de <ActionableRow> usa `outline-offset: -2px` (ring por
 * dentro), así que no lo recorta el overflow del frame.
 */
export function TableFrame({ children, style, ...rest }: TableFrameProps) {
  return (
    <div
      {...rest}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflowX: "auto",
        overscrollBehaviorX: "contain",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// useActionableRow · el motor (props spreadables sobre un <tr>)
// ─────────────────────────────────────────────────────────────────────────

interface ActionableRowConfig {
  /** Callback al activar la fila (click, Enter o Espacio). */
  onSelect: () => void;
  /** Nombre accesible de la acción (ej. "Ver reclamo RC-0012"). */
  label?: string;
  /** Fila actualmente seleccionada → tinte `--wine-tint`. */
  active?: boolean;
  disabled?: boolean;
}

/**
 * Devuelve los props de accesibilidad para spreadear sobre un `<tr>` que
 * ya tiene su propio styling/clases. Útil cuando <ActionableRow> no encaja
 * (celdas con render muy custom, wrappers intermedios). El caso común usa
 * el componente <ActionableRow>.
 */
export function useActionableRow({
  onSelect,
  label,
  disabled,
}: ActionableRowConfig) {
  const fromInteractiveChild = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    const hit = target.closest(INTERACTIVE_SELECTOR);
    // El hit puede ser la fila misma (tiene tabIndex) → no cuenta como hijo.
    return hit != null && hit.getAttribute("data-actionable-row") == null;
  };

  const onClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if (disabled) return;
    if (fromInteractiveChild(e.target)) return;
    onSelect();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (disabled) return;
    // Solo cuando el foco está en la fila misma, no en un control hijo.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault(); // Espacio no debe scrollear la página.
      onSelect();
    }
  };

  return {
    "data-actionable-row": "",
    tabIndex: disabled ? undefined : 0,
    "aria-label": label,
    "aria-disabled": disabled || undefined,
    onClick,
    onKeyDown,
  } as const;
}

// ─────────────────────────────────────────────────────────────────────────
// ActionableRow · <tr> accionable (caso común)
// ─────────────────────────────────────────────────────────────────────────

interface ActionableRowProps
  extends Omit<HTMLAttributes<HTMLTableRowElement>, "onSelect"> {
  onSelect: () => void;
  label?: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

/**
 * `<tr>` accionable y accesible por teclado. Fusiona `className` con
 * `studio-actionable-row` (hover + focus-visible por tokens) y respeta el
 * `style`/`data-row-id`/flash que ya trae el caller.
 */
export function ActionableRow({
  onSelect,
  label,
  active,
  disabled,
  className,
  style,
  children,
  ...rest
}: ActionableRowProps) {
  const a11y = useActionableRow({ onSelect, label, active, disabled });
  return (
    <tr
      {...rest}
      {...a11y}
      className={`studio-actionable-row ${className ?? ""}`.trim()}
      style={{
        ...(active ? { background: "var(--wine-tint)" } : null),
        ...style,
      }}
    >
      {children}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cell · celda con target táctil mínimo (opcional, para acciones en celda)
// ─────────────────────────────────────────────────────────────────────────

interface CellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  /** Alinea a la derecha y usa `tabular-nums` (columnas numéricas). */
  numeric?: boolean;
  children?: ReactNode;
}

const CELL_BASE: CSSProperties = {
  padding: "var(--s-3) var(--s-4)",
  verticalAlign: "middle",
};

/**
 * Celda estándar del Studio con spacing por tokens (respeta density) y,
 * con `numeric`, alineación a la derecha + `tabular-nums`. Opcional: los
 * módulos pueden seguir usando `<td>` crudo; esto es azúcar para spacing
 * consistente.
 */
export function Cell({ numeric, style, children, ...rest }: CellProps) {
  return (
    <td
      {...rest}
      style={{
        ...CELL_BASE,
        ...(numeric
          ? { textAlign: "right", fontVariantNumeric: "tabular-nums" }
          : null),
        ...style,
      }}
    >
      {children}
    </td>
  );
}
