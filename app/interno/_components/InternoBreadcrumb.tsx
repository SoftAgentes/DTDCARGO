/**
 * Breadcrumb compartido de la zona interna. Mismo patrón en todos los niveles
 * (consistencia de navegación · UI/UX review). El último ítem sin `href` = actual.
 */

import Link from "next/link";

export function InternoBreadcrumb({
  items,
}: {
  items: { href?: string; label: string }[];
}) {
  return (
    <nav className="text-[13px] text-grey-500" aria-label="Ruta">
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && (
            <span className="mx-2" aria-hidden>
              /
            </span>
          )}
          {it.href ? (
            <Link href={it.href} className="hover:text-ink transition-colors">
              {it.label}
            </Link>
          ) : (
            <span className="text-grey-700">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
