"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPortalVistaAction } from "../actions";
import { NOMBRE_VISTA, type PortalVista } from "@/lib/portal/vista-preferida";

/**
 * SDD-0654 · Selector «Vista simple / Vista Pro» de la barra superior (D-3).
 *
 * Solo existe con `PORTAL_VISTA_SIMPLE=true` (lo decide el layout). Dos botones
 * con `aria-pressed`: la elección se guarda en la base con la RPC de la 0557,
 * así que sigue al cliente entre su teléfono y su computadora (AC-6). Cambia al
 * instante y, si no se pudo guardar (sin la 0557 o sin red), vuelve a la de
 * antes y lo dice. La elección no borra ni mueve datos.
 *
 * Seleccionado en ink (BD-037), no en vino ni en dorado. En teléfono se acorta
 * a «Simple» / «Pro» para que quepa en la barra.
 */
const OPCIONES: readonly PortalVista[] = ["simple", "pro"];

export function PortalVistaSelector({ vista }: { vista: PortalVista }) {
  const router = useRouter();
  const [actual, setActual] = useState<PortalVista>(vista);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [pendiente, startTransition] = useTransition();

  function elegir(siguiente: PortalVista) {
    if (siguiente === actual || pendiente) return;
    const anterior = actual;
    setActual(siguiente);
    setAviso("");
    setError("");
    startTransition(async () => {
      const r = await setPortalVistaAction(siguiente).catch(() => ({ ok: false }));
      if (r.ok) {
        setAviso(`Ahora ves la ${NOMBRE_VISTA[siguiente]}.`);
        router.refresh();
      } else {
        setActual(anterior);
        setError("No pudimos cambiar la vista. Intenta de nuevo en un momento.");
      }
    });
  }

  return (
    <div className="relative flex items-center">
      <div
        role="group"
        aria-label="Vista del portal"
        aria-busy={pendiente || undefined}
        className="inline-flex flex-shrink-0 items-center rounded-full border border-grey-200 p-0.5"
      >
        {OPCIONES.map((opcion) => {
          const activa = opcion === actual;
          return (
            <button
              key={opcion}
              type="button"
              aria-pressed={activa}
              onClick={() => elegir(opcion)}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 text-[13px] font-bold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                activa ? "" : "text-grey-700 hover:text-ink"
              }`}
              style={
                activa
                  ? { background: "var(--color-ink)", color: "var(--color-paper)" }
                  : undefined
              }
            >
              <span className="hidden sm:inline">Vista&nbsp;</span>
              {opcion === "simple" ? (
                <>
                  <span className="sm:hidden">Simple</span>
                  <span className="hidden sm:inline">simple</span>
                </>
              ) : (
                "Pro"
              )}
            </button>
          );
        })}
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {aviso}
      </span>
      {error && (
        <p
          role="alert"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[240px] max-w-[calc(100vw-32px)] rounded-md border border-grey-200 px-3 py-2 text-[13px] text-ink shadow-sm"
          style={{ background: "var(--color-white)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
