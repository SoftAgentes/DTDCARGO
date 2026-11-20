/**
 * Selector de vista de Almacén China (SDD-0682 §2): «En almacén» (lo que está en
 * la bodega) y «En camino» (lo que ya salió). Son enlaces: la vista vive en la
 * URL (`?vista=camino`) y el servidor lee solo lo que esa vista necesita.
 */

import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import { hrefDeVista, type VistaCn } from "@/lib/studio/almacen-cn-vistas";

export function VistasAlmacen({
  locale,
  vista,
  params,
}: {
  locale: Locale;
  vista: VistaCn;
  /** Parámetros actuales de la URL (se conservan, p. ej. `lang`). */
  params: Record<string, string | string[] | undefined>;
}) {
  const opciones: { id: VistaCn; label: string }[] = [
    { id: "almacen", label: t(locale, "warehouse_cn.view.en_almacen") },
    { id: "camino", label: t(locale, "warehouse_cn.view.en_camino") },
  ];
  return (
    <nav
      aria-label={t(locale, "warehouse_cn.view.label")}
      className="studio-tabs"
      style={{ marginBottom: "var(--s-5)" }}
    >
      {opciones.map((o) => (
        <Link
          key={o.id}
          href={hrefDeVista("/studio/cn", params, o.id)}
          className="studio-tab"
          data-activa={vista === o.id ? "true" : undefined}
          aria-current={vista === o.id ? "page" : undefined}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
