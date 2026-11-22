/**
 * PistaLey — lo que dice la ley para un grupo de campos del formulario de
 * Reglas (SDD-0653). El asterisco marca lo no verificado y la nota pide
 * consultar a un abogado. Datos públicos de `lib/studio/nomina/ley`; sin estado.
 */

import {
  PARAMETROS_LEY,
  NOTA_NO_VERIFICADO,
  estaVerificado,
  formatearValorLey,
  type CampoRegla,
} from "@/lib/studio/nomina/ley/parametros";

export function PistaLey({ campos }: { campos: readonly CampoRegla[] }) {
  const items = PARAMETROS_LEY.filter((p) => p.campo !== null && campos.includes(p.campo));
  if (items.length === 0) return null;
  const hayNoVerificado = items.some((p) => !estaVerificado(p));
  return (
    <p style={{ margin: "-4px 0 0", font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
      <strong style={{ color: "var(--ink)" }}>Según la ley: </strong>
      {items.map((p, i) => (
        <span key={p.id}>
          {i > 0 ? " · " : ""}
          {p.etiqueta} {p.comparacion === "minimo" ? "≥ " : ""}
          {formatearValorLey(p.valor, p.unidad)}
          {!estaVerificado(p) && (
            <>
              <span aria-hidden="true">*</span>
              <span className="studio-sr-only"> (no verificado)</span>
            </>
          )}
        </span>
      ))}
      {hayNoVerificado && (
        <span style={{ display: "block" }}>
          <span aria-hidden="true">* </span>
          {NOTA_NO_VERIFICADO}
        </span>
      )}
    </p>
  );
}
