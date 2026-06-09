/**
 * Header de la zona interna del equipo. Chrome propio (NO el shell navy del ERP
 * ni el Nav público): isologo → vuelve al índice, título, email del user y "Salir".
 */

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { signOut } from "../actions";

export function InternoHeader({ email }: { email?: string }) {
  return (
    <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-grey-200">
      <div className="wrap flex items-center justify-between gap-4 h-[64px]">
        <Link
          href="/interno"
          className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded-md"
          aria-label="Recursos internos · inicio"
        >
          <BrandMark variant="primary" size={30} isologoOnly />
          <span className="flex flex-col leading-none">
            <span className="text-[14.5px] font-bold text-ink">Recursos internos</span>
            <span className="text-[11.5px] text-grey-500 mt-0.5">DTD Cargo · equipo</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {email ? (
            <span className="hidden sm:inline text-[12.5px] text-grey-500 max-w-[200px] truncate">
              {email}
            </span>
          ) : null}
          <form action={signOut}>
            <button
              type="submit"
              className="text-[13px] font-semibold text-grey-700 border border-grey-200 rounded-full px-3.5 py-1.5 hover:border-ink hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 transition-colors"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
