"use client";

import { useState } from "react";
import { sanitizeDecimalText, parseDecimalInput } from "@/lib/calculadora";

/**
 * Input numérico decimal tolerante a coma o punto (es-VE escribe "2,5").
 *
 * Mantiene un buffer de TEXTO crudo en vez de un `<input type="number">`
 * controlado por un número: así el separador decimal no se borra a mitad de
 * tipeo (bug histórico: `type="number"` + `parseFloat(value)||0` comía el "."
 * y rechazaba la coma → "solo toma enteros"). `inputMode="decimal"` levanta el
 * teclado numérico en móvil. El valor numérico viaja al padre vía onValueChange.
 *
 * Compartido por la calculadora LCL (/tarifas) y la del último km
 * (/calculadora-terrestre) — fuente única para no duplicar la lógica del separador.
 */
export function DecimalInput({
  value,
  onValueChange,
  id,
  placeholder,
  className,
}: {
  value: number;
  onValueChange: (n: number) => void;
  id?: string;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(() => (value ? String(value) : ""));

  // Re-sincroniza el buffer cuando el valor numérico cambia desde afuera (ej.
  // el botón "Restaurar $X"). Patrón "ajustar estado durante el render" de
  // React (sin useEffect → sin cascada de renders). El tipeo normal no lo
  // dispara: ahí el valor parseado del texto ya == value, así que no resetea.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    const parsed = parseDecimalInput(text);
    const same = Number.isNaN(parsed) ? value === 0 : parsed === value;
    if (!same) setText(value ? String(value) : "");
  }

  function handleChange(raw: string) {
    const clean = sanitizeDecimalText(raw);
    setText(clean);
    const n = parseDecimalInput(clean);
    onValueChange(Number.isFinite(n) ? n : 0);
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}
