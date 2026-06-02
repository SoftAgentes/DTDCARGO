import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { signOutAction } from "../actions";
import { PortalNav } from "./PortalNav";

/**
 * Header del portal autenticado: logo + navegación (Envíos · Facturas · Cuenta)
 * + identidad del cliente (nombre + MARKBOX) + cerrar sesión. Server component;
 * el logout es un `<form>` que postea a la server action `signOutAction`. La
 * navegación con estado activo vive en `<PortalNav>` (client, `usePathname`).
 */
export function PortalHeader({ markbox, name }: { markbox: string; name: string }) {
  return (
    <header className="border-b border-grey-200 bg-white sticky top-0 z-40">
      <div className="wrap flex items-center justify-between h-[68px] gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <Link
            href="/portal"
            aria-label="Ir al inicio del portal"
            className="flex-shrink-0"
          >
            {/* Mobile: solo isólogo (ahorra ancho con 4 ítems de nav). Desktop: lockup completo. */}
            <span className="sm:hidden">
              <BrandMark variant="primary" size={30} isologoOnly />
            </span>
            <span className="hidden sm:inline-flex">
              <BrandMark variant="primary" size={32} />
            </span>
          </Link>
          <PortalNav />
        </div>

        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-[13px] font-semibold text-ink leading-tight truncate max-w-[200px]">
              {name}
            </div>
            <div
              className="text-[11.5px] text-grey-500 leading-tight"
              style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
            >
              {markbox}
            </div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-[13px] font-semibold text-grey-700 border border-grey-200 rounded-md px-3 py-2 hover:border-ink hover:text-ink transition-colors"
            >
              <span className="sm:hidden">Salir</span>
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
