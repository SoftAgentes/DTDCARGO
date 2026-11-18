/**
 * SDD-0629 · El equivalente en bolívares de un monto en USD, solo como vista.
 *
 * Debajo del monto: «≈ Bs 3,650.00» y la tasa con su fuente y su fecha. Si la
 * tasa es de un día anterior, lo dice; si no hay, dice «tasa no disponible» y
 * nunca muestra un cero. Sin estado ni efectos: sirve en server y client
 * components. El texto sale de `lib/shared/equivalente-bs.ts` (el mismo del
 * portal).
 */

import {
  LEYENDA_BS_REFERENCIAL,
  textoEquivalenteBs,
  type EquivalenteBs as Equivalente,
} from "@/lib/shared/equivalente-bs";

type Props = {
  eq: Equivalente;
  /** «oscuro» sobre la card navy del detalle de factura. */
  tono?: "claro" | "oscuro";
  /** Muestra el texto de «referencial» debajo. */
  leyenda?: boolean;
  align?: "left" | "right";
};

export function EquivalenteBs({ eq, tono = "claro", leyenda = false, align = "left" }: Props) {
  const texto = textoEquivalenteBs(eq, "studio");
  if (!texto) return null;
  const oscuro = tono === "oscuro";
  const suave = oscuro ? "var(--ink-side-soft)" : "var(--ink-soft)";
  const fuerte = oscuro ? "var(--ink-side)" : "var(--ink)";
  const sinTasa = eq.estado === "sin-tasa";
  return (
    <div
      data-testid="equivalente-bs"
      data-estado={eq.estado}
      style={{ marginTop: "var(--s-1)", textAlign: align, display: "grid", gap: "var(--s-1)" }}
    >
      <span
        style={{
          font: `${sinTasa ? 600 : 700} 13px/1.3 var(--f-mono)`,
          color: sinTasa ? suave : fuerte,
        }}
      >
        {texto.monto}
      </span>
      <span style={{ font: "500 11px/1.4 var(--f-sans)", color: suave }}>{texto.detalle}</span>
      {texto.aviso && (
        <span
          role="note"
          style={{
            font: "600 11px/1.4 var(--f-sans)",
            color: oscuro ? "var(--ink-side-strong)" : "var(--ink)",
          }}
        >
          {texto.aviso}
        </span>
      )}
      {leyenda && (
        <span style={{ font: "italic 500 10.5px/1.4 var(--f-sans)", color: suave }}>
          {LEYENDA_BS_REFERENCIAL}
        </span>
      )}
    </div>
  );
}
