/**
 * Rutas que resuelven la sesión de Supabase server-side (SDD-0302).
 *
 * El proxy refresca el access token en cookies SOLO en estas. Antes eran el
 * matcher del proxy entero; desde el modo mantenimiento (SDD-0505) el matcher
 * cubre además la API, las server actions y las rutas que escriben, y esta
 * lista decide dónde se paga el `getUser()`.
 *
 * `/m/cn` y `/m/ve` NO van: el operario entra con PIN, no con sesión
 * (app/m/layout.tsx). Lo vigila app/__tests__/proxy-matcher-contract.test.ts.
 */
export const RUTAS_CON_SESION = [
  "/studio",
  "/back",
  "/portal",
  "/m/erp",
  "/m/emp",
  "/entrar",
  "/registro",
] as const;

/** ¿La ruta necesita el refresco de sesión del proxy? */
export function necesitaSesion(pathname: string): boolean {
  return RUTAS_CON_SESION.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
