/**
 * Formato de montos del portal del empleado (/m/emp).
 *
 * Estaba definido adentro de `EmpClient.tsx` y sus hermanos lo importaban del
 * componente: eso cerraba el único ciclo de imports REAL del repo
 * (EmpClient → PerfilTab → EmpClient, los dos de valor, no de tipo).
 *
 * ⚠️ Se conserva el comportamiento tal cual estaba (locale `es-VE`), que NO
 * coincide con el resto del ERP — acá un sueldo sale `USD 1.234,50` y en
 * Nómina el mismo monto sale `$1,234.50`. Unificar eso es decisión aparte:
 * el helper canónico es `formatCurrency` de `lib/i18n/format.ts`.
 */
export function fmtUsd(n: number): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n ?? 0);
}
