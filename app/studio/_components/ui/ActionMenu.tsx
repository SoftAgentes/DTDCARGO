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
  type CSSProperties,
} from "react";
import { Icon, type IconName } from "@/app/studio/_components/icons";

/** Una opción del menú, o un separador entre grupos. */
export type ActionMenuItem =
  | {
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
      onSelect: () => void | Promise<void>;
      separator?: never;
    }
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
  /** "primera" | "ultima" — a dónde mandar el foco al abrir (BTN-01 §7 regla 6). */
  const [foco, setFoco] = useState<"primera" | "ultima">("primera");
  /** El panel se voltea hacia arriba si abajo no cabe (BTN-01 §7: sin clipping). */
  const [haciaArriba, setHaciaArriba] = useState(false);

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
      if (!envoltorioRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", alClicafuera);
    return () => document.removeEventListener("mousedown", alClicafuera);
  }, [abierto]);

  // Decidir arriba/abajo ANTES de pintar, para que el panel no salte a la vista.
  useLayoutEffect(() => {
    if (!abierto) return;
    const caja = triggerRef.current?.getBoundingClientRect();
    const alto = panelRef.current?.offsetHeight ?? 0;
    if (!caja) return;
    const abajo = window.innerHeight - caja.bottom;
    setHaciaArriba(abajo < alto + 8 && caja.top > abajo);
  }, [abierto, items.length]);

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

      {abierto && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={ariaLabel ?? label}
          onKeyDown={alTecleoDelPanel}
          style={{
            position: "absolute",
            [haciaArriba ? "bottom" : "top"]: "calc(100% + 4px)",
            [align === "end" ? "right" : "left"]: 0,
            zIndex: 60,
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
                  setAbierto(false);
                  triggerRef.current?.focus();
                  void item.onSelect();
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
        </div>
      )}
    </div>
  );
}

function OpcionDelMenu({
  item,
  onEjecutar,
}: {
  item: Extract<ActionMenuItem, { onSelect: unknown }>;
  onEjecutar: () => void;
}) {
  const destructiva = item.role === "destructive";
  return (
    <button
      type="button"
      role="menuitem"
      // `aria-disabled` y no `disabled`: un botón nativamente deshabilitado no
      // recibe foco, así que el motivo de BTN-01 §6 quedaría inalcanzable con
      // teclado. La guarda real está en el onClick.
      aria-disabled={item.disabled || undefined}
      tabIndex={-1}
      onClick={() => {
        if (item.disabled) return;
        onEjecutar();
      }}
      style={{
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
        color: item.disabled
          ? "var(--ink-mute)"
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
            color: "var(--ink-mute)",
          }}
        >
          {item.disabledReason}
        </span>
      )}
    </button>
  );
}
