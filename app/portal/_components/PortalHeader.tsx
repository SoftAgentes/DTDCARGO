import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { PortalNav } from "./PortalNav";
import { PortalThemeToggle } from "./PortalThemeToggle";
import { PortalAccountMenu } from "./PortalAccountMenu";

/**
 * Header del portal autenticado: logo + nav de 6 destinos del Norte + identidad
 * del cliente. La identidad ahora es un **menú** (`PortalAccountMenu`): Cuenta y
 * Perfil "cuelgan del nombre" (Norte) en vez de ser ítems del top-nav; el logout
 * vive dentro de ese menú. La navegación con estado activo vive en `<PortalNav>`
 * (client, `usePathname`).
 *
 * `themed` (founder 2026-06-20): cuando la cuenta es DEMO, el portal tiene tema
 * oscuro/claro → mostramos el toggle y el logo sigue el tema (reverse en oscuro).
 * `showClub`: Club solo aparece en el nav si el cliente está habilitado (gated).
 */
export function PortalHeader({
  markbox,
  name,
  themed = false,
  theme = "light",
  showClub = false,
  soporteLastReplyAt = null,
}: {
  markbox: string;
  name: string;
  themed?: boolean;
  theme?: "dark" | "light";
  showClub?: boolean;
  /** Último reply del equipo (SDD-0148 #4): el nav pinta un punto si es más
   *  nuevo que la última visita del cliente a Soporte. */
  soporteLastReplyAt?: string | null;
}) {
  return (
    <header className="border-b border-grey-200 bg-white sticky top-0 z-40">
      <div className="wrap flex items-center justify-between h-[68px] gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <Link
            href="/portal"
            aria-label="Ir al inicio del portal"
            className="flex-shrink-0"
          >
            {/* Mobile: solo isólogo (ahorra ancho con 4 ítems de nav). Desktop: lockup completo.
                Con tema (demo) montamos las 2 variantes y el CSS muestra la que toca
                (primary en claro, reverse en oscuro · data-theme-show). */}
            {themed ? (
              <>
                <span data-theme-show="light">
                  <span className="sm:hidden">
                    <BrandMark variant="primary" size={30} isologoOnly />
                  </span>
                  <span className="hidden sm:inline-flex">
                    <BrandMark variant="primary" size={32} />
                  </span>
                </span>
                <span data-theme-show="dark">
                  <span className="sm:hidden">
                    <BrandMark variant="reverse" size={30} isologoOnly />
                  </span>
                  <span className="hidden sm:inline-flex">
                    <BrandMark variant="reverse" size={32} />
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="sm:hidden">
                  <BrandMark variant="primary" size={30} isologoOnly />
                </span>
                <span className="hidden sm:inline-flex">
                  <BrandMark variant="primary" size={32} />
                </span>
              </>
            )}
          </Link>
          <PortalNav showClub={showClub} soporteLastReplyAt={soporteLastReplyAt} />
        </div>

        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          {themed && <PortalThemeToggle initialTheme={theme} />}
          <PortalAccountMenu name={name} markbox={markbox} />
        </div>
      </div>
    </header>
  );
}
