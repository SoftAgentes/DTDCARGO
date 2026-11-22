"use client";

/**
 * Botón de envío de los formularios de la pantalla «IA» (SDD-0704). Las acciones redirigen al terminar, así que no se
 * usa `ActionButton` (espera un resultado): este se deshabilita mientras la acción corre, para que un doble clic no
 * mande dos cambios (el segundo daría un error falso, por ejemplo un alias repetido).
 */
import { useFormStatus } from "react-dom";

export function BotonEnviar({ children, variante = "primary", tamano = "sm" }: { children: React.ReactNode; variante?: "primary" | "ghost" | "danger"; tamano?: "sm" | "xs" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`studio-btn studio-btn-${variante} studio-btn-${tamano}`} disabled={pending} aria-busy={pending}>
      {pending ? "Guardando…" : children}
    </button>
  );
}
