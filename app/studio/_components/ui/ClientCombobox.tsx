"use client";

/**
 * ClientCombobox — selector de cliente cédula-first reusable (SDD-0108, Fase 3
 * de la identidad por persona · SDD-0106).
 *
 * El operador escribe cédula / nombre / Shipping Mark; el combobox busca
 * as-you-type (debounce ~300ms) contra clientes reales del tenant y al elegir
 * autocompleta el cliente. Cada opción muestra **cédula/RIF + Shipping Mark +
 * nombre** (cédula-first en la jerarquía visual, espejo de la lista de Clientes).
 *
 * Fallback manual: si el cliente aún no existe, el operador puede seguir
 * tipeando libre — `onManualChange(text)` se dispara con cada cambio del input
 * y el caller decide qué guardar. Esto NO bloquea el alta.
 *
 * Accesibilidad (combobox WAI-ARIA): navegación por teclado ↑/↓/Enter/Esc,
 * `role="combobox"` + `listbox` + `option`, `aria-activedescendant`. Respeta
 * `prefers-reduced-motion` (sin transición de apertura). Sólo tokens `var(--*)`.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  searchClientsAction,
  type ClientSearchHit,
} from "@/lib/studio/client-search-action";

interface Props {
  /** Texto visible en el input (controlado por el caller). */
  value: string;
  /** Cambio de texto libre (fallback manual · cliente que aún no existe). */
  onManualChange: (text: string) => void;
  /** Cliente elegido de la lista de coincidencias reales. */
  onSelect: (client: ClientSearchHit) => void;
  /** id del input (para el <label htmlFor>). */
  id: string;
  /** name del input (si querés que viaje en el form; normalmente el caller usa hidden). */
  name?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** aria-label si no hay <label> visible asociado. */
  ariaLabel?: string;
}

const DEBOUNCE_MS = 300;
const ESTIMATED_LISTBOX_HEIGHT = 280;
type ListboxDirection = "down" | "up";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function ClientCombobox({
  value,
  onManualChange,
  onSelect,
  id,
  name,
  placeholder = "Cédula, nombre o Shipping Mark…",
  required,
  disabled,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<ClientSearchHit[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [direction, setDirection] = useState<ListboxDirection>("down");

  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Token para descartar respuestas viejas (race entre debounces).
  const reqRef = useRef(0);

  const runSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    const myReq = ++reqRef.current;
    setLoading(true);
    const { hits: found } = await searchClientsAction(trimmed);
    if (myReq !== reqRef.current) return; // respuesta obsoleta
    setHits(found);
    setActive(found.length > 0 ? 0 : -1);
    setSearched(true);
    setLoading(false);
  }, []);

  // Debounce de la búsqueda al cambiar el value (texto del input).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      void runSearch(value);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value, open, runSearch]);

  // Click afuera cierra el dropdown.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const choose = useCallback(
    (hit: ClientSearchHit) => {
      onSelect(hit);
      setOpen(false);
      setActive(-1);
      inputRef.current?.focus();
    },
    [onSelect],
  );

  const updateDirection = useCallback(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;
    const rect = root.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setDirection(
      spaceBelow < ESTIMATED_LISTBOX_HEIGHT && spaceAbove > spaceBelow
        ? "up"
        : "down",
    );
  }, []);

  const handleChange = (text: string) => {
    onManualChange(text);
    if (!open) setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (hits.length === 0) return;
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(hits.length > 0 ? hits.length - 1 : -1);
        return;
      }
      if (hits.length === 0) return;
      setActive((i) => (i <= 0 ? hits.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && active < hits.length) {
        e.preventDefault();
        choose(hits[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  };

  // Solo mostramos el dropdown si hay algo que mostrar (buscando, lista, o
  // "sin coincidencias" tras buscar) — evita una caja vacía flotando.
  const hasContent = loading || searched || hits.length > 0;
  const showDropdown = open && value.trim().length >= 2 && hasContent;
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (!showDropdown) return;
    updateDirection();
    window.addEventListener("resize", updateDirection);
    window.addEventListener("scroll", updateDirection, true);
    return () => {
      window.removeEventListener("resize", updateDirection);
      window.removeEventListener("scroll", updateDirection, true);
    };
  }, [showDropdown, updateDirection]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        className="studio-input"
        value={value}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-activedescendant={
          showDropdown && active >= 0 ? `${listboxId}-opt-${active}` : undefined
        }
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (value.trim().length >= 2) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Clientes coincidentes"
          data-placement={direction}
          style={{
            position: "absolute",
            top: direction === "down" ? "calc(100% + 4px)" : undefined,
            bottom: direction === "up" ? "calc(100% + 4px)" : undefined,
            left: 0,
            right: 0,
            zIndex: 50,
            margin: 0,
            padding: 4,
            listStyle: "none",
            maxHeight: 280,
            overflowY: "auto",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-pop)",
            transition: reduced ? "none" : "opacity 0.12s ease",
          }}
        >
          {loading && hits.length === 0 && (
            <li
              role="presentation"
              style={{
                padding: "10px 12px",
                font: "500 12px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              Buscando…
            </li>
          )}

          {!loading && searched && hits.length === 0 && (
            <li
              role="presentation"
              style={{
                padding: "10px 12px",
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              Sin coincidencias. Sigue escribiendo y se registrará como cliente
              nuevo con estos datos.
            </li>
          )}

          {hits.map((hit, i) => {
            const isActive = i === active;
            // Espejo de la lista de Clientes (Fase 1): Shipping Mark prominente
            // primero, cédula/RIF al lado como co-identificador.
            const doc = hit.rif ?? "Sin documento";
            return (
              <li
                key={hit.id}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  // mousedown (no click) para ganarle al blur del input.
                  e.preventDefault();
                  choose(hit);
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--r-sm)",
                  cursor: "pointer",
                  background: isActive ? "var(--wine-tint)" : "transparent",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      font: "700 12.5px/1 var(--f-mono)",
                      color: isActive ? "var(--wine)" : "var(--ink)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {hit.markbox}
                  </span>
                  <span
                    style={{
                      font: "600 11px/1 var(--f-mono)",
                      color: "var(--ink-soft)",
                      letterSpacing: "0.01em",
                      paddingLeft: 8,
                      borderLeft: "1px solid var(--border)",
                    }}
                  >
                    {doc}
                  </span>
                </div>
                <span
                  style={{
                    font: "500 12px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {hit.name}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
