"use client";

/**
 * <ForensicWatermark> — overlay forense del No-Olvidar (SDD-0025 §4.16, mit. #4).
 *
 * Cubre el contenido revelado con una marca diagonal repetida (email · IP ·
 * timestamp). NO previene la captura — la HABILITA para forensics: si el secreto
 * termina en un screenshot circulando, la marca dice quién lo reveló y cuándo.
 *
 * pointer-events: none → no interfiere con la interacción del contenido debajo.
 * Solo tokens del sistema (var(--*)); nada de hex inventado.
 */

interface ForensicWatermarkProps {
  /** Texto de la marca — típicamente `email · ip · timestamp`. */
  label: string;
  /** Cuántas veces repetir en el grid (más = más denso). Default 6. */
  repeat?: number;
}

export function ForensicWatermark({ label, repeat = 6 }: ForensicWatermarkProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        display: "flex",
        flexWrap: "wrap",
        alignContent: "center",
        justifyContent: "center",
        gap: "10px 18px",
        transform: "rotate(-30deg)",
        opacity: 0.12,
        userSelect: "none",
      }}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <span
          key={i}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            color: "var(--ink)",
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
