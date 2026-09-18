import { NavClient } from "./NavClient";

/**
 * Nav público — envoltorio de servidor (SDD-0473).
 *
 * Todo el menú vive en `NavClient.tsx` (estado, drawer, focus trap y el
 * historial de decisiones de ancho y jerarquía). Este archivo existe por una
 * sola razón: decidir si el menú lleva el enlace al cotizador, y eso depende de
 * `DOCUMENT_IMPORT_ENABLED`, una variable de servidor que un componente de
 * cliente no puede leer. Leerla acá evita una segunda bandera `NEXT_PUBLIC_*`
 * que se podría desalinear de la de verdad.
 *
 * Mismo criterio que el footer y el sitemap: con la bandera apagada /cotizador
 * es 404 y el menú queda exactamente como antes.
 *
 * Requisito: sólo lo importan componentes de servidor (las páginas públicas y
 * `not-found`). Un `"use client"` que lo importara lo convertiría en código de
 * cliente, y ahí la bandera leería siempre `undefined`.
 */
export function Nav() {
  return <NavClient cotizador={process.env.DOCUMENT_IMPORT_ENABLED === "true"} />;
}
