import { describe, it, expect } from "vitest";
import {
  validatePositionInput,
  slugFromTitle,
  groupPositionsByArea,
  positionRoleLabel,
  isStudioUserRole,
  type Position,
} from "./position-types";

describe("validatePositionInput", () => {
  const base = { title: "Contabilidad", area: "Administración" };

  it("acepta un input válido y deriva el slug del título", () => {
    const { input, fieldErrors } = validatePositionInput({
      ...base,
      rbac_role: "accounting",
      kpi: "Cero errores en pagos",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).toBeDefined();
    expect(input!.slug).toBe("contabilidad");
    expect(input!.rbac_role).toBe("accounting");
    expect(input!.active).toBe(true);
  });

  it("exige título y área", () => {
    const t = validatePositionInput({ title: "  ", area: "" });
    expect(t.fieldErrors?.title).toBeTruthy();
    expect(t.fieldErrors?.area).toBeTruthy();
  });

  it("acepta rol vacío como 'sin asiento' (null)", () => {
    const { input } = validatePositionInput({ ...base, rbac_role: "" });
    expect(input!.rbac_role).toBeNull();
  });

  it("rechaza un rol RBAC inválido", () => {
    const { fieldErrors } = validatePositionInput({ ...base, rbac_role: "superadmin" });
    expect(fieldErrors?.rbac_role).toBeTruthy();
  });

  it("respeta un slug provisto válido", () => {
    const { input } = validatePositionInput({ ...base, slug: "ventas-crm" });
    expect(input!.slug).toBe("ventas-crm");
  });
});

describe("slugFromTitle", () => {
  it("normaliza acentos y espacios a kebab-case", () => {
    expect(slugFromTitle("Administración / PMO")).toBe("administracion-pmo");
    expect(slugFromTitle("Coordinación China")).toBe("coordinacion-china");
  });
});

describe("positionRoleLabel", () => {
  it("da 'Sin asiento' cuando el rol es null", () => {
    expect(positionRoleLabel(null)).toBe("Sin asiento");
  });
});

describe("isStudioUserRole", () => {
  it("valida los roles del enum", () => {
    expect(isStudioUserRole("accounting")).toBe(true);
    expect(isStudioUserRole("marketing")).toBe(true);
    expect(isStudioUserRole("nope")).toBe(false);
  });
});

describe("groupPositionsByArea", () => {
  it("agrupa respetando el orden de aparición", () => {
    const mk = (area: string, title: string): Position =>
      ({ area, title }) as Position;
    const groups = groupPositionsByArea([
      mk("Administración", "Contabilidad"),
      mk("Comercial", "Ventas"),
      mk("Administración", "Tesorería"),
    ]);
    expect(groups.map((g) => g.area)).toEqual(["Administración", "Comercial"]);
    expect(groups[0].positions).toHaveLength(2);
  });
});
