const CSP_NONCE = /^[A-Za-z0-9+/_-]+={0,2}$/;

type PrivateCspOptions = {
  development: boolean;
};

/**
 * Genera un valor impredecible por request sin depender de APIs de Node.
 * UUID v4 aporta 122 bits aleatorios; quitar guiones conserva sólo caracteres
 * válidos en el `base64-value` aceptado por CSP.
 */
export function createCspNonce(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

/**
 * Política de las superficies privadas que ya son dinámicas por autenticación.
 *
 * `style-src 'unsafe-inline'` es una deuda distinta y explícita: React todavía
 * emite atributos `style` en estas superficies. El nonce elimina la concesión
 * de scripts inline, que es la frontera ejecutable de mayor riesgo.
 */
export function buildPrivateAppCsp(
  nonce: string,
  options: PrivateCspOptions,
): string {
  if (!CSP_NONCE.test(nonce)) {
    throw new Error("Nonce CSP inválido");
  }

  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.development ? " 'unsafe-eval'" : ""}`,
    `script-src-attr 'none'`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self' data:`,
    `img-src 'self' data: blob: https://*.supabase.co`,
    `media-src 'self' blob: https://*.supabase.co`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co${options.development ? " ws: wss:" : ""}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join("; ");
}
