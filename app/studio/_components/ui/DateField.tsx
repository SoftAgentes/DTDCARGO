"use client";

/**
 * <DateField> · Campo de fecha (o de mes) del Studio · SDD-0660.
 *
 * Un solo estándar para todo el ERP, en lugar de `<input type="date">`,
 * `type="month"` y `type="datetime-local"`, que en cada navegador se ven
 * distinto (en Chrome, el de mes pinta «---------- de ----»).
 *
 *   - El formato `dd/mm/aaaa` (meses: `mm/aaaa`) se ve en gris de fondo y se va
 *     llenando mientras se escribe.
 *   - Se escriben los números seguidos (`18112026` → `18/11/2026`): las barras
 *     se ponen solas.
 *   - El calendario se abre con el botón del campo o con Alt+↓. El doble clic
 *     NO lo abre: queda para seleccionar el texto, como en cualquier campo.
 *   - Atajos: T (o H) = hoy; + y − = un día más o menos (en meses, un mes).
 *   - Escribir y elegir en el calendario muestran el mismo valor.
 *
 * El valor que viaja en el formulario es ISO (`AAAA-MM-DD`; meses `AAAA-MM`)
 * en un `<input type="hidden" name=…>`, igual que antes: los validadores y las
 * server actions no cambian. `onChange` entrega el ISO de una fecha válida, ""
 * al vaciar el campo o al completar una fecha imposible, y nada mientras se
 * está escribiendo (a medio escribir no hay aviso por tecla).
 *
 * `form.reset()` lo devuelve a `defaultValue`, como a un campo nativo.
 *
 * Una fecha imposible (31/02) no se corrige sola (DAT-01): queda escrita,
 * se explica el error y el formulario no se envía.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  DATE_TEMPLATE,
  MONTH_NAMES,
  addDays,
  addMonths,
  addMonthsToDate,
  caretAfterDigits,
  clampIso,
  countDigits,
  daysInMonth,
  isoToDisplay,
  normalizeIso,
  normalizePasted,
  normalizeTyped,
  parseDisplay,
  spokenDate,
  todayIso,
  type DateMode,
} from "@/lib/studio/util/date-mask";

export interface DateFieldProps {
  /** `date` (día, por defecto) o `month` (mes y año). */
  mode?: DateMode;
  /** `name` del campo oculto que lleva el ISO al formulario. */
  name?: string;
  id?: string;
  /** Valor controlado en ISO (`AAAA-MM-DD` / `AAAA-MM`) o "". */
  value?: string | null;
  /** Valor inicial en ISO (no controlado). Acepta un ISO con hora detrás. */
  defaultValue?: string | null;
  /**
   * ISO de la fecha válida, o "" si se vació o la fecha completa es imposible.
   * Mientras está incompleta no avisa: el padre conserva el último valor.
   */
  onChange?: (iso: string) => void;
  /**
   * Si lo escrito sirve: fecha válida, o vacío cuando no es `required`. Para
   * formularios por pasos que validan antes de desmontar el campo.
   */
  onValidityChange?: (valid: boolean) => void;
  onBlur?: () => void;
  /** Límites en ISO; se aplican al escribir, al usar + y − y en el calendario. */
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Atributo `form` del campo oculto (cuando el campo vive fuera del `<form>`). */
  form?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Ayuda propia del campo; se suma a la del formato. */
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** Estilo del contenedor (ancho, margen). */
  style?: CSSProperties;
  /** Estilo del campo de texto (alto, tamaño de letra). */
  inputStyle?: CSSProperties;
  /** Etiqueta de prueba del campo visible. */
  "data-testid"?: string;
}

const WEEKDAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];
const WEEKDAYS_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function DateField({
  mode = "date",
  name,
  id,
  value,
  defaultValue,
  onChange,
  onValidityChange,
  onBlur,
  min,
  max,
  required,
  disabled,
  autoFocus,
  form: formId,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  style,
  inputStyle,
  "data-testid": testId,
}: DateFieldProps) {
  const isControlled = value !== undefined;
  const autoId = useId();
  const inputId = id ?? `fecha-${autoId}`;
  const formatId = `${inputId}-formato`;
  const errorId = `${inputId}-error`;
  const dialogId = `${inputId}-calendario`;

  const [text, setText] = useState(() =>
    isoToDisplay(isControlled ? value : defaultValue, mode),
  );
  const [validated, setValidated] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<number | null>(null);
  // Último ISO entregado por `onChange`: se avisa solo cuando cambia (como el
  // campo nativo), no en cada tecla de una fecha a medio escribir.
  const lastEmitted = useRef<string>(normalizeIso(isControlled ? value : defaultValue, mode) ?? "");

  const bounds = useMemo(() => ({ min, max }), [min, max]);
  const parsed = useMemo(() => parseDisplay(text, mode, bounds), [text, mode, bounds]);
  const currentIso = parsed.status === "valid" ? parsed.iso : "";

  // Valor controlado: el texto se reescribe solo cuando el padre CAMBIA la
  // prop a otra fecha (o la vacía, aunque haya algo a medio escribir). Si la
  // prop no cambia, lo que se está escribiendo se respeta. Y si lo que llega es
  // el eco de lo que este campo acaba de avisar (`apply` fija `lastEmitted`
  // antes de llamar a `onChange`), tampoco: un «31/02/2026» avisa "" y el padre
  // devuelve "", pero la fecha imposible tiene que quedar escrita (DAT-01).
  const prevValue = useRef(value);
  useEffect(() => {
    if (!isControlled || value === prevValue.current) return;
    prevValue.current = value;
    const incoming = normalizeIso(value, mode) ?? "";
    if (incoming === lastEmitted.current) return;
    lastEmitted.current = incoming;
    if (incoming !== "" && incoming === currentIso) return;
    // Sincronización deliberada del texto con la fuente controlada.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(isoToDisplay(incoming, mode));
  }, [isControlled, value, mode, currentIso]);

  // `form.reset()` (también el que hace React 19 tras una `<form action>`) lo
  // devuelve a `defaultValue`, como a un campo nativo. Controlado: manda el padre.
  const defaultRef = useRef(defaultValue);
  useLayoutEffect(() => {
    defaultRef.current = defaultValue;
  });
  useEffect(() => {
    // Con `form="…"` el valor viaja en ESE formulario: es el que se escucha.
    const target = formId ? document.getElementById(formId) : inputRef.current?.form;
    const form = target instanceof HTMLFormElement ? target : null;
    if (!form || isControlled) return;
    const onReset = () => {
      const display = isoToDisplay(defaultRef.current, mode);
      lastEmitted.current = normalizeIso(defaultRef.current, mode) ?? "";
      setText(display);
      setValidated(false);
      setOpen(false);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [isControlled, mode, formId]);

  // Validez hacia el padre (formularios por pasos).
  const acceptable = parsed.status === "valid" || (parsed.status === "empty" && !required);
  const validityRef = useRef(onValidityChange);
  useLayoutEffect(() => {
    validityRef.current = onValidityChange;
  });
  useEffect(() => {
    validityRef.current?.(acceptable);
  }, [acceptable]);

  useLayoutEffect(() => {
    if (pendingCaret.current == null) return;
    const el = inputRef.current;
    if (el && document.activeElement === el) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  });

  const error = parsed.status === "invalid" || parsed.status === "incomplete" ? parsed.error : null;
  const showError = validated && error != null;
  const requiredMissing = validated && required && parsed.status === "empty";
  const errorText = showError ? error : requiredMissing ? "Escribe una fecha." : null;

  // La validez del campo visible bloquea el envío mientras la fecha no sirve.
  useEffect(() => {
    inputRef.current?.setCustomValidity(error ?? "");
  }, [error]);

  const apply = useCallback(
    (nextText: string, caret?: number) => {
      setText(nextText);
      if (caret != null) pendingCaret.current = caret;
      const next = parseDisplay(nextText, mode, bounds);
      // A medio escribir no se avisa: el padre conserva el último valor.
      if (next.status === "incomplete") return;
      const iso = next.status === "valid" ? next.iso : "";
      if (iso === lastEmitted.current) return;
      lastEmitted.current = iso;
      onChange?.(iso);
    },
    [bounds, mode, onChange],
  );

  const applyIso = useCallback(
    (iso: string) => {
      const display = isoToDisplay(iso, mode);
      setValidated(true);
      apply(display, display.length);
    },
    [apply, mode],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    const formatted = normalizeTyped(raw, mode);
    const atEnd = caret >= raw.length;
    const nextCaret = atEnd
      ? formatted.length
      : caretAfterDigits(formatted, countDigits(raw.slice(0, caret)));
    apply(formatted, nextCaret);
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = normalizePasted(e.clipboardData.getData("text"), mode);
    if (pasted == null) return; // lo maneja el onChange normal
    e.preventDefault();
    setValidated(true);
    apply(pasted, pasted.length);
  };

  /** Fecha base para + y −: la escrita si es válida; si no, hoy. */
  const baseIso = () => (parsed.status === "valid" ? parsed.iso : todayIso(mode));

  const step = (n: number) => {
    const base = parsed.status === "valid" ? parsed.iso : null;
    const next = base == null ? todayIso(mode) : mode === "date" ? addDays(base, n) : addMonths(base, n);
    applyIso(clampIso(next, normalizeIso(min, mode), normalizeIso(max, mode)));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key;
    if (key === "t" || key === "T" || key === "h" || key === "H") {
      e.preventDefault();
      applyIso(clampIso(todayIso(mode), normalizeIso(min, mode), normalizeIso(max, mode)));
      return;
    }
    if (key === "+" || key === "-" || key === "−") {
      // + y − solo mueven una fecha válida o arrancan en hoy con el campo vacío.
      // A medio escribir, «-» es un separador (18-11-2025); lo demás no hace nada.
      if (parsed.status === "incomplete" && key === "-") return;
      e.preventDefault();
      if (parsed.status === "valid" || parsed.status === "empty") step(key === "+" ? 1 : -1);
      return;
    }
    if (key === "Enter") {
      setValidated(true);
      return;
    }
    if (key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }
    // Cualquier otra letra o símbolo no tiene sentido en una fecha.
    if (key.length === 1 && !/[\d/. ]/.test(key)) {
      e.preventDefault();
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (wrapperRef.current?.contains(e.relatedTarget as Node | null)) return;
    setValidated(true);
    onBlur?.();
  };

  const closeCalendar = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) inputRef.current?.focus();
  }, []);

  // Clic fuera del campo cierra el calendario.
  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => {
      if (!wrapperRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const describedBy = [ariaDescribedBy, formatId, errorText ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const invalid = Boolean(ariaInvalid) || errorText != null;
  const template = DATE_TEMPLATE[mode];
  const hiddenValue = parsed.status === "valid" ? parsed.iso : "";

  return (
    <div ref={wrapperRef} style={{ position: "relative", ...style }} data-date-field={mode}>
      <div className="studio-date-field__box" data-disabled={disabled || undefined}>
        {/* Formato en gris de fondo: lo escrito ocupa su lugar, el resto queda a la vista. */}
        <div aria-hidden="true" className="studio-date-field__ghost" style={pickFont(inputStyle)}>
          <span style={{ visibility: "hidden" }}>{text}</span>
          <span>{text.length < template.length ? template.slice(text.length) : ""}</span>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          className="studio-input studio-date-field__input"
          value={text}
          maxLength={template.length}
          onChange={handleChange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onInvalid={() => setValidated(true)}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-haspopup="dialog"
          data-date-status={parsed.status}
          data-testid={testId}
          style={inputStyle}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={mode === "date" ? "Abrir calendario" : "Abrir selector de mes"}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? closeCalendar(true) : setOpen(true))}
          className="studio-date-field__trigger"
        >
          <CalendarGlyph />
        </button>
      </div>
      <span id={formatId} className="studio-sr-only">
        {mode === "date"
          ? "Formato día, mes y año: dd/mm/aaaa. T es hoy; más y menos cambian un día; Alt más flecha abajo abre el calendario."
          : "Formato mes y año: mm/aaaa. T es este mes; más y menos cambian un mes; Alt más flecha abajo abre el selector."}
      </span>
      {errorText && (
        <div id={errorId} role="alert" className="studio-date-field__error">
          {errorText}
        </div>
      )}
      {/* Deshabilitado no viaja, igual que un campo nativo deshabilitado. */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={hiddenValue}
          form={formId}
          disabled={disabled}
          // Informativos: el oculto no valida, pero deja leer los límites del campo.
          min={min}
          max={max}
        />
      )}
      {open && !disabled && (
        <CalendarPopover
          id={dialogId}
          mode={mode}
          selected={parsed.status === "valid" ? parsed.iso : null}
          initialFocus={clampIso(baseIso(), normalizeIso(min, mode), normalizeIso(max, mode))}
          min={normalizeIso(min, mode)}
          max={normalizeIso(max, mode)}
          onPick={(iso) => {
            applyIso(iso);
            closeCalendar(true);
          }}
          onClose={closeCalendar}
        />
      )}
    </div>
  );
}

/** Solo las propiedades de letra del campo pasan al formato de fondo (para que calcen). */
function pickFont(s?: CSSProperties): CSSProperties {
  if (!s) return {};
  const out: CSSProperties = {};
  if (s.font) out.font = s.font;
  if (s.fontSize) out.fontSize = s.fontSize;
  if (s.paddingLeft != null) out.paddingLeft = s.paddingLeft;
  if (s.padding != null) out.padding = s.padding;
  return out;
}

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden="true">
      <rect x={3.5} y={5} width={17} height={15} rx={2} stroke="currentColor" strokeWidth={1.6} />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

interface CalendarPopoverProps {
  id: string;
  mode: DateMode;
  selected: string | null;
  initialFocus: string;
  min: string | null;
  max: string | null;
  onPick: (iso: string) => void;
  onClose: (returnFocus: boolean) => void;
}

/**
 * Calendario en diálogo (patrón WAI «Date Picker Dialog»): flechas mueven el
 * día, Inicio/Fin la semana, RePág/AvPág el mes (con Mayús, el año), Intro o
 * Espacio eligen y Escape cierra devolviendo el foco al campo.
 */
function CalendarPopover({ id, mode, selected, initialFocus, min, max, onPick, onClose }: CalendarPopoverProps) {
  const [focusIso, setFocusIso] = useState(initialFocus);
  const gridRef = useRef<HTMLDivElement>(null);
  const today = todayIso(mode);
  const headingId = `${id}-titulo`;

  // El campo sigue siendo la fuente: si cambia lo escrito, el calendario lo sigue.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selected) setFocusIso(selected);
  }, [selected]);

  const [fy, fm] = focusIso.split("-").map(Number);
  const outOfBounds = (iso: string) => (min != null && iso < min) || (max != null && iso > max);

  const move = (next: string) => setFocusIso(clampIso(next, min, max));

  // Al abrir, el foco entra en el día (o mes) activo.
  useEffect(() => {
    const el = gridRef.current?.querySelector<HTMLButtonElement>('[data-focus="true"]');
    if (el && gridRef.current?.contains(document.activeElement) === false) el.focus();
    // Solo al montar.
  }, []);

  // Al mover el foco con teclado, el botón activo recibe el foco real.
  const focusActive = () => {
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>('[data-focus="true"]')?.focus();
    });
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    let next: string | null = null;
    if (mode === "date") {
      const dow = (new Date(Date.UTC(fy, fm - 1, Number(focusIso.slice(8, 10)))).getUTCDay() + 6) % 7;
      if (k === "ArrowLeft") next = addDays(focusIso, -1);
      else if (k === "ArrowRight") next = addDays(focusIso, 1);
      else if (k === "ArrowUp") next = addDays(focusIso, -7);
      else if (k === "ArrowDown") next = addDays(focusIso, 7);
      else if (k === "Home") next = addDays(focusIso, -dow);
      else if (k === "End") next = addDays(focusIso, 6 - dow);
      else if (k === "PageUp") next = addMonthsToDate(focusIso, e.shiftKey ? -12 : -1);
      else if (k === "PageDown") next = addMonthsToDate(focusIso, e.shiftKey ? 12 : 1);
    } else {
      if (k === "ArrowLeft") next = addMonths(focusIso, -1);
      else if (k === "ArrowRight") next = addMonths(focusIso, 1);
      else if (k === "ArrowUp") next = addMonths(focusIso, -3);
      else if (k === "ArrowDown") next = addMonths(focusIso, 3);
      else if (k === "Home") next = `${fy}-01`;
      else if (k === "End") next = `${fy}-12`;
      else if (k === "PageUp") next = addMonths(focusIso, -12);
      else if (k === "PageDown") next = addMonths(focusIso, 12);
    }
    if (next) {
      e.preventDefault();
      move(next);
      focusActive();
      return;
    }
    if (k === "Enter" || k === " ") {
      e.preventDefault();
      if (!outOfBounds(focusIso)) onPick(focusIso);
    }
  };

  const onDialogKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
      return;
    }
    if (e.key === "Tab") {
      // El foco no se escapa del diálogo: recorre sus controles en círculo.
      const focusables = Array.from(
        e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"])'),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const stepPeriod = (n: number) => {
    move(mode === "date" ? addMonthsToDate(focusIso, n) : addMonths(focusIso, n * 12));
  };

  // Mayúscula solo en la primera letra («Noviembre de 2026»); `capitalize` subiría también el «de».
  const mes = MONTH_NAMES[fm - 1];
  const heading = mode === "date" ? `${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${fy}` : String(fy);
  const prevLabel = mode === "date" ? "Mes anterior" : "Año anterior";
  const nextLabel = mode === "date" ? "Mes siguiente" : "Año siguiente";

  return (
    <div
      id={id}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      onKeyDown={onDialogKey}
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        zIndex: 60,
        width: 284,
        maxWidth: "calc(100vw - 32px)",
        padding: 12,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-pop)",
        color: "var(--ink)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <NavButton label={prevLabel} onClick={() => stepPeriod(-1)} direction="prev" />
        <h2
          id={headingId}
          aria-live="polite"
          style={{ margin: 0, font: "600 14px/1.2 var(--f-sans)" }}
        >
          {heading}
        </h2>
        <NavButton label={nextLabel} onClick={() => stepPeriod(1)} direction="next" />
      </div>

      <div ref={gridRef} onKeyDown={onGridKey}>
        {mode === "date" ? (
          <DayGrid
            year={fy}
            month={fm}
            focusIso={focusIso}
            selected={selected}
            today={today}
            outOfBounds={outOfBounds}
            labelledBy={headingId}
            onPick={onPick}
            onFocusDay={setFocusIso}
          />
        ) : (
          <MonthGrid
            year={fy}
            focusIso={focusIso}
            selected={selected}
            today={today}
            outOfBounds={outOfBounds}
            labelledBy={headingId}
            onPick={onPick}
            onFocusMonth={setFocusIso}
          />
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          className="studio-date-field__btn"
          disabled={outOfBounds(today)}
          onClick={() => onPick(today)}
          style={footerButton}
        >
          {mode === "date" ? "Hoy" : "Este mes"}
        </button>
        <button type="button" className="studio-date-field__btn" onClick={() => onClose(true)} style={footerButton}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

const footerButton: CSSProperties = {
  minHeight: 36,
  padding: "0 12px",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-md)",
  background: "var(--bg-surface)",
  color: "var(--ink)",
  font: "600 13px/1 var(--f-sans)",
  cursor: "pointer",
};

function NavButton({ label, onClick, direction }: { label: string; onClick: () => void; direction: "prev" | "next" }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="studio-date-field__btn"
      style={{ ...footerButton, width: 36, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" aria-hidden="true">
        <path
          d={direction === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function cellStyle(isSelected: boolean, isToday: boolean, disabled: boolean, muted: boolean): CSSProperties {
  return {
    width: "100%",
    minHeight: 36,
    border: isToday && !isSelected ? "1px solid var(--ink)" : "1px solid transparent",
    borderRadius: "var(--r-md)",
    background: isSelected ? "var(--ink)" : "transparent",
    color: isSelected ? "var(--ink-inv)" : disabled ? "var(--ink-mute)" : muted ? "var(--ink-soft)" : "var(--ink)",
    font: `${isSelected || isToday ? 700 : 500} 13px/1 var(--f-mono)`,
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: disabled ? "line-through" : "none",
  };
}

interface DayGridProps {
  year: number;
  month: number;
  focusIso: string;
  selected: string | null;
  today: string;
  outOfBounds: (iso: string) => boolean;
  labelledBy: string;
  onPick: (iso: string) => void;
  onFocusDay: (iso: string) => void;
}

function DayGrid({ year, month, focusIso, selected, today, outOfBounds, labelledBy, onPick, onFocusDay }: DayGridProps) {
  const mm = String(month).padStart(2, "0");
  const first = `${year}-${mm}-01`;
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const start = addDays(first, -offset);
  const total = Math.ceil((offset + daysInMonth(year, month)) / 7) * 7;
  const days = Array.from({ length: total }, (_, i) => addDays(start, i));
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <table role="grid" aria-labelledby={labelledBy} style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <thead>
        <tr>
          {WEEKDAYS.map((d, i) => (
            <th
              key={d}
              scope="col"
              abbr={WEEKDAYS_LONG[i]}
              style={{ padding: "4px 0", font: "600 11px/1 var(--f-sans)", color: "var(--ink-soft)", textTransform: "uppercase" }}
            >
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]}>
            {week.map((iso) => {
              const inMonth = iso.slice(0, 7) === `${year}-${mm}`;
              const isSelected = iso === selected;
              const isToday = iso === today;
              const disabled = outOfBounds(iso);
              const isFocus = iso === focusIso;
              return (
                <td key={iso} role="gridcell" aria-selected={isSelected} style={{ padding: 1 }}>
                  <button
                    type="button"
                    tabIndex={isFocus ? 0 : -1}
                    data-focus={isFocus ? "true" : undefined}
                    data-iso={iso}
                    aria-disabled={disabled || undefined}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${spokenDate(iso, "date")}${isToday ? ", hoy" : ""}`}
                    className="studio-date-field__cell"
                    onClick={() => (disabled ? undefined : onPick(iso))}
                    onFocus={() => onFocusDay(iso)}
                    style={cellStyle(isSelected, isToday, disabled, !inMonth)}
                  >
                    {Number(iso.slice(8, 10))}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface MonthGridProps {
  year: number;
  focusIso: string;
  selected: string | null;
  today: string;
  outOfBounds: (iso: string) => boolean;
  labelledBy: string;
  onPick: (iso: string) => void;
  onFocusMonth: (iso: string) => void;
}

function MonthGrid({ year, focusIso, selected, today, outOfBounds, labelledBy, onPick, onFocusMonth }: MonthGridProps) {
  const rows = [0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => r * 3 + c));
  return (
    <table role="grid" aria-labelledby={labelledBy} style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((m) => {
              const iso = `${year}-${String(m + 1).padStart(2, "0")}`;
              const isSelected = iso === selected;
              const isToday = iso === today;
              const disabled = outOfBounds(iso);
              const isFocus = iso === focusIso;
              return (
                <td key={iso} role="gridcell" aria-selected={isSelected} style={{ padding: 2 }}>
                  <button
                    type="button"
                    tabIndex={isFocus ? 0 : -1}
                    data-focus={isFocus ? "true" : undefined}
                    data-iso={iso}
                    aria-disabled={disabled || undefined}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${spokenDate(iso, "month")}${isToday ? ", este mes" : ""}`}
                    className="studio-date-field__cell"
                    onClick={() => (disabled ? undefined : onPick(iso))}
                    onFocus={() => onFocusMonth(iso)}
                    style={{ ...cellStyle(isSelected, isToday, disabled, false), minHeight: 40, fontFamily: "var(--f-sans)" }}
                  >
                    {MONTH_SHORT[m]}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
