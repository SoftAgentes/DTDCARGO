/**
 * PortalFieldError — el mensaje de error del Portal, en un solo lugar (SDD-0261).
 *
 * POR QUÉ EXISTE. Los ~42 mensajes de error del portal se pintaban con
 * `text-wine`, que mide 3,00:1 sobre la card en el tema oscuro (el default de
 * todo cliente). Eso rompía dos políticas aprobadas a la vez:
 *
 *   · BTN-01 §2 — "el vino de marca no sustituye `danger`". El vino es
 *     identidad; cuando el mismo color pinta el eyebrow de una sección, el
 *     enlace "Ver detalle" Y el "No pudimos guardar", deja de significar nada.
 *   · ERR-01 §Reglas — "Color danger se acompaña con texto/icono Y contraste".
 *     Las DOS mitades estaban incumplidas: el error viajaba sólo en el color, y
 *     ese color era ilegible.
 *
 * Por eso acá el color NO es el único portador: el ícono lo acompaña siempre.
 * Eso además es lo que sostiene la excepción EXC-0261-01 — el rojo elegido
 * (`--color-status-danger` = #f6929a en oscuro) queda a ΔE 7,1 del
 * `--color-wine-text` de los enlaces, y lo que distingue error de enlace pasa a
 * ser el ícono, no el tono.
 *
 * Se centraliza en vez de repetirlo 42 veces por SGE-00.09: la misma necesidad
 * reutiliza el mismo patrón.
 */

/** Nivel del error, según la taxonomía de ERR-01 §Taxonomía. */
type Nivel = "campo" | "formulario";

export function PortalFieldError({
  children,
  nivel = "campo",
  id,
  className = "",
}: {
  children: React.ReactNode;
  /**
   * `campo` va debajo de su input (12px). `formulario` es el resumen de la
   * cabecera del form (13px), que ERR-01 pide para inconsistencias entre campos
   * y para el fallo de la transacción.
   */
  nivel?: Nivel;
  /** Para enlazarlo con `aria-describedby` desde el input. */
  id?: string;
  className?: string;
}) {
  if (!children) return null;
  const px = nivel === "formulario" ? "text-[13px]" : "text-[12px]";
  return (
    <p
      id={id}
      // `role="alert"` y no `status`: un error es urgente y debe interrumpir.
      // A11Y-01 · ERR-01. (En el portal había un `role="status"` para un error
      // — AvatarEditor — que este componente corrige de paso.)
      role="alert"
      className={`mt-1 flex items-start gap-1.5 ${px} leading-[1.4] text-status-danger ${className}`}
    >
      <ErrorIcon />
      <span>{children}</span>
    </p>
  );
}

/**
 * Triángulo de alerta. `aria-hidden` a propósito: el `role="alert"` del padre ya
 * anuncia el mensaje, y un nombre acá lo haría leer dos veces.
 */
function ErrorIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="mt-[1px] h-3.5 w-3.5 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2.2 1.6 13.2h12.8L8 2.2Z" />
      <path d="M8 6.4v3.2" />
      <path d="M8 11.6h.01" />
    </svg>
  );
}
