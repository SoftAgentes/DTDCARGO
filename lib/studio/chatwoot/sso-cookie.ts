/**
 * Marca de «ya se pidió el SSO» de la Bandeja (SDD-0585, E2-D12/E2-D13).
 *
 * Cada SSO es un login en Chatwoot: con 5 sesiones vivas el sexto da 409 y la
 * pantalla para elegir cuál cerrar dentro del iframe, y rack-attack corta a 5
 * logins por IP cada 5 min (PoC 2.1, E2-R7 y E2-C4). Por eso Studio no pide uno
 * en cada visita: guarda el id del usuario al que se le pidió el último y, si
 * coincide con el de la sesión, el iframe abre el panel sin token.
 *
 * - httpOnly: el cliente no la lee; la decide el servidor al renderizar.
 * - Sin `maxAge`: cookie de sesión del navegador. `signOut` la borra.
 * - Solo el id del usuario de Studio (un uuid), nada de Chatwoot.
 */

export const SSO_COOKIE = "dtd_cw_sso";

export const SSO_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/studio",
};

/** ¿La marca es de este usuario? Una marca de otro usuario obliga a un SSO nuevo. */
export function ssoVigentePara(valor: string | undefined, userId: string): boolean {
  return !!valor && valor === userId;
}
