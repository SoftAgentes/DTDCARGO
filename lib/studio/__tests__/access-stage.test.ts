/**
 * La etapa de acceso y el orden por defecto (SDD-0274 · Slice 4).
 *
 * QUÉ DEFIENDE. El orden de la tabla es lo único que empuja el trabajo
 * pendiente al frente sin que nadie filtre nada, y vive en una función pura de
 * dos ramas que es fácil "simplificar" sin notar lo que se pierde:
 *
 *   - **Los que nunca entraron van primero**, y entre ellos **el más viejo
 *     arriba**: quien lleva un mes con la cuenta sin estrenar es el caso
 *     urgente, no el que se dio de alta ayer. Invertir esa comparación deja el
 *     caso urgente al fondo de su propio grupo.
 *   - **El desempate es alfabético**, no el orden en que vino la query: sin eso
 *     la tabla baila entre recargas y no se puede confiar en dónde estaba cada
 *     quien.
 */

import { describe, it, expect } from "vitest";
import {
  accessStage,
  compareByAccessStage,
  type UserMembershipWithProfile,
} from "@/lib/studio/user-types";

function m(over: Partial<UserMembershipWithProfile>): UserMembershipWithProfile {
  return {
    user_id: over.user_id ?? "u",
    tenant_id: "tn",
    role: "operations",
    warehouse_scope: "all",
    disabled_at: null,
    last_login_at: null,
    invited_by: null,
    created_at: "2026-07-01T00:00:00Z",
    email: "x@dtdcargo.com",
    profile: null,
    ...over,
  };
}

describe("accessStage", () => {
  it("suspendido gana sobre nunca-entro", () => {
    // Alguien suspendido que además nunca entró: lo que manda es que está
    // suspendido — mandarle un enlace no lo dejaría entrar igual.
    expect(
      accessStage(m({ disabled_at: "2026-08-01T00:00:00Z", last_login_at: null })),
    ).toBe("suspendido");
  });

  it("sin último acceso es nunca-entro", () => {
    expect(accessStage(m({ last_login_at: null }))).toBe("nunca-entro");
  });

  it("con último acceso es activo", () => {
    expect(accessStage(m({ last_login_at: "2026-08-17T00:00:00Z" }))).toBe("activo");
  });
});

describe("compareByAccessStage · el orden por defecto", () => {
  it("pone lo pendiente arriba y lo resuelto abajo", () => {
    const activo = m({ user_id: "a", last_login_at: "2026-08-17T00:00:00Z" });
    const suspendido = m({ user_id: "s", disabled_at: "2026-08-01T00:00:00Z" });
    const nunca = m({ user_id: "n", last_login_at: null });

    const orden = [activo, suspendido, nunca].sort(compareByAccessStage);

    expect(orden.map((x) => x.user_id)).toEqual(["n", "s", "a"]);
  });

  it("entre los que nunca entraron, el MÁS VIEJO va primero", () => {
    const viejo = m({
      user_id: "viejo",
      created_at: "2026-06-01T00:00:00Z",
      email: "zzz@dtdcargo.com",
    });
    const nuevo = m({
      user_id: "nuevo",
      created_at: "2026-08-18T00:00:00Z",
      email: "aaa@dtdcargo.com",
    });

    // El email empuja al revés a propósito: si el desempate alfabético ganara
    // sobre la antigüedad, "aaa" quedaría primero y el test lo cazaría.
    const orden = [nuevo, viejo].sort(compareByAccessStage);

    expect(orden.map((x) => x.user_id)).toEqual(["viejo", "nuevo"]);
  });

  it("dentro de la misma etapa y fecha, el orden es estable y alfabético", () => {
    const b = m({ user_id: "b", last_login_at: "2026-08-17T00:00:00Z", email: "bea@dtd.com" });
    const a = m({ user_id: "a", last_login_at: "2026-08-17T00:00:00Z", email: "ana@dtd.com" });

    expect([b, a].sort(compareByAccessStage).map((x) => x.user_id)).toEqual(["a", "b"]);
    // Mismo resultado si entran al revés: el orden no depende de la query.
    expect([a, b].sort(compareByAccessStage).map((x) => x.user_id)).toEqual(["a", "b"]);
  });

  it("la antigüedad NO se usa fuera de nunca-entro", () => {
    // Dos activos: manda el alfabético, no quién se dio de alta antes.
    const viejoZ = m({
      user_id: "z",
      created_at: "2026-01-01T00:00:00Z",
      last_login_at: "2026-08-17T00:00:00Z",
      email: "zulay@dtd.com",
    });
    const nuevoA = m({
      user_id: "a",
      created_at: "2026-08-18T00:00:00Z",
      last_login_at: "2026-08-17T00:00:00Z",
      email: "ana@dtd.com",
    });

    expect([viejoZ, nuevoA].sort(compareByAccessStage).map((x) => x.user_id)).toEqual(["a", "z"]);
  });
});
