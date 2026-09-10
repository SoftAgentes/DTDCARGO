"use client";

/**
 * Selector de proveedor de "Nueva compra" — combobox único del Norte: escribes,
 * filtra por nombre; si no hay match exacto aparece "Crear «X»" DENTRO del
 * propio dropdown, sin toggles aparte de "existente"/"nuevo". Al elegir "Crear"
 * se abre la ficha mínima del proveedor nuevo, que se guarda con su propia
 * server action y queda seleccionado.
 *
 * Extraído de `NewPurchaseForm` (SDD-0173) para que el formulario largo y el
 * asistente de 3 pasos compartan exactamente el mismo selector — es la parte
 * con más estado de la pantalla y no admite dos copias divergentes.
 */

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckIcon } from "@/components/Icon";
import { FieldLabel } from "../../../_components/PortalFormField";
import {
  SUPPLIER_SOURCE_ORIGINS,
  SUPPLIER_SOURCE_ORIGIN_LABEL,
  SUPPLIER_ORIGINS_NEEDING_NOTE,
  SUPPLIER_PURCHASE_HISTORIES,
  SUPPLIER_PURCHASE_HISTORY_LABEL,
  SUPPLIER_COMM_METHODS,
  SUPPLIER_COMM_METHOD_LABEL,
  type SupplierSourceOrigin,
  type SupplierPurchaseHistory,
  type SupplierCommMethod,
  type SupplierView,
  type SupplierActionState,
} from "@/lib/studio/prealertas/types";
import { createSupplierAction } from "../../proveedores/actions";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";

const supplierInitial: SupplierActionState = {};

/**
 * Un ÚNICO criterio de "se llama igual". Antes convivían dos copias inline del
 * mismo `trim().toLowerCase()` y era cuestión de tiempo que divergieran.
 */
const normName = (v: string) => v.trim().toLowerCase();

/**
 * Arma el FormData del alta de proveedor leyendo los `input[name]` de la ficha.
 *
 * ¿Por qué a mano y no con `new FormData(form)`? Porque la ficha NO puede ser un
 * `<form>`: en el asistente quedaría anidada dentro del `<form>` del paso 1, y
 * eso —además de ser HTML inválido— **rompe la acción por completo**. Medido en
 * el navegador el 2026-08-27: con la ficha anidada React nunca despacha
 * `createSupplierAction` (deja que el navegador navegue a su URL centinela, que
 * la CSP bloquea), así que "Guardar proveedor" no hacía absolutamente nada y el
 * proveedor nuevo no se creaba jamás. El mismo selector fuera de un `<form>` sí
 * dispara la acción — ésa fue la prueba de control.
 *
 * Los radios sin marcar se omiten, igual que haría el navegador.
 */
function collectSupplierForm(root: HTMLElement | null, name: string): FormData {
  const fd = new FormData();
  fd.set("name", name);
  root?.querySelectorAll<HTMLInputElement>("input[name]").forEach((el) => {
    if (el.name === "name") return;
    if ((el.type === "radio" || el.type === "checkbox") && !el.checked) return;
    fd.append(el.name, el.value);
  });
  return fd;
}

