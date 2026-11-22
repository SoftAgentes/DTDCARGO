// @vitest-environment node
/**
 * SDD-0675 · La Bandeja se ofrece como acceso adicional por persona.
 * Decisión de Sam (2026-11-18): «Leads y Clientes» y «Sí, siempre las dos».
 */
import { describe, expect, it } from "vitest";
import { canAccessModule, canEditModule } from "@/lib/studio/rbac";
import { grantableStatus, moduleCoverage } from "@/lib/studio/user-module-grants";

describe("bandeja como acceso adicional (SDD-0675)", () => {
  it("está cubierta: se puede conceder", () => {
    expect(moduleCoverage("bandeja")).toBe("covered");
  });

  it("contabilidad u operaciones sin la Bandeja por rol: se le puede dar", () => {
    expect(grantableStatus("accounting", "bandeja")).toEqual({ kind: "grantable" });
    expect(grantableStatus("operations", "bandeja")).toEqual({ kind: "grantable" });
  });

  it("comercial y atención ya la tienen por rol: el extra no suma", () => {
    expect(grantableStatus("commercial", "bandeja")).toEqual({ kind: "role_full" });
    expect(grantableStatus("support", "bandeja")).toEqual({ kind: "role_full" });
  });

  it("con el extra vigente ve (y edita si se le dio); vencido, no", () => {
    expect(canAccessModule("accounting", "bandeja")).toBe(false);
    expect(canAccessModule("accounting", "bandeja", undefined, { bandeja: { view: true, edit: false } })).toBe(true);
    expect(canEditModule("accounting", "bandeja", undefined, { bandeja: { view: true, edit: false } })).toBe(false);
    expect(canEditModule("accounting", "bandeja", undefined, { bandeja: { view: true, edit: true } })).toBe(true);
    expect(
      canAccessModule("accounting", "bandeja", undefined, {
        bandeja: { view: true, edit: false, expiresAt: "2020-01-01T00:00:00Z" },
      }),
    ).toBe(false);
  });
});
