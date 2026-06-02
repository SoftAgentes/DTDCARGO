import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { signOutAction } from "../actions";

/**
 * Header del portal autenticado: logo + identidad del cliente (nombre + MARKBOX)
 * + "Mi cuenta" + cerrar sesión. Server component — el logout es un `<form>` que
 * postea a la server action `signOutAction`. La identidad (nombre + MARKBOX)
 * linkea a `/portal/cuenta` para llegar al perfil read-only desde cualquier vista.
 */
export function PortalHeader({ markbox, name }: { markbox: string; name: string }) {
  return (
    <header className="border-b border-grey-200 bg-white sticky top-0 z-40">
      <div className="wrap flex items-center justify-between h-[68px] gap-3 sm:gap-4">
        <Link href="/portal" aria-label="Ir a mis envíos">
          <BrandMark variant="primary" size={32} />
        </Link>

        <div className="flex items-center gap-2.5 sm:gap-4">
          <Link
            href="/portal/cuenta"
            className="flex items-center gap-3 rounded-md px-2 py-1.5 -mr-1 hover:bg-grey-100 transition-colors"
            aria-label="Mi cuenta"
          >
            <div className="text-right">
              <div className="text-[13px] font-semibold text-ink leading-tight truncate max-w-[200px] hidden sm:block">
                {name}
              </div>
              <div
                className="text-[11.5px] text-grey-500 leading-tight"
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              >
                {markbox}
              </div>
            </div>
          </Link>
          <Link
            href="/portal/cuenta"
            className="hidden sm:inline-flex text-[13px] font-semibold text-grey-700 border border-grey-200 rounded-md px-3 py-2 hover:border-ink hover:text-ink transition-colors"
          >
            Mi cuenta
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-[13px] font-semibold text-grey-700 border border-grey-200 rounded-md px-3 py-2 hover:border-ink hover:text-ink transition-colors"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
