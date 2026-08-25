/**
 * SDD-0299 · El error de "Datos de la empresa" tiene que nombrar su causa.
 *
 * Lo que se prueba es lo que costó una hora de diagnóstico el 2026-08-25: una
 * pantalla que falla sin decir por qué es indistinguible de una que no hizo
 * nada. El código tipado ya venía de `mapDatabaseError`; se tiraba en el
 * `catch`.
 */

import { describe, it, expect } from "vitest";
import { mensajeDeErrorD1 } from "../company-types";

const GENERICO = "No se pudo guardar la cuenta.";

describe("mensajeDeErrorD1", () => {
  it("🔴 permission_denied nombra la causa REAL: falta el rol de administrador", () => {
    // Éste es el caso que motivó la spec. El gate que muerde no es el de la
    // app sino `audit_d1_admin_tenant()` en la base, que exige
    // `user_tenants.role = 'admin'`. Sin este texto, la pantalla decía
    // "No se pudo guardar la cuenta." y no había forma de saberlo desde la UI.
    const msg = mensajeDeErrorD1("permission_denied", GENERICO);
    expect(msg).toContain("administrador");
    expect(msg).not.toBe(GENERICO);
  });

  it("🔴 NUNCA devuelve el código crudo", () => {
    // `D1OperationError` hace `super(code)`, así que su `.message` ES el
    // código. Devolverlo tal cual le mostraría "permission_denied" al usuario
    // — que fue exactamente el bug de SDD-0273 en el módulo de usuarios.
    for (const code of [
      "permission_denied",
      "invalid_state",
      "invalid_input",
      "idempotency_conflict",
      "audit_failed",
    ]) {
      expect(mensajeDeErrorD1(code, GENERICO)).not.toContain(code);
      expect(mensajeDeErrorD1(code, GENERICO)).not.toContain("_");
    }
  });

  it("un código desconocido cae al genérico que nombra la acción", () => {
    // El genérico no es relleno: dice QUÉ no se pudo hacer. Por eso lo pone
    // cada action y no el traductor.
    expect(mensajeDeErrorD1("query_failed", GENERICO)).toBe(GENERICO);
    expect(mensajeDeErrorD1("algo_nuevo", GENERICO)).toBe(GENERICO);
    expect(mensajeDeErrorD1(null, GENERICO)).toBe(GENERICO);
    expect(mensajeDeErrorD1(undefined, GENERICO)).toBe(GENERICO);
  });

  it("cada action conserva su propio genérico", () => {
    expect(mensajeDeErrorD1(null, "No se pudo guardar la oficina.")).toBe(
      "No se pudo guardar la oficina.",
    );
    expect(mensajeDeErrorD1(null, "No se pudo eliminar la cuenta.")).toBe(
      "No se pudo eliminar la cuenta.",
    );
  });

  it("los mensajes conocidos terminan en punto y se leen como frase", () => {
    for (const code of ["permission_denied", "invalid_state", "invalid_input"]) {
      const msg = mensajeDeErrorD1(code, GENERICO);
      expect(msg.trim().endsWith(".")).toBe(true);
      expect(msg.length).toBeGreaterThan(20);
    }
  });
});
