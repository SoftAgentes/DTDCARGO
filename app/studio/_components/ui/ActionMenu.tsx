"use client";

/**
 * ActionMenu — menú de acciones del Studio (SDD-0263).
 *
 * POR QUÉ EXISTE. BTN-01 v1.1 §7 dedica once reglas al comportamiento de un menú
 * de acciones y el Studio no tenía la primitiva, así que cada módulo armó la
 * suya. Medidas el 2026-08-14, de cinco implementaciones a mano sólo DOS
 * recorrían las opciones con flechas: `ExportMenu`, `VeRowActions` y
 * `ColumnConfig` abrían un popup que con teclado no se puede recorrer.
 *
 * QUÉ NO ES. No sustituye a `SplitActionButton`, que es para 2–4 resultados de la
 * MISMA familia y recuerda la última opción. Éste es para acciones DISPARES o
 * poco frecuentes, y **no memoriza nada**: BTN-01 §7 prohíbe que una opción
 * destructiva quede como default, y la forma segura de garantizarlo es no tener
 * memoria en absoluto.
 *
 * QUÉ NO RESUELVE. El menú **abre** la confirmación de una acción destructiva;
 * no la reemplaza. Quién confirma y con cuánta fricción lo decide MP-01 en el
 * consumidor.
 *
 * Estado CMP-01: `proposed`. La promoción a `canonical` exige un consumidor
 * verificado (SDD siguiente).
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

/**
 * `subscribe` inerte para `useSyncExternalStore`. Se define FUERA del componente
 * a propósito: si fuera una lambda inline, React la vería distinta en cada
 * render y re-suscribiría en cada uno.
 */
const NO_SUSCRIBE = () => () => {};
import { Icon, type IconName } from "@/app/studio/_components/icons";

/** Lo común a una opción, navegue o ejecute. */
type OpcionBase = {
  key: string;
  label: string;
  icon?: IconName;
  /**
   * Rol SEMÁNTICO, no color (BTN-01 §2). `destructive` pinta la opción en
   * `--danger`; la confirmación la decide el consumidor según MP-01.
   */
  role?: "default" | "destructive";
  disabled?: boolean;
  /**
   * BTN-01 §6: una acción deshabilitada que el usuario espera debe explicar
   * qué falta. Se muestra bajo la etiqueta, no sólo como tooltip — un botón
   * nativamente deshabilitado no siempre recibe hover ni foco.
   */
  disabledReason?: string;
  separator?: never;
};

/**
 * Una opción del menú, o un separador entre grupos.
 *
 * BTN-01 §2 separa las dos cosas y el tipo lo obliga: **`href` navega y
 * renderiza `<a>`; `onSelect` ejecuta y renderiza `<button>`**. No se pueden
 * pasar los dos. Lo destapó el primer consumidor (SDD-0266): "Posibles
 * duplicados" y "Códigos del legado" son rutas, no acciones, y meterlas como
 * `onSelect` con un `router.push` adentro habría sido un botón disfrazado de
 * enlace — justo lo que la política separa.
 */
export type ActionMenuItem =
  | (OpcionBase & { onSelect: () => void | Promise<void>; href?: never })
  | (OpcionBase & { href: string; onSelect?: never })
  | { key: string; separator: true };

type Props = {
  items: ActionMenuItem[];
  /** Texto del trigger. Sin él, el trigger es sólo icono y `ariaLabel` es obligatorio. */
  label?: string;
  /** Nombre accesible. Obligatorio cuando no hay `label` (BTN-01 §7). */
  ariaLabel?: string;
  /** Lado por el que se alinea el panel respecto del trigger. */
  align?: "start" | "end";
  size?: "sm" | "default";
  disabled?: boolean;
};

const esOpcion = (
  i: ActionMenuItem,
): i is Extract<ActionMenuItem, { onSelect: unknown }> => !("separator" in i);

