import Link from "next/link";
import { ArrowIcon } from "@/components/Icon";

/**
 * "Convertido en el envío X" de una fila de Estimados/Cotizaciones (SDD-0075 §1 ·
 * Slice C).
 *
 * Antes la fila decía sólo "Convertido en envío." — cierto pero sin salida: el
 * cliente no sabía CUÁL envío ni podía llegar a él. Con el código, cierra el
 * círculo estimado → envío.
 *
 * Degrada honesto: sin código (el envío no es legible por RLS para este cliente)
 * vuelve al texto plano en vez de un enlace roto.
 */
export function ConvertedNote({
  code,
  label = "Convertido",
}: {
  code: string | null;
  /** Concuerda con el sujeto de la fila: "Convertido" (el estimado) / "Convertida" (la cotización). */
  label?: "Convertido" | "Convertida";
}) {
  const success = "var(--color-status-success)";

  if (!code) {
    return (
      <p
        className="mt-2 text-[12.5px] font-medium"
        style={{ color: success }}
      >
        {label} en envío.
      </p>
    );
  }

  return (
    <Link
      href={`/portal/envios/${encodeURIComponent(code)}`}
      className="group mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium hover:underline"
      style={{ color: success }}
    >
      {label} en el envío{" "}
      <span
        className="font-bold"
        style={{
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
        }}
      >
        {code}
      </span>
      <ArrowIcon size={13} />
    </Link>
  );
}
