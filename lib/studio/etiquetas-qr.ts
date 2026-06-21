/**
 * QR de las etiquetas por cartón — URL escaneable a /verificar (SDD-0100).
 *
 * Reemplaza el QR mock visual de SDD-0031 por un destino REAL: cada caja
 * codifica su Shipping Mark + caja/total, así el QR es único por cartón.
 * `/verificar` (SDD-0097, ya en prod) confirma que el MARKBOX pertenece a un
 * envío DTD sin exponer datos del cliente; `n` (caja/total) viaja para
 * trazabilidad y lo sanea la propia página.
 *
 * Lógica pura (sin React) → testeable. La consume
 * `app/studio/(app)/etiquetas/_components/Label.tsx`.
 */

// Base pública del QR. Misma resolución que el QR del proveedor en /p/[token]:
// SITE_URL si está, si no el dominio canónico.
const VERIFY_BASE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://dtdcargo.com";

/** URL escaneable de la etiqueta: `<base>/verificar?c=<markbox>&n=<caja>/<total>`. */
export function labelVerifyUrl(
  markbox: string,
  boxIndex: number,
  totalBoxes: number,
): string {
  const c = encodeURIComponent(markbox.trim());
  return `${VERIFY_BASE}/verificar?c=${c}&n=${boxIndex}/${totalBoxes}`;
}
