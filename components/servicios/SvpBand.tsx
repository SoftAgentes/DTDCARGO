import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Banda de los 3 servicios principales de la portada /servicios (svp-band).
 * Handoff Cloud Design · Servicios · DTD-Cargo.html.
 * Cada tarjeta navy enlaza a la ruta real de su ficha.
 */
export type SvpPrincipal = {
  nm: string;
  role: ReactNode;
  href: string;
  /** Marca la tarjeta insignia (Puerta a Puerta) con estrella + borde wine. */
  star?: boolean;
};

export function SvpBand({ items }: { items: SvpPrincipal[] }) {
  return (
    <div className="svp-band">
      {items.map((p) => (
        <Link key={p.href} className={p.star ? "svp-pri star" : "svp-pri"} href={p.href}>
          <span className="r">
            {p.star && (
              <span className="st">
                <StarSvg />
              </span>
            )}
            <span className="nm">{p.nm}</span>
          </span>
          <p className="role">{p.role}</p>
          <span className="go">
            Ver servicio <ArrowSvg />
          </span>
        </Link>
      ))}
    </div>
  );
}

function StarSvg() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden>
      <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
    </svg>
  );
}

function ArrowSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
