/**
 * Enlace a una ficha de servicio. Cuatro servicios tienen RUTA REAL propia;
 * el resto vive en el hub /servicios y se abre por hash `#svc/<slug>`.
 * Fuente de slugs: `data-svc` del mockup Servicios · DTD-Cargo.html.
 */
const RUTAS_REALES: Record<string, string> = {
  "puerta-a-puerta": "/servicios/puerta-a-puerta",
  "consolidado-lcl": "/servicios/lcl",
  fcl: "/servicios/fcl",
  "inspeccion-en-fabrica": "/servicios/inspeccion",
};

export function svcHref(slug: string): string {
  // Hub: siempre absoluto (`/servicios#svc/...`) para que el cross-ref también
  // funcione desde las rutas reales (puerta-a-puerta, lcl, fcl, inspección),
  // donde no vive el HubRouter: navega al hub y abre la ficha por hash.
  return RUTAS_REALES[slug] ?? `/servicios#svc/${slug}`;
}
