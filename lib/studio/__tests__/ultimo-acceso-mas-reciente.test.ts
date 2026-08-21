/**
 * La señal de "último acceso" toma la más reciente de las dos fuentes
 * (SDD-0275).
 *
 * POR QUÉ EXISTE. `user_tenants.last_login_at` lo escribe un trigger sobre
 * `auth.sessions` (migr 0019) y **tiene falsos negativos**: medido en
 * producción el 2026-08-20, dos de nueve cuentas lo tenían en `null` habiendo
 * iniciado sesión de verdad. Con la banda de trabajo de SDD-0274 eso deja de
 * ser cosmético: cuenta gente como pendiente y ofrece mandarle un correo de
 * acceso a quien ya entra.
 *
 * La resolución vive inline en `page.tsx` (un server component no se importa
 * desde un test), así que acá se fija la REGLA con la misma expresión. Si la
 * página cambia de criterio, este test queda como el contrato que decía cuál
 * era — y la spec dice dónde mirar.
 */

import { describe, it, expect } from "vitest";

/** Misma expresión que `app/studio/(app)/usuarios/page.tsx`. */
function ultimoAcceso(deTenant: string | null, deAuth: string | null): string | null {
  return deTenant && deAuth
    ? (new Date(deAuth) > new Date(deTenant) ? deAuth : deTenant)
    : (deTenant ?? deAuth);
}

const VIEJO = "2026-06-20T11:23:03Z";
const NUEVO = "2026-08-20T00:10:01Z";

describe("ultimoAcceso", () => {
  it("🔴 el caso que lo motivó: la columna en null y Auth con fecha", () => {
    // hailuway.com@hotmail.com en producción: entró el 20-jun y user_tenants
    // se quedó en null. Sin esto la UI lo cuenta como "nunca entró".
    expect(ultimoAcceso(null, VIEJO)).toBe(VIEJO);
  });

  it("nunca entró de verdad: las dos en null", () => {
    expect(ultimoAcceso(null, null)).toBeNull();
  });

  it("si la columna se quedó atrás, gana Auth", () => {
    expect(ultimoAcceso(VIEJO, NUEVO)).toBe(NUEVO);
  });

  it("si Auth se quedó atrás, gana la columna", () => {
    expect(ultimoAcceso(NUEVO, VIEJO)).toBe(NUEVO);
  });

  it("Auth en null no borra lo que la columna sí sabe", () => {
    expect(ultimoAcceso(NUEVO, null)).toBe(NUEVO);
  });

  it("iguales: devuelve la fecha, no null", () => {
    expect(ultimoAcceso(NUEVO, NUEVO)).toBe(NUEVO);
  });
});
