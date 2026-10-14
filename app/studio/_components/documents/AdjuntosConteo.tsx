/**
 * <AdjuntosConteo> · cuántos adjuntos tiene una fila (SDD-0507).
 *
 * Con adjuntos: ficha neutra con el icono `doc` y el número en mono. Sin
 * adjuntos: la palabra, en tinta suave. La diferencia no depende del color
 * (A11Y-01): cambia la forma y el texto. El desglose va en `title`.
 *
 * Quien lo usa ya contó: si no se pudo contar, no se pinta este componente
 * (nunca «Ninguno» sin haber contado). Ver `adjuntos-queries.ts`.
 *
 * Sin estado ni hooks: sirve en componentes de servidor y de cliente.
 */
import { Icon } from "@/app/studio/_components/icons";

export function AdjuntosConteo({
  total,
  desglose,
  variante = "celda",
}: {
  total: number;
  /** Texto del `title`: «2 adjuntos: 1 interno · 1 lo ve el cliente en el portal». */
  desglose: string;
  /** `celda` (tablas: «5» / «Ninguno») o `tarjeta` (Tracking: «2 adjuntos» / «Sin adjuntos»). */
  variante?: "celda" | "tarjeta";
}) {
  const tarjeta = variante === "tarjeta";

  if (total === 0) {
    return (
      <span
        title={desglose}
        style={{
          font: `500 ${tarjeta ? 11 : 11.5}px/1 var(--f-sans)`,
          color: "var(--ink-soft)",
          whiteSpace: "nowrap",
        }}
      >
        {tarjeta ? "Sin adjuntos" : "Ninguno"}
      </span>
    );
  }

  const palabra = total === 1 ? "adjunto" : "adjuntos";
  return (
    <span
      title={desglose}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--s-1)",
        height: tarjeta ? 20 : 24,
        padding: "0 var(--s-2)",
        borderRadius: "var(--r-sm)",
        background: "var(--neutral-bg)",
        color: "var(--ink)",
        font: `700 ${tarjeta ? 11 : 12}px/1 var(--f-mono)`,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true" style={{ display: "inline-flex" }}>
        {Icon.doc(13)}
      </span>
      {total}
      {tarjeta ? (
        <span style={{ font: "700 11px/1 var(--f-sans)" }}> {palabra}</span>
      ) : (
        <span className="studio-sr-only"> {palabra}</span>
      )}
    </span>
  );
}
