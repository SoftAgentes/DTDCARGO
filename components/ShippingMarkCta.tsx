import Link from "next/link";

/**
 * ShippingMarkCta — el CTA de registro, con **"Casillero" tachado siempre pegado
 * debajo de "Shipping Mark"**.
 *
 * REGLA DE MARCA (founder 2026-07-31): el par va ATADO. "Casillero" no es un
 * adorno que se pone en un sitio y en otro no — es el gesto pedagógico que
 * ancla el término: el cliente ex-courier reconoce "casillero", lo ve tachado, y
 * entiende que nosotros a eso lo llamamos Shipping Mark. Por eso vive dentro de
 * un componente y no suelto en el JSX de cada página: **no se mueve, no se
 * olvida y no se puede escribir la mitad**. Si mañana aparece un tercer CTA de
 * registro, usa este componente y hereda la regla gratis.
 *
 * Complementa BD-029 (Shipping Mark único en todas las superficies): BD-029 dice
 * cómo se llama; esto dice cómo se le enseña al que todavía no lo sabe.
 *
 * **Por qué el tachado usa `currentColor` + opacity y no un color fijo:** este
 * CTA aparece sobre fondos opuestos — en el hero es `btn-ghost` (texto oscuro
 * sobre papel) y en el cierre del home es `btn-primary` (texto blanco sobre
 * wine). Un gris fijo como `--color-grey-500` se lee bien en el primero y
 * DESAPARECE en el segundo. Heredando el color del botón y bajando la opacidad,
 * el par contrasta solo, sin props de tema que alguien tenga que acordarse de
 * pasar. Medido con opacity 0.7: **6.05:1 en el hero y 5.76:1 sobre el wine** —
 * los dos pasan AA (umbral 4.5:1 para los 12px del tachado).
 */
export function ShippingMarkCta({
  className = "btn btn-primary btn-lg",
  href = "/registro",
  label = "Regístrate y obtén tu Shipping Mark",
}: {
  className?: string;
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      // El botón se apila para que el tachado quede DEBAJO, no al lado.
      style={{
        // Dos renglones + tachado: la altura fija de .btn no contiene el par.
        // Crece con el texto y el padding en ambos CTA, también al ampliarlo.
        height: "auto",
        flexDirection: "column",
        gap: 2,
        lineHeight: 1.2,
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          opacity: 0.7,
          textDecoration: "line-through",
        }}
      >
        &quot;Casillero&quot;
      </span>
    </Link>
  );
}
