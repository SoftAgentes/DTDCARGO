"use client";

/**
 * DestinoCombobox — selector de destino nacional con búsqueda (SDD-0237).
 *
 * Reemplaza el `<select>` nativo de `<CalculadoraForm>`: con 178 destinos, un
 * select nativo obliga a scrollear una lista alfabética entera para encontrar
 * "Puerto Ordaz". Acá el cliente escribe y filtra.
 *
 * Sigue el patrón de combobox de SDD-0108 (`ClientCombobox` del Studio) — mismo
 * contrato ARIA y mismo manejo de teclado — pero es un componente PROPIO del
 * sitio público: aquel importa `@/lib/studio/*` y cruzarlo rompería la frontera
 * dura público↔ERP. Las dos diferencias de fondo:
 *
 *  · **Filtra en memoria, sin debounce.** Los destinos ya vienen en el bundle
 *    (`lib/data/destinos-nacionales.ts`) o del server como prop; no hay ida y
 *    vuelta a la DB que amortiguar.
 *  · **Sólo busca por NOMBRE DE CIUDAD** (decisión del founder, 1-ago-2026).
 *    El estado se MUESTRA en cada fila para desambiguar los homónimos
 *    ("La Villa" está dos veces), pero no entra en el match.
 *
 * La búsqueda ignora acentos: "carupano" encuentra "Carúpano". En Venezuela
 * nadie escribe la tilde en un buscador.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { coberturaDestino, type Ciudad } from "@/lib/calculadora";

/** Alto estimado del listbox — decide si se abre hacia arriba o hacia abajo. */
const ESTIMATED_LISTBOX_HEIGHT = 300;
type ListboxDirection = "down" | "up";

/**
 * Normaliza para comparar: sin acentos y en minúsculas. `NFD` separa la letra
 * del acento y el rango ̀-ͯ borra los diacríticos sueltos.
 */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Marca que lleva la opción cuando el destino NO cotiza solo. Las 8 ciudades de
 * la zona sin costo NO llevan marca (founder: la lista se mancha con 8 de 178 y
 * el "incluida" ya se ve donde importa, en el desglose del precio).
 */
function badgeDeCobertura(ciudad: Ciudad): string | null {
  switch (coberturaDestino(ciudad)) {
    case "sin_cobertura":
      return "No llegamos";
    case "sin_tarifa":
      return "A medida";
    default:
      return null;
  }
}

