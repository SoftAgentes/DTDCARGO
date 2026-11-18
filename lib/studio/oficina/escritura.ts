/**
 * SDD-0626 §3.1 · El único camino de escritura del cable: nada se guarda sin pasar por
 * `exigirTextosDelCable` (R5 · AUD-01 §5).
 *
 * `escribirEnElCable(textos, escribir)` revisa los textos y SOLO si pasan llama a `escribir`. Si la
 * regla los rechaza, no se guarda nada y el log dice por qué (los códigos de la regla) SIN repetir
 * el dato rechazado: un texto con datos personales no debe acabar en el log del servidor.
 *
 * Los avisos de «falta la 0541» se anotan UNA vez por proceso (`avisarUnaVez`): la ausencia de la
 * migración no es un error del ERP, y un log que la repite en cada evento lo ahoga.
 */
import { type TextosDelCable, TextoDelCableRechazado, exigirTextosDelCable } from "./cable-textos";

export type ResultadoEscritura<T> =
  | { escrito: true; valor: T }
  | { escrito: false; codigos: readonly string[] };

export async function escribirEnElCable<T>(
  textos: TextosDelCable,
  escribir: () => Promise<T>,
  registrar: (mensaje: string) => void = (m) => console.error(m),
): Promise<ResultadoEscritura<T>> {
  try {
    exigirTextosDelCable(textos);
  } catch (e) {
    if (e instanceof TextoDelCableRechazado) {
      registrar(`[oficina-cable] no se guarda: ${e.codigos.join(", ")} (SDD-0626 §3.1, R5)`);
      return { escrito: false, codigos: e.codigos };
    }
    throw e;
  }
  return { escrito: true, valor: await escribir() };
}

const avisados = new Set<string>();

/** Anota `mensaje` una sola vez por `clave` en este proceso. Devuelve si lo anotó. */
export function avisarUnaVez(
  clave: string,
  mensaje: string,
  registrar: (mensaje: string) => void = (m) => console.warn(m),
): boolean {
  if (avisados.has(clave)) return false;
  avisados.add(clave);
  registrar(mensaje);
  return true;
}

/** Solo para las pruebas: olvida lo avisado. */
export function olvidarAvisosParaPruebas(): void {
  avisados.clear();
}

/**
 * ¿El error de PostgREST/Postgres es «esa tabla o función no existe»? Es lo que ve el cable cuando la
 * 0541 (o la 0544) no está aplicada. Códigos: PGRST205 (tabla fuera del caché de esquema), PGRST202
 * (función fuera del caché), 42P01 (undefined_table) y 42883 (undefined_function).
 */
export function faltaLaMigracion(error: { code?: string | null } | null | undefined): boolean {
  const code = error?.code ?? "";
  return code === "PGRST205" || code === "PGRST202" || code === "42P01" || code === "42883";
}
