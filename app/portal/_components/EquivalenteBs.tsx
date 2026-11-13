/**
 * SDD-0629 · El equivalente en bolívares de un monto en USD, en el portal.
 * Solo una vista: «≈ Bs …», la tasa con su fuente y su fecha, y el texto de
 * referencial. Sin tasa dice «tasa no disponible», nunca un cero. El texto
 * sale de `lib/shared/equivalente-bs.ts`, el mismo del Studio.
 */

import {
  LEYENDA_BS_REFERENCIAL,
  textoEquivalenteBs,
  type EquivalenteBs as Equivalente,
} from "@/lib/shared/equivalente-bs";

const MONO = { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" };

export function EquivalenteBs({
  eq,
  leyenda = false,
  align = "left",
}: {
  eq: Equivalente;
  leyenda?: boolean;
  align?: "left" | "right";
}) {
  const texto = textoEquivalenteBs(eq, "portal");
  if (!texto) return null;
  const sinTasa = eq.estado === "sin-tasa";
  return (
    <div
      data-testid="equivalente-bs"
      data-estado={eq.estado}
      className={`mt-1 flex flex-col gap-0.5 ${align === "right" ? "items-end text-right" : ""}`}
    >
      <span
        className={`text-[13px] ${sinTasa ? "font-medium text-grey-500" : "font-semibold text-ink"}`}
        style={MONO}
      >
        {texto.monto}
      </span>
      <span className="text-[11.5px] text-grey-500">{texto.detalle}</span>
      {texto.aviso ? (
        <span role="note" className="text-[11.5px] font-semibold text-grey-700">
          {texto.aviso}
        </span>
      ) : null}
      {leyenda ? (
        <span className="text-[11px] italic text-grey-500 max-w-[52ch]">{LEYENDA_BS_REFERENCIAL}</span>
      ) : null}
    </div>
  );
}
