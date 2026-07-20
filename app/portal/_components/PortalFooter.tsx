import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

/**
 * Pie del portal — diseño de Cloud Design (`_norte/portal/app.jsx` ·
 * `PortalFooter`): isólogo + firma + enlaces legales. En el prototipo los
 * documentos abrían en un visor propio; acá van a las páginas legales reales del
 * sitio (`/terminos`, `/privacidad`), que son la fuente vigente.
 */
export function PortalFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="mt-16"
      style={{
        borderTop: "1px solid var(--color-grey-200)",
        background: "var(--color-white)",
      }}
    >
      <div className="wrap flex flex-col items-center justify-between gap-3 py-7 sm:flex-row">
        <span data-theme-show="light">
          <BrandMark variant="primary" size={26} />
        </span>
        <span data-theme-show="dark">
          <BrandMark variant="reverse" size={26} />
        </span>
        <p className="text-center text-[12px] text-grey-500 sm:text-right">
          © {year} DTD Cargo · Portal del Cliente ·{" "}
          <Link href="/terminos" className="font-semibold text-wine-text hover:underline">
            Términos
          </Link>{" "}
          ·{" "}
          <Link href="/privacidad" className="font-semibold text-wine-text hover:underline">
            Privacidad
          </Link>
        </p>
      </div>
    </footer>
  );
}