export function ActionMenu({
  items,
  label,
  ariaLabel,
  align = "end",
  size = "default",
  disabled = false,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  /**
   * `createPortal` necesita `document`, que en el render del servidor no existe.
   *
   * A7 · Antes era `useState(false)` + `useEffect(() => setMontado(true), [])`.
   * Funcionaba, pero costaba un render extra en cada montaje del menú y ESLint
   * lo marcaba (`set-state-in-effect`). `useSyncExternalStore` es el patrón
   * canónico de React para "¿ya hidraté?": devuelve el snapshot del servidor
   * (`false`) durante el SSR y el del cliente (`true`) desde el primer render
   * del navegador, sin efecto y sin re-render.
   *
   * El `subscribe` no hace nada a propósito: el valor no cambia nunca después
   * de hidratar, así que no hay a qué suscribirse.
   */
  const montado = useSyncExternalStore(
    NO_SUSCRIBE,
    () => true,
    () => false,
  );
  /** "primera" | "ultima" — a dónde mandar el foco al abrir (BTN-01 §7 regla 6). */
  const [foco, setFoco] = useState<"primera" | "ultima">("primera");


  const envoltorioRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const opciones = useCallback(
    () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]:not([aria-disabled="true"])',
        ) ?? [],
      ),
    [],
  );

  const cerrarYDevolverFoco = useCallback(() => {
    setAbierto(false);
    triggerRef.current?.focus();
  }, []);

  // Clic afuera: cierra SIN ejecutar ninguna opción (BTN-01 §7). `mousedown` y no
  // `click` para que cerrar no dispare lo que hubiera debajo del panel.
  useEffect(() => {
    if (!abierto) return;
    const alClicafuera = (e: MouseEvent) => {
      // ⚠️ Con el panel en un portal, `envoltorio` ya no lo contiene: hay que
      // preguntarle también al panel o un clic DENTRO del menú lo cerraría.
      const t = e.target as Node;
      if (envoltorioRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setAbierto(false);
    };
    document.addEventListener("mousedown", alClicafuera);
    return () => document.removeEventListener("mousedown", alClicafuera);
  }, [abierto]);

  // Decidir arriba/abajo ANTES de pintar, para que el panel no salte a la vista.
  /**
   * Posición FIJA del panel, calculada desde el trigger (SDD-0275).
   *
   * Antes el panel era `position:absolute` dentro del envoltorio y confiaba en
   * `zIndex:60` para sobresalir. Eso funciona mientras ningún ancestro recorte:
   * **un `overflow:auto` o `hidden` en un ancestro recorta al hijo absoluto sin
   * importar el z-index**. Dentro de una tabla con scroll —o de un drawer— el
   * panel de las últimas filas se cortaba. No se había visto porque el único
   * consumidor verificado lo usa en la CABECERA de su módulo, fuera de la caja
   * con scroll.
   */
  const [caja, setCaja] = useState<{ top: number; left: number } | null>(null);

  const recalcular = useCallback(() => {
    const t = triggerRef.current?.getBoundingClientRect();
    const alto = panelRef.current?.offsetHeight ?? 0;
    const ancho = panelRef.current?.offsetWidth ?? 200;
    if (!t) return;
    const abajo = window.innerHeight - t.bottom;
    // El panel se voltea hacia arriba si abajo no cabe (BTN-01 §7: sin
    // clipping). La decisión NO necesita estado: viaja dentro de `caja.top`.
    const arriba = abajo < alto + 8 && t.top > abajo;
    // `end` alinea el borde derecho del panel con el del trigger.
    let left = align === "end" ? t.right - ancho : t.left;
    // Y nunca se sale de la ventana por ninguno de los dos lados.
    left = Math.max(8, Math.min(left, window.innerWidth - ancho - 8));
    setCaja({ top: arriba ? t.top - alto - 4 : t.bottom + 4, left });
  }, [align]);

  useLayoutEffect(() => {
    if (!abierto) return;
    recalcular();
  }, [abierto, items.length, recalcular]);

  // Con posición fija el panel NO sigue al trigger cuando algo scrollea, así
  // que se recalcula. `capture` para enterarse también del scroll de la caja
  // interna, que no burbujea.
  useEffect(() => {
    if (!abierto) return;
    const alMover = () => recalcular();
    window.addEventListener("scroll", alMover, true);
    window.addEventListener("resize", alMover);
    return () => {
      window.removeEventListener("scroll", alMover, true);
      window.removeEventListener("resize", alMover);
    };
  }, [abierto, recalcular]);

  // Foco de entrada: primera o última según cómo se abrió.
  useEffect(() => {
    if (!abierto) return;
    const lista = opciones();
    (foco === "ultima" ? lista[lista.length - 1] : lista[0])?.focus();
  }, [abierto, foco, opciones]);

  function abrir(desde: "primera" | "ultima") {
    if (disabled) return;
    setFoco(desde);
    setAbierto(true);
  }

  function alTecleoDelTrigger(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      abrir("primera");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      abrir("ultima");
    }
  }

  function alTecleoDelPanel(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      cerrarYDevolverFoco();
      return;
    }
    // Tab cierra pero NO secuestra el recorrido natural: sin preventDefault.
    if (e.key === "Tab") {
      setAbierto(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const lista = opciones();
    if (lista.length === 0) return;
    const actual = lista.indexOf(document.activeElement as HTMLButtonElement);
    const destino =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? lista.length - 1
          : e.key === "ArrowDown"
            ? (actual + 1 + lista.length) % lista.length
            : (actual - 1 + lista.length) % lista.length;
    lista[destino]?.focus();
  }

  const lado = size === "sm" ? 32 : 36; // BTN-01 §7: mínimo 32×32 en escritorio.
  const soloIcono = !label;

  if (soloIcono && !ariaLabel && process.env.NODE_ENV !== "production") {
    // BTN-01 §7: icon-only exige nombre accesible. Se avisa en desarrollo en vez
    // de renderizar un botón que el lector de pantalla anuncia como "botón".
    console.error(
      "ActionMenu: sin `label` el trigger es sólo icono y `ariaLabel` es obligatorio (BTN-01 §7).",
    );
  }

  const estiloTrigger: CSSProperties = {
    minWidth: soloIcono ? lado : undefined,
    height: lado,
    padding: soloIcono ? 0 : "0 10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: "var(--r-sm)",
    border: 0,
    background: abierto ? "var(--bg-elevated)" : "transparent",
    color: "var(--ink-soft)",
    font: "600 12.5px/1 var(--f-sans)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div
      ref={envoltorioRef}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={soloIcono ? ariaLabel : undefined}
        title={soloIcono ? ariaLabel : undefined}
        onClick={() => (abierto ? setAbierto(false) : abrir("primera"))}
        onKeyDown={alTecleoDelTrigger}
        style={estiloTrigger}
      >
        {label}
        {Icon.more(16)}
      </button>

      {abierto && montado && createPortal(
        <div
          ref={panelRef}
          role="menu"
          aria-label={ariaLabel ?? label}
          onKeyDown={alTecleoDelPanel}
          style={{
            position: "fixed",
            top: caja?.top ?? -9999,
            left: caja?.left ?? -9999,
            // Por encima de drawers y scrims del Studio.
            zIndex: 1000,
            minWidth: 200,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-pop)",
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {items.map((item) =>
            esOpcion(item) ? (
              <OpcionDelMenu
                key={item.key}
                item={item}
                onEjecutar={() => {
                  // Al navegar NO se devuelve el foco al trigger: la página
                  // cambia y el foco viaja con ella. Devolverlo acá pelearía
                  // con el enrutador.
                  setAbierto(false);
                  if ("href" in item && item.href) return;
                  triggerRef.current?.focus();
                  void item.onSelect?.();
                }}
              />
            ) : (
              <hr
                key={item.key}
                style={{
                  border: 0,
                  borderTop: "1px solid var(--border)",
                  margin: "4px 0",
                }}
              />
            ),
          )}
        </div>,
          document.body,
        )}
    </div>
  );
}

function OpcionDelMenu({
  item,
  onEjecutar,
}: {
  item: Exclude<ActionMenuItem, { separator: true }>;
  onEjecutar: () => void;
}) {
  const destructiva = item.role === "destructive";
  // BTN-01 §2: navega → `<a>`; ejecuta → `<button>`. La apariencia es la misma;
  // lo que cambia es lo que el navegador y el lector de pantalla entienden.
  const navega = "href" in item && !!item.href && !item.disabled;
  const Etiqueta = navega ? "a" : "button";
  const propsSegunTipo = navega
    ? { href: (item as { href: string }).href }
    : { type: "button" as const };
  return (
    <Etiqueta
      {...propsSegunTipo}
      role="menuitem"
      // `aria-disabled` y no `disabled`: un botón nativamente deshabilitado no
      // recibe foco, así que el motivo de BTN-01 §6 quedaría inalcanzable con
      // teclado. La guarda real está en el onClick.
      aria-disabled={item.disabled || undefined}
      tabIndex={-1}
      onClick={(e: React.MouseEvent) => {
        if (item.disabled) {
          e.preventDefault();
          return;
        }
        onEjecutar();
      }}
      style={{
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        width: "100%",
        minHeight: 32,
        padding: "7px 10px",
        borderRadius: "var(--r-sm)",
        border: 0,
        background: "transparent",
        textAlign: "left",
        font: "600 12.5px/1.2 var(--f-sans)",
        // `--ink-soft` y NO `--ink-mute` para el deshabilitado: medido el
        // 2026-08-14 en el navegador, `--ink-mute` da 2,78:1 en claro y 3,40:1
        // en oscuro — reprueba AA. `--ink-soft` mide 4,68:1 / 6,00:1 y sigue
        // leyéndose claramente más apagado que el `--ink` de una opción activa
        // (16,49:1), así que conserva la señal de "no disponible" sin volverse
        // ilegible. BTN-01 §6 exige que el motivo se pueda leer.
        color: item.disabled
          ? "var(--ink-soft)"
          : destructiva
            ? "var(--danger)"
            : "var(--ink)",
        cursor: item.disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
      >
        {item.icon ? Icon[item.icon](14) : null}
        {item.label}
      </span>
      {item.disabledReason && item.disabled && (
        <span
          style={{
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          {item.disabledReason}
        </span>
      )}
    </Etiqueta>
  );
}
