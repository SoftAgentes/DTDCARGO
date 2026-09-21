/**
 * Comparación de secretos en tiempo constante (SDD-0499).
 *
 * El repo ya tenía la implementación correcta en tres sitios
 * (`cron/document-import-drain`, `cron/document-import-cleanup` y
 * `studio/audit/export`) y la ingenua —`auth === \`Bearer ${secret}\``— en los
 * otros dieciocho `authorize()` de `app/api/cron/*` y en `debug/health`. Esto es
 * ese acierto, una sola vez, para que la ruta nueva no tenga que elegir.
 *
 * **Higiene, no urgencia.** Sobre HTTP, el jitter de red domina la diferencia de
 * unos pocos nanosegundos entre dos `memcmp` que divergen en el byte 3 o en el
 * 30, así que el canal de temporización remoto es poco práctico de explotar.
 * Se unifica porque un solo criterio es más barato de auditar que veintiuno, no
 * porque haya un ataque a la vuelta de la esquina.
 *
 * Lo que sí es sustancial y estas funciones PRESERVAN: **fail-closed**. Sin
 * secreto configurado no pasa nadie. Un `undefined` en `expected` devuelve
 * `false`, nunca "coinciden porque los dos están vacíos" — el modo de fallo que
 * convierte una variable de entorno olvidada en una puerta abierta.
 *
 * Límite conocido: la longitud SÍ se filtra (el `length !==` corta antes del
 * `timingSafeEqual`, que exige buffers del mismo tamaño). Es inherente al
 * primitivo y la longitud de un secreto no es el secreto.
 */

import { timingSafeEqual } from "node:crypto";

/**
 * ¿`actual` es exactamente `expected`? Fail-closed ante nulo, indefinido o
 * vacío en cualquiera de los dos lados.
 */
export function sameSecret(
  actual: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * ¿El header `Authorization` trae exactamente `Bearer <secreto>`?
 *
 * Recibe el header CRUDO, no el token ya recortado: así el esquema (`Bearer `)
 * entra en la misma comparación y no queda un `startsWith` suelto decidiendo
 * antes.
 */
export function matchesBearerSecret(
  header: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!secret) return false;
  return sameSecret(header, `Bearer ${secret}`);
}
