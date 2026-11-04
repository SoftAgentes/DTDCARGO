"use client";

/**
 * <SegmentedControl> · selector "1 de N opciones mutuamente exclusivas".
 *
 * Patrón canónico que reemplaza a:
 *  - Cards-as-buttons (Step0Tipo del wizard de noticias) que no afford click
 *  - Pills inline ad-hoc (Tone, LLMModeToggle) que se inventaban cada vez
 *  - Dropdowns/Selects para opciones discretas pocas (3-5)
 *
 * Variantes:
 *  - `cards`  → segments grandes con label + descripción opcional.
 *               Ideal para selectores principales (Tipo editorial, Categoría
 *               sugerida) donde queremos peso visual claro y room para
 *               describir cada opción.
 *  - `pills`  → segments compactos label-only en una línea. Ideal para
 *               filtros, tonos (Informativo/Curiosidad/Polémica), toggles
 *               Auto/Manual.
 *
 * Accesibilidad:
 *  - role="radiogroup" + role="radio" + aria-checked
 *  - Tab focus en el activo · arrow keys mueven entre segments
 *  - Tamaño touch ≥24px (WCAG 2.2 SC 2.5.8)
 *
 * Tokens (light + dark via data-theme):
 *  - active   → var(--wine) text + bg paper + border wine
 *  - inactive → var(--ink-soft) text + bg transparent + border var(--border)
 *  - hover    → border var(--wine) sin commit visual
 */

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T | null;
  onChange: (next: T) => void;
  options: Array<SegmentedControlOption<T>>;
  /** `cards` = grandes con desc · `pills` = compactos inline. Default cards. */
  variant?: "cards" | "pills";
  /** Default sm. Solo aplica a variant=pills. */
  size?: "sm" | "default";
  /** Layout en columnas (cards). 'auto' = flex-1 que reparte ancho. */
  columns?: "auto" | 1 | 2 | 3 | 4 | 5;
  /** Disabled global del control. Cada option puede tener su propio disabled. */
  disabled?: boolean;
  /** Label accesible del grupo. */
  ariaLabel?: string;
  /** className extra (para el wrapper raíz). */
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  variant = "cards",
  size = "sm",
  columns = "auto",
  disabled = false,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const enabled = options
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => !o.disabled);
    if (enabled.length === 0) return;
    const localIdx = enabled.findIndex((x) => x.i === idx);

    let nextIdx = localIdx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIdx = (localIdx + 1) % enabled.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIdx = (localIdx - 1 + enabled.length) % enabled.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = enabled.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const target = enabled[nextIdx];
    refs.current[target.i]?.focus();
    if (!disabled) onChange(target.o.value);
  };

  if (variant === "pills") {
    return (
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "stretch",
          padding: "var(--s-1)",
          background: "var(--bg-elevated, rgba(15,30,61,0.04))",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border-strong)",
          gap: "var(--s-1)",
        }}
      >
        {options.map((opt, i) => {
          const isActive = opt.value === value;
          const isDisabled = disabled || opt.disabled;
          return (
            <button
              key={opt.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-disabled={isDisabled}
              tabIndex={isActive ? 0 : -1}
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(opt.value)}
              onKeyDown={(e) => handleKey(e, i)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding:
                  size === "default" ? "0 var(--s-4)" : "0 var(--s-3)",
                fontSize: size === "default" ? 14.5 : 14,
                fontWeight: isActive ? 800 : 600,
                lineHeight: 1.2,
                minHeight: 36,
                borderRadius: "var(--r-md)",
                border: "none",
                background: isActive ? "var(--ink)" : "transparent",
                color: isActive ? "var(--ink-inv)" : "var(--ink)",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.4 : 1,
                boxShadow: isActive ? "var(--shadow-sm)" : "none",
                transition:
                  "background 120ms ease, color 120ms ease, box-shadow 120ms ease",
              }}
            >
              {opt.icon && (
                <span style={{ display: "inline-flex" }} aria-hidden>
                  {opt.icon}
                </span>
              )}
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  // variant === "cards"
  const gridStyle: React.CSSProperties =
    columns === "auto"
      ? { display: "flex", gap: 10, flexWrap: "wrap" }
      : {
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 10,
        };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={className}
      style={gridStyle}
    >
      {options.map((opt, i) => {
        const isActive = opt.value === value;
        const isDisabled = disabled || opt.disabled;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-disabled={isDisabled}
            tabIndex={isActive ? 0 : -1}
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(opt.value)}
            onKeyDown={(e) => handleKey(e, i)}
            style={{
              flex: columns === "auto" ? "1 1 0" : undefined,
              minWidth: 0,
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: "var(--r-md, 10px)",
              border: `1px solid ${
                isActive ? "var(--wine-text)" : "var(--ink-soft)"
              }`,
              background: isActive
                ? "var(--wine-tint, rgba(127,15,26,0.06))"
                : "var(--bg-surface, #FFFFFF)",
              cursor: isDisabled ? "not-allowed" : "pointer",
              opacity: isDisabled ? 0.4 : 1,
              transition:
                "border-color 120ms ease, background 120ms ease, transform 120ms ease",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minHeight: 56,
              outline: "none",
            }}
            onMouseEnter={(e) => {
              if (!isActive && !isDisabled) {
                e.currentTarget.style.borderColor = "var(--wine, #7F0F1A)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive && !isDisabled) {
                e.currentTarget.style.borderColor = "var(--ink-soft)";
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow =
                "0 0 0 3px var(--wine-tint, rgba(127,15,26,0.18))";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 700,
                fontSize: 14,
                color: isActive
                  ? "var(--wine, #7F0F1A)"
                  : "var(--ink, #0F1E3D)",
                lineHeight: 1.2,
              }}
            >
              {opt.icon && (
                <span style={{ display: "inline-flex" }} aria-hidden>
                  {opt.icon}
                </span>
              )}
              {opt.label}
            </div>
            {opt.description && (
              <div
                style={{
                  fontSize: 12.5,
                  color: isActive
                    ? "var(--wine, #7F0F1A)"
                    : "var(--ink-soft, #4B5563)",
                  opacity: isActive ? 0.85 : 1,
                  lineHeight: 1.35,
                }}
              >
                {opt.description}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