export function DestinoCombobox({
  id,
  ciudades,
  value,
  onChange,
}: {
  /** id del input, para el `<label htmlFor>` del caller. */
  id: string;
  /** Catálogo de destinos ya combinado (DB + respaldo del código). */
  ciudades: Ciudad[];
  /** Slug del destino elegido. */
  value: string;
  onChange: (ciudadId: string) => void;
}) {
  const seleccionada = useMemo(
    () => ciudades.find((c) => c.id === value) ?? null,
    [ciudades, value],
  );
  const labelSeleccionado = seleccionada?.label ?? "";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(labelSeleccionado);
  // `dirty` = el usuario ya escribió algo desde que se abrió. Mientras sea
  // false, el input muestra la ciudad elegida pero la lista NO se filtra por
  // ese texto: abrir el selector tiene que mostrar los 178, no sólo la que ya
  // estaba puesta.
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState(-1);
  const [direction, setDirection] = useState<ListboxDirection>("down");

  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectOnMouseUpRef = useRef(false);

  // El caller puede cambiar la ciudad por fuera (o cambiar el catálogo): el
  // texto visible sigue a la selección mientras no se esté escribiendo.
  //
  // Patrón "ajustar estado durante el render" de React —sin useEffect, así no
  // hay cascada de renders—, el mismo que usa `DecimalInput` para resincronizar
  // su buffer de texto. Con el dropdown abierto NO se pisa: ahí el input es del
  // usuario, y `cerrar()` ya restaura la etiqueta al salir.
  const [lastLabel, setLastLabel] = useState(labelSeleccionado);
  if (labelSeleccionado !== lastLabel) {
    setLastLabel(labelSeleccionado);
    if (!open) setQuery(labelSeleccionado);
  }

  const opciones = useMemo(() => {
    const q = normalizar(query);
    if (!dirty || q === "") return ciudades;
    return ciudades.filter((c) => normalizar(c.label).includes(q));
  }, [ciudades, query, dirty]);

  const cerrar = useCallback(() => {
    setOpen(false);
    setDirty(false);
    setActive(-1);
    // Descartar lo tipeado: el valor real es el slug, y un texto libre a medias
    // ("puerto or") no es un destino. Siempre volvemos a mostrar el elegido.
    setQuery(labelSeleccionado);
  }, [labelSeleccionado]);

  const elegir = useCallback(
    (ciudad: Ciudad) => {
      onChange(ciudad.id);
      setOpen(false);
      setDirty(false);
      setActive(-1);
      setQuery(ciudad.label);
      inputRef.current?.focus();
    },
    [onChange],
  );

  // Click afuera cierra (y restaura el texto).
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        cerrar();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, cerrar]);

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

  useEffect(() => {
    if (!open) return;
    updateDirection();
    window.addEventListener("resize", updateDirection);
    window.addEventListener("scroll", updateDirection, true);
    return () => {
      window.removeEventListener("resize", updateDirection);
      window.removeEventListener("scroll", updateDirection, true);
    };
  }, [open, updateDirection]);

  // La opción activa tiene que quedar VISIBLE: con 178 destinos, navegar con ↓
  // sin esto mueve un resaltado que el usuario no ve.
  useEffect(() => {
    if (!open || active < 0) return;
    const el = listRef.current?.querySelector<HTMLLIElement>(
      `#${CSS.escape(`${listboxId}-opt-${active}`)}`,
    );
    // Optional call: jsdom no implementa scrollIntoView, y esto no vale romper
    // el render por un scroll.
    el?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, listboxId]);

  function abrir() {
    if (open) return;
    setOpen(true);
    setDirty(false);
    // Arrancar el resaltado en la ciudad ya elegida, no en la primera de la
    // lista: al abrir, ↓ debe moverse desde donde estás parado.
    setActive(ciudades.findIndex((c) => c.id === value));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    selectOnMouseUpRef.current = false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        abrir();
        return;
      }
      if (opciones.length === 0) return;
      setActive((i) => (i + 1) % opciones.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        abrir();
        return;
      }
      if (opciones.length === 0) return;
      setActive((i) => (i <= 0 ? opciones.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && active < opciones.length) {
        e.preventDefault();
        elegir(opciones[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        cerrar();
      }
    } else if (e.key === "Tab") {
      if (open) cerrar();
    }
  }

  const reduced = prefersReducedMotion();

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={query}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && active >= 0 ? `${listboxId}-opt-${active}` : undefined
        }
        placeholder="Escribe tu ciudad…"
        onChange={(e) => {
          selectOnMouseUpRef.current = false;
          setQuery(e.target.value);
          setDirty(true);
          setActive(0);
          if (!open) {
            setOpen(true);
          }
        }}
        onFocus={(e) => {
          abrir();
          // Seleccionar antes de la primera tecla; un frame tardío puede
          // seleccionar la búsqueda nueva y hacer que la siguiente la borre.
          e.currentTarget.select();
          selectOnMouseUpRef.current = true;
        }}
        onMouseUp={(e) => {
          if (!selectOnMouseUpRef.current) return;
          // Sólo el clic que dio foco: después se respeta el cursor manual.
          e.preventDefault();
          e.currentTarget.select();
          selectOnMouseUpRef.current = false;
        }}
        onBlur={() => {
          selectOnMouseUpRef.current = false;
        }}
        onKeyDown={handleKeyDown}
        className="w-full px-3.5 h-[52px] rounded-[12px] text-[15px] text-[var(--color-on-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-on-accent)]"
        style={{
          border: "1.5px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.04)",
        }}
      />

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Destinos en Venezuela"
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
            maxHeight: ESTIMATED_LISTBOX_HEIGHT,
            overflowY: "auto",
            background: "#16233F",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
            transition: reduced ? "none" : "opacity 0.12s ease",
          }}
        >
          {opciones.length === 0 && (
            <li
              role="presentation"
              style={{
                padding: "10px 12px",
                fontSize: 12.5,
                lineHeight: 1.45,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              No encontramos esa ciudad. Escríbele a un asesor y buscamos cómo
              hacerte llegar la carga.
            </li>
          )}

          {opciones.map((ciudad, i) => {
            const isActive = i === active;
            const badge = badgeDeCobertura(ciudad);
            return (
              <li
                key={ciudad.id}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={ciudad.id === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  // mousedown (no click) para ganarle al blur del input.
                  e.preventDefault();
                  elegir(ciudad);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: isActive ? "rgba(255,255,255,0.10)" : "transparent",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 14,
                    fontWeight: ciudad.id === value ? 700 : 500,
                    color: "#fff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ciudad.label}
                </span>
                {ciudad.estado && (
                  <span
                    style={{
                      fontSize: 11.5,
                      color: "var(--calc-ink-secondary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ciudad.estado}
                  </span>
                )}
                {badge && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      borderRadius: 6,
                      padding: "3px 6px",
                      color: "var(--color-on-accent)",
                      background: "rgba(255,255,255,0.08)",
                    }}
                  >
                    {badge}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
