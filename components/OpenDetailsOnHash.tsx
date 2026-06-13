"use client";

import { useEffect } from "react";

/**
 * Abre el <details> cuyo id coincide con el hash de la URL.
 *
 * Por qué: <ServiciosDetalle /> es server component y cada servicio es un
 * acordeón nativo colapsado (`<details id={slug}>`). Los enlaces del footer
 * apuntan a `/servicios#slug`; sin esto, el visitante aterriza sobre un
 * acordeón cerrado. Esto garantiza —en todos los navegadores— que el destino
 * quede abierto y a la vista, sin convertir la ficha en client component.
 *
 * No molesta a los anchors que NO son <details> (índice de grupos): si el id
 * no cuelga de un <details>, es no-op y manda el scroll nativo.
 */
export function OpenDetailsOnHash() {
  useEffect(() => {
    function openFromHash() {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (!id) return;
      const el = document.getElementById(id);
      const details = el?.closest("details");
      if (details && !details.open) {
        details.open = true;
        // Re-scroll una vez abierto (el alto del acordeón cambió).
        requestAnimationFrame(() => el?.scrollIntoView({ block: "start" }));
      }
    }

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return null;
}