/** Píldora seleccionable — el "chip" del Norte, como radio accesible. */
function Chip({
  name,
  value,
  label,
  checked,
  onSelect,
  disabled,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border cursor-pointer text-[12.5px] font-bold transition-colors"
      style={{
        borderColor: checked ? "var(--color-wine)" : "var(--color-grey-200)",
        background: checked ? "var(--color-paper)" : "transparent",
        color: checked ? "var(--color-wine-text)" : "var(--color-grey-700)",
      }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        disabled={disabled}
        className="sr-only"
      />
      {/* El tilde no es decoración: sin él, "elegido" se distinguiría SÓLO por
          color, que es lo que prohíbe WCAG 1.4.1. */}
      {checked && <CheckIcon size={11} />}
      {label}
    </label>
  );
}

/**
 * Ficha extendida del proveedor nuevo (SDD-0173 · migr 0266).
 *
 * Las 3 preguntas del Norte. El copy las encuadra como lo que son: datos DEL
 * CLIENTE para su propio control, no un trámite para DTD. Todas opcionales —
 * en el Norte eran obligatorias, pero acá bloquear el alta por "¿de dónde lo
 * sacaste?" costaría compras; la respuesta se pide, no se exige.
 */
function SupplierProfileFields({ disabled }: { disabled?: boolean }) {
  const uid = useId();
  const [origin, setOrigin] = useState<SupplierSourceOrigin | "">("");
  const [history, setHistory] = useState<SupplierPurchaseHistory | "">("");
  const [comm, setComm] = useState<SupplierCommMethod | "">("");
  const needsNote =
    origin !== "" && SUPPLIER_ORIGINS_NEEDING_NOTE.includes(origin);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-[11.5px] text-grey-700 leading-[1.5] m-0">
        Lo de abajo es para <strong className="text-ink">tu control</strong>: te
        ayuda a reconocer a este proveedor cuando tengas varios. Todo opcional.
      </p>

      <div>
        <FieldLabel htmlFor={`${uid}-industry`}>¿Qué vende?</FieldLabel>
        <input
          id={`${uid}-industry`}
          type="text"
          name="industry"
          disabled={disabled}
          placeholder="Ej. calzado deportivo, iluminación LED…"
          className="mt-1.5 w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
        />
      </div>

      <div>
        <FieldLabel>¿De dónde lo sacaste?</FieldLabel>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {SUPPLIER_SOURCE_ORIGINS.map((o) => (
            <Chip
              key={o}
              name="sourceOrigin"
              value={o}
              label={SUPPLIER_SOURCE_ORIGIN_LABEL[o]}
              checked={origin === o}
              onSelect={() => setOrigin(o)}
              disabled={disabled}
            />
          ))}
        </div>
        {needsNote && (
          <input
            type="text"
            name="sourceOriginNote"
            disabled={disabled}
            placeholder={
              origin === "recomendado"
                ? "¿Quién te lo recomendó?"
                : "¿Dónde lo encontraste?"
            }
            className="mt-2 w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
          />
        )}
      </div>

      <div>
        <FieldLabel>¿Ya le habías comprado?</FieldLabel>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {SUPPLIER_PURCHASE_HISTORIES.map((h) => (
            <Chip
              key={h}
              name="purchaseHistory"
              value={h}
              label={SUPPLIER_PURCHASE_HISTORY_LABEL[h]}
              checked={history === h}
              onSelect={() => setHistory(h)}
              disabled={disabled}
            />
          ))}
        </div>
      </div>

      {history !== "" && (
        <div>
          <FieldLabel>¿Por dónde hablas con él hoy?</FieldLabel>
          <p className="mt-1 text-[11px] text-grey-700 leading-[1.45]">
            Ayuda a tu proveedor a entender con qué cliente y por qué canal está
            hablando.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SUPPLIER_COMM_METHODS.map((c) => (
              <Chip
                key={c}
                name="commMethod"
                value={c}
                label={SUPPLIER_COMM_METHOD_LABEL[c]}
                checked={comm === c}
                onSelect={() => setComm(c)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SupplierPicker({
  suppliers,
  preselected,
  supplierId,
  onSelect,
  showProfile = false,
  onDraftSupplierChange,
}: {
  suppliers: SupplierView[];
  preselected: SupplierView | null;
  supplierId: string;
  onSelect: (id: string) => void;
  /**
   * ¿Pedir la ficha extendida del Norte al crear un proveedor? (SDD-0173).
   *
   * Es una PROP y no un flag global a propósito: la ficha se diseñó para el
   * paso 1 del asistente, y el formulario largo al que reemplaza tiene los días
   * contados. Con un flag aparte, prenderlo antes que el asistente le habría
   * cambiado el alta de proveedor a TODO cliente en un formulario que se va a
   * borrar. Así la ficha no puede existir fuera del asistente aunque alguien se
   * distraiga: viaja con él, sin un segundo interruptor que coordinar.
   */
  showProfile?: boolean;
  /**
   * Avisa al padre que hay una ficha de proveedor nuevo abierta (su nombre) o
   * que se cerró (`null`) — el `isNew` del Norte (`app.jsx:3372`).
   *
   * OPCIONAL a propósito: `NewPurchaseForm` es el segundo consumidor de este
   * selector y no tiene panel lateral que actualizar.
   */
  onDraftSupplierChange?: (name: string | null) => void;
}) {
  const [newSupplierName, setNewSupplierName] = useState<string | null>(null);
  const [supplierQuery, setSupplierQuery] = useState(preselected?.name ?? "");
  const [supplierOpen, setSupplierOpen] = useState(false);
  /**
   * Opción resaltada por teclado (A11Y-01 · patrón APG combobox). -1 = ninguna.
   * El foco NUNCA sale del input: la opción activa se comunica por
   * `aria-activedescendant`, que es lo que el lector de pantalla anuncia.
   */
  const [activeIdx, setActiveIdx] = useState(-1);
  const uid = useId();
  const inputId = `${uid}-proveedor`;
  const listboxId = `${uid}-listbox`;
  const optionId = (i: number) => `${uid}-opt-${i}`;
  const [newSupplierState, newSupplierAction, newSupplierPending] =
    useActionState(createSupplierAction, supplierInitial);
  const newFormRef = useRef<HTMLDivElement>(null);

  /**
   * Abre/cierra la ficha del proveedor nuevo Y le avisa al padre. Todo cambio
   * de `newSupplierName` pasa por acá: si alguno se escapara, el pie del botón
   * "Registrar compra" quedaría diciendo lo que NO falta.
   */
  const setDraft = useCallback(
    (name: string | null) => {
      setNewSupplierName(name);
      onDraftSupplierChange?.(name);
    },
    [onDraftSupplierChange],
  );

  const filteredSuppliers = useMemo(() => {
    const q = normName(supplierQuery);
    if (!q) return suppliers;
    return suppliers.filter((s) => normName(s.name).includes(q));
  }, [suppliers, supplierQuery]);

  /**
   * El proveedor que se llama EXACTAMENTE como lo escrito — el `existingSel`
   * del Norte (`_norte/portal/app.jsx:3371`). Es la pieza que faltaba: allá
   * escribir el nombre completo YA elige, acá además exigíamos un clic en la
   * lista y el cliente se quedaba con el botón muerto sin saber por qué.
   */
  const exactSupplier = useMemo(() => {
    const q = normName(supplierQuery);
    if (!q) return null;
    return suppliers.find((s) => normName(s.name) === q) ?? null;
  }, [suppliers, supplierQuery]);

  // Sin match exacto por nombre → el dropdown ofrece "Crear «X»".
  const hasExactMatch = supplierQuery.trim() === "" || exactSupplier !== null;

  /**
   * Las opciones del desplegable como UNA lista, incluida "Crear «X»".
   * Unificarlas no es cosmético: es lo que permite que ↑/↓ recorran también la
   * opción de crear, y que `aria-activedescendant` apunte siempre a algo real.
   */
  const opciones = useMemo(() => {
    const items: (
      | { kind: "supplier"; supplier: SupplierView }
      | { kind: "create"; name: string }
    )[] = filteredSuppliers.map((s) => ({ kind: "supplier", supplier: s }));
    const q = supplierQuery.trim();
    if (q !== "" && !hasExactMatch) items.push({ kind: "create", name: q });
    return items;
  }, [filteredSuppliers, supplierQuery, hasExactMatch]);

  const selected = useMemo(
    () => suppliers.find((s) => s.id === supplierId) ?? null,
    [suppliers, supplierId],
  );

  /**
   * Atajos (Norte, `chipList`): con un proveedor ya elegido se muestran TODOS
   * los demás — el elegido llenó el buscador, y filtrar por ese texto dejaría la
   * fila vacía justo cuando el cliente podría querer cambiar. Sin selección, se
   * filtran por lo que va escribiendo.
   */
  const chipSuppliers = useMemo(
    () =>
      (supplierId
        ? suppliers.filter((s) => s.id !== supplierId)
        : filteredSuppliers
      ).slice(0, 6),
    [suppliers, filteredSuppliers, supplierId],
  );

  // Si el alta inline del proveedor nuevo termina OK, lo dejamos elegido — la
  // página revalidó, pero el id nuevo lo conocemos por el state.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && newSupplierState.ok && newSupplierState.supplierId) {
        onSelect(newSupplierState.supplierId);
        setDraft(null);
      }
    });
    return () => {
      cancelled = true;
    };
    // `onSelect` es estable en los dos callers (setState / setter propio).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSupplierState.ok, newSupplierState.supplierId]);

  /** Elegir un proveedor existente: cierra, llena el buscador y avisa arriba. */
  const elegir = (s: SupplierView) => {
    onSelect(s.id);
    setDraft(null);
    setSupplierQuery(s.name);
    setSupplierOpen(false);
    setActiveIdx(-1);
  };

  /** Abrir la ficha de alta para un nombre nuevo. */
  const crear = (name: string) => {
    setDraft(name);
    onSelect("");
    setSupplierOpen(false);
    setActiveIdx(-1);
  };

  /** Activar la opción i-ésima (sirve igual para clic y para Enter). */
  const activar = (i: number) => {
    const o = opciones[i];
    if (!o) return;
    if (o.kind === "supplier") elegir(o.supplier);
    else crear(o.name);
  };

  const listaVisible =
    supplierOpen && (supplierQuery.trim() !== "" || filteredSuppliers.length > 0);

  return (
    <>
      <FieldLabel htmlFor={inputId}>Proveedor</FieldLabel>
      {/* El blur se mira a nivel de CONTENEDOR y con `relatedTarget`: el
          `setTimeout(120)` de antes era una carrera, y con teclado cerraba la
          lista antes de que se pudiera activar nada. */}
      <div
        className="relative mt-1.5"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setSupplierOpen(false);
            setActiveIdx(-1);
          }
        }}
      >
        <input
          id={inputId}
          type="text"
          value={supplierQuery}
          role="combobox"
          aria-expanded={listaVisible}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            listaVisible && activeIdx >= 0 ? optionId(activeIdx) : undefined
          }
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value;
            setSupplierQuery(v);
            // Norte `existingSel` (app.jsx:3371): escribir el nombre COMPLETO ya
            // elige. Antes acá iba `onSelect("")` a secas, así que el cliente
            // escribía su proveedor entero y el botón seguía apagado.
            const q = normName(v);
            const exact = q
              ? (suppliers.find((s) => normName(s.name) === q) ?? null)
              : null;
            onSelect(exact ? exact.id : "");
            setDraft(null);
            setSupplierOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => setSupplierOpen(true)}
          onKeyDown={(e) => {
            // ── Teclado del patrón APG. Antes SÓLO se manejaba Enter, así que
            //    quien no usa ratón no podía elegir de la lista y el botón
            //    "Registrar compra" no se le habilitaba nunca (A11Y-01).
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!opciones.length) return;
              setSupplierOpen(true);
              setActiveIdx((prev) => {
                const paso = e.key === "ArrowDown" ? 1 : -1;
                const base = prev < 0 ? (paso === 1 ? -1 : 0) : prev;
                return (base + paso + opciones.length) % opciones.length;
              });
              return;
            }
            if (e.key === "Home" && listaVisible && opciones.length) {
              e.preventDefault();
              setActiveIdx(0);
              return;
            }
            if (e.key === "End" && listaVisible && opciones.length) {
              e.preventDefault();
              setActiveIdx(opciones.length - 1);
              return;
            }
            if (e.key === "Escape") {
              if (!listaVisible) return;
              e.preventDefault();
              setSupplierOpen(false);
              setActiveIdx(-1);
              return;
            }
            if (e.key !== "Enter") return;
            e.preventDefault();
            // Hay una opción resaltada → manda ella, sin adivinar.
            if (listaVisible && activeIdx >= 0) {
              activar(activeIdx);
              return;
            }
            const q = supplierQuery.trim();
            if (!q) return;
            // 1. Nombre exacto: gana aunque el filtro devuelva varios. Antes
            //    "Yiwu" existiendo también "Yiwu Trading" no ejecutaba NINGUNA
            //    rama — Enter no hacía absolutamente nada.
            if (exactSupplier) {
              elegir(exactSupplier);
              return;
            }
            // 2. Una sola coincidencia parcial → se elige sola.
            if (filteredSuppliers.length === 1) {
              elegir(filteredSuppliers[0]);
              return;
            }
            // 3. Ninguna coincidencia → se ofrece crearlo.
            if (filteredSuppliers.length === 0) {
              crear(q);
              return;
            }
            // 4. Varias parciales sin exacto: NO se crea un duplicado a ciegas
            //    teniendo los candidatos a la vista — se deja la lista abierta
            //    y se resalta la primera para que ↓/Enter la puedan tomar.
            setSupplierOpen(true);
            setActiveIdx(0);
          }}
          placeholder="Escribe para buscar tu proveedor…"
          /* Sin `aria-label`: el nombre accesible sale del <label> "Proveedor"
             y así coincide con la etiqueta VISIBLE (WCAG 2.5.3 · Label in
             Name). Las instrucciones de teclado van por `aria-describedby`,
             que es su lugar — un nombre no se usa para explicar. */
          aria-describedby={`${uid}-ayuda-teclado`}
          className="w-full h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
        />
        <span id={`${uid}-ayuda-teclado`} className="sr-only">
          Escribe para buscar. Usa las flechas arriba y abajo para recorrer la
          lista y Enter para elegir. Si no existe, la última opción lo crea.
        </span>
        {listaVisible && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Proveedores"
            className="absolute top-full left-0 right-0 z-20 mt-1 max-h-[240px] overflow-y-auto rounded-[10px] border border-grey-200 bg-white card-shadow list-none m-0 p-0"
          >
            {opciones.map((o, i) => {
              const activa = i === activeIdx;
              const esCrear = o.kind === "create";
              const seleccionada =
                o.kind === "supplier" && o.supplier.id === supplierId;
              return (
                <li
                  key={o.kind === "supplier" ? o.supplier.id : "__crear__"}
                  id={optionId(i)}
                  role="option"
                  aria-selected={seleccionada}
                  /* `onMouseDown` conserva el clic sin que el input pierda el
                     foco antes de tiempo; con ratón ya funcionaba así. */
                  onMouseDown={(e) => {
                    e.preventDefault();
                    activar(i);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 cursor-pointer border-b border-grey-100 last:border-b-0 ${
                    esCrear ? "text-[13.5px] font-bold" : "text-[14px] text-ink"
                  }`}
                  style={{
                    background: activa
                      ? "var(--color-grey-100)"
                      : esCrear
                        ? "var(--color-paper)"
                        : undefined,
                    color: esCrear ? "var(--color-wine-text)" : undefined,
                  }}
                >
                  {/* La opción activa no se distingue SÓLO por color (WCAG
                      1.4.1): lleva además un cursor visible. */}
                  <span
                    aria-hidden
                    className="w-2 flex-shrink-0 text-[11px] leading-none"
                  >
                    {activa ? "▸" : ""}
                  </span>
                  {o.kind === "supplier" ? (
                    <span>
                      <span className="font-bold">
                        #{o.supplier.supplierSeq}
                      </span>{" "}
                      {o.supplier.name}
                    </span>
                  ) : (
                    <span>+ Crear &ldquo;{o.name}&rdquo;</span>
                  )}
                </li>
              );
            })}
            {opciones.length === 0 && (
              <li className="px-3.5 py-2.5 text-[13px] text-grey-700">
                Escribe el nombre de tu proveedor.
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Escribiste algo pero no hay proveedor elegido. Va PEGADO al campo, no
          abajo con el botón: en móvil el botón queda a ~2.400 px de acá y el
          cliente no puede relacionar el aviso con el control que lo produce.

          Es un <p> y NO un PortalFieldError a propósito: ese componente trae
          `role="alert"` fijo, y montarlo mientras se teclea dispararía una
          alerta del lector de pantalla en CADA tecla, además de pintar de rojo
          algo que es guía, no error. */}
      {newSupplierName === null &&
        !supplierId &&
        supplierQuery.trim() !== "" && (
          <p className="mt-2 text-[11.5px] text-grey-700 leading-[1.5] m-0">
            Escribiste{" "}
            <strong className="text-ink">{supplierQuery.trim()}</strong>, pero
            todavía no lo eliges.{" "}
            {filteredSuppliers.length === 0
              ? "No tienes ninguno con ese nombre: créalo desde el buscador."
              : "Tócalo en la lista para elegirlo."}
          </p>
        )}

      {/* Atajos a los proveedores de siempre. Al Norte le importan porque la
          re-compra al MISMO proveedor es el caso normal: verlos ahí ahorra
          escribir. Se ocultan los ya elegidos. */}
      {newSupplierName === null && chipSuppliers.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {chipSuppliers.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onSelect(s.id);
                setSupplierQuery(s.name);
                setSupplierOpen(false);
              }}
              className="inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-grey-200 text-[12px] font-bold text-ink hover:bg-grey-100 transition-colors"
            >
              <span
                className="grid place-items-center rounded-[6px] text-[10px] font-bold"
                style={{
                  width: 20,
                  height: 20,
                  background: "var(--color-paper)",
                  color: "var(--color-wine-text)",
                }}
              >
                #{s.supplierSeq}
              </span>
              {s.name}
              <span className="font-medium text-grey-700">
                · {s.orderCount} compra{s.orderCount === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>
      )}

      {newSupplierName === null && selected && (
        <div
          className="mt-3 flex items-center gap-3 rounded-[10px] p-3 border"
          style={{
            borderColor: "var(--color-status-success)",
            background: "var(--color-paper)",
          }}
        >
          <span
            className="flex-shrink-0"
            style={{ color: "var(--color-status-success)" }}
          >
            <CheckIcon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-ink truncate">
              {selected.name}
            </div>
            <div className="mt-0.5 text-[11.5px] text-grey-700">
              Proveedor seleccionado
              {selected.orderCount > 0
                ? ` · ${selected.orderCount} compra${selected.orderCount === 1 ? "" : "s"} anterior${selected.orderCount === 1 ? "" : "es"}`
                : " · primera compra"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelect("");
              setSupplierQuery("");
              setSupplierOpen(true);
            }}
            className="btn btn-ghost min-h-12 shrink-0 whitespace-normal text-xs font-semibold"
            style={{ color: "var(--color-wine-text)" }}
          >
            Cambiar proveedor
          </button>
        </div>
      )}

      {newSupplierName !== null && (
        <div
          ref={newFormRef}
          className="mt-3 rounded-[12px] p-4 border"
          style={{
            background: "var(--color-paper)",
            borderColor: "var(--color-wine)",
          }}
        >
          {/* `text-wine-text` crudo mide 3.70:1 en el portal oscuro (medido): el wine
              como TEXTO va por --color-wine-text, que sí alcanza en ambos temas. */}
          <p
            className="text-[10px] font-bold tracking-[0.08em] uppercase"
            style={{ color: "var(--color-wine-text)" }}
          >
            Datos del proveedor nuevo
          </p>
          <p className="mt-1.5 text-[13px] font-semibold text-ink">
            + Se creará &ldquo;{newSupplierName}&rdquo;
          </p>
          {newSupplierState.fieldErrors?.name && (
            <PortalFieldError>{newSupplierState.fieldErrors.name}</PortalFieldError>
          )}

          {showProfile && <SupplierProfileFields disabled={newSupplierPending} />}

          {/* Sin esto, las 5 rutas de fallo de `createSupplierAction` que
              devuelven `{ error }` sin `fieldErrors` eran INVISIBLES: el botón
              pasaba por "Guardando…", volvía a su sitio y la pantalla quedaba
              idéntica. El cliente sólo veía que "Registrar compra" seguía
              apagado. Va acá abajo —y no junto al nombre— porque con la ficha
              extendida abierta el mensaje quedaría fuera de la vista. */}
          {newSupplierState.error && (
            <PortalFieldError nivel="formulario">
              {newSupplierState.error}
            </PortalFieldError>
          )}

          <div className="mt-3 flex gap-2">
            {/* `type="button"` + despacho explícito: un `type="submit"` acá
                enviaría el formulario del paso 1 (el del asistente), porque la
                ficha ya no es un `<form>` propio. */}
            <button
              type="button"
              onClick={() =>
                startTransition(() =>
                  newSupplierAction(
                    collectSupplierForm(newFormRef.current, newSupplierName),
                  ),
                )
              }
              disabled={newSupplierPending}
              aria-busy={newSupplierPending}
              className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            >
              {newSupplierPending ? "Guardando…" : "Guardar proveedor"}
              {!newSupplierPending && <CheckIcon size={14} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setSupplierOpen(true);
              }}
              disabled={newSupplierPending}
              className="btn btn-ghost disabled:opacity-60"
            >
              Cambiar proveedor
            </button>
          </div>
        </div>
      )}
    </>
  );
}
