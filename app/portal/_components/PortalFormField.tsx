"use client";

import { useId, useState } from "react";
import { CheckIcon, DocIcon } from "@/components/Icon";

/**
 * Label visual del campo. Con `htmlFor` renderiza `<label>` real (asociación
 * accesible con el input); sin `htmlFor` queda como encabezado de grupo (ej.
 * "Adjuntos", que agrupa varios FileField). Compartido entre los forms de
 * proveedores y compras del portal.
 */
export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const className =
    "text-[13.5px] font-semibold text-ink";
  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className={className}>
        {children}
      </label>
    );
  }
  return <span className={className}>{children}</span>;
}

/**
 * Campo de archivo sobrio (label estilizado + input oculto). Muestra el/los
 * nombre(s) elegido(s) y vira a verde cuando hay selección. El `<input>` va con
 * su `name` dentro del `<form action={...}>` → el archivo viaja en el FormData al
 * server action (subida server-side). `multiple` para las fotos.
 */
export function FileField({
  name,
  label,
  accept,
  multiple,
  disabled,
}: {
  name: string;
  label: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const [names, setNames] = useState<string[]>([]);
  const has = names.length > 0;
  return (
    <div>
      <label
        htmlFor={id}
        className={`flex items-center gap-2.5 px-3.5 py-3 min-h-[44px] rounded-[10px] border text-[13px] transition-colors peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-ink)] ${
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        }`}
        style={{
          borderColor: has
            ? "var(--color-status-success)"
            : "var(--color-grey-200)",
          background: has ? "var(--color-paper)" : "var(--color-white)",
        }}
      >
        <span
          className="flex-shrink-0"
          style={{
            color: has ? "var(--color-status-success)" : "var(--color-grey-500)",
          }}
        >
          {has ? <CheckIcon size={15} /> : <DocIcon size={15} />}
        </span>
        <span className="min-w-0 truncate font-medium text-ink">
          {has
            ? names.length > 2
              ? `${names.length} archivos`
              : names.join(", ")
            : label}
        </span>
        <span className="ml-auto flex-shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-grey-500">
          {has ? "Cambiar" : "Subir"}
        </span>
      </label>
      <input
        id={id}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="peer sr-only"
        onChange={(e) => {
          const fs = e.target.files;
          setNames(fs ? Array.from(fs).map((f) => f.name) : []);
        }}
      />
    </div>
  );
}
