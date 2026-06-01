/** Formateadores compartidos del módulo Contabilidad (SDD-0040). */

/** Monto con 2 decimales y separador de miles (en-US, libros en USD). */
export function fmtAmount(n: number): string {
  return (Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Monto firmado: negativos entre paréntesis (convención contable). */
export function fmtSigned(n: number): string {
  const v = Number(n) || 0;
  if (v < 0) return `(${fmtAmount(Math.abs(v))})`;
  return fmtAmount(v);
}

/** Monto entero con $ (para KPIs / totales grandes). */
export function fmtMoney(n: number): string {
  return (Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
