import { BrandMark } from "@/components/BrandMark";
import { signOutAction } from "../actions";

/**
 * Header del portal autenticado: logo + identidad del cliente (nombre + MARKBOX)
 * + cerrar sesión. Server component — el logout es un `<form>` que postea a la
 * server action `signOutAction`.
 */
export function PortalHeader({ markbox, name }: { markbox: string; name: string }) {
  return (
    <header className="border-b border-grey-200 bg-white sticky top-0 z-40">
      <div className="wrap flex items-center justify-between h-[68px] gap-4">
        <BrandMark variant="primary" size={32} />

        <div className="flex items-center gap-3 sm:gap-4">
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
