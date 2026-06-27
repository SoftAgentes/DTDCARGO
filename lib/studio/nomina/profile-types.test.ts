import { describe, it, expect } from "vitest";
import {
  validateEmployeeProfileInput,
  EMPLOYEE_EDITABLE_FIELDS,
  EMPLOYEE_READONLY_FIELDS,
  isEmployeeEditableField,
  bankDataChanged,
} from "./profile-types";

describe("profile allowlist · invariante de seguridad", () => {
  it("EMPLOYEE_EDITABLE_FIELDS = phone/email/bank_* y NADA más sensible", () => {
    expect([...EMPLOYEE_EDITABLE_FIELDS]).toEqual([
      "phone",
      "email",
      "bank_name",
      "bank_account_type",
      "bank_account",
    ]);
  });

  it("los campos de dinero/empresa están en READONLY, nunca en EDITABLE", () => {
    for (const f of ["salary_usd", "position_label", "status", "national_id", "full_name", "hire_date"]) {
      expect(EMPLOYEE_READONLY_FIELDS).toContain(f);
      expect(EMPLOYEE_EDITABLE_FIELDS as readonly string[]).not.toContain(f);
    }
  });

  it("editable y readonly no se solapan", () => {
    for (const f of EMPLOYEE_EDITABLE_FIELDS) {
      expect(EMPLOYEE_READONLY_FIELDS as readonly string[]).not.toContain(f);
    }
  });

  it("isEmployeeEditableField", () => {
    expect(isEmployeeEditableField("phone")).toBe(true);
    expect(isEmployeeEditableField("salary_usd")).toBe(false);
  });
});

describe("validateEmployeeProfileInput · descarta campos fuera del allowlist", () => {
  it("ignora salary_usd/cargo/status aunque vengan en el FormData (allowlist)", () => {
    const { input, fieldErrors } = validateEmployeeProfileInput({
      phone: "+58 412 000 0000",
      email: "yo@correo.com",
      // intento de escalación: estos NO deben aparecer en el input:
      salary_usd: "999999",
      position_label: "Gerente General",
      status: "egresado",
      national_id: "V-9.999.999",
      full_name: "Otro Nombre",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).not.toBeNull();
    // El input devuelto SOLO tiene las claves del allowlist.
    expect(Object.keys(input!).sort()).toEqual(
      ["bank_account", "bank_account_type", "bank_name", "email", "phone"].sort(),
    );
    // Y no hay forma de que un valor sensible se cuele.
    expect((input as Record<string, unknown>).salary_usd).toBeUndefined();
    expect((input as Record<string, unknown>).position_label).toBeUndefined();
    expect((input as Record<string, unknown>).status).toBeUndefined();
  });

  it("normaliza el email a minúsculas", () => {
    const { input } = validateEmployeeProfileInput({ email: "YO@Correo.COM" });
    expect(input!.email).toBe("yo@correo.com");
  });

  it("rechaza email inválido", () => {
    const { fieldErrors } = validateEmployeeProfileInput({ email: "no-es-correo" });
    expect(fieldErrors?.email).toBeTruthy();
  });

  it("rechaza tipo de cuenta inválido", () => {
    const { fieldErrors } = validateEmployeeProfileInput({ bank_account_type: "cripto" });
    expect(fieldErrors?.bank_account_type).toBeTruthy();
  });

  it("acepta vacío (sin cambios) sin error", () => {
    const { input, fieldErrors } = validateEmployeeProfileInput({});
    expect(fieldErrors).toBeUndefined();
    expect(input).toEqual({
      phone: null,
      email: null,
      bank_name: null,
      bank_account_type: null,
      bank_account: null,
    });
  });
});

describe("bankDataChanged · gatilla staging solo si cambió", () => {
  const current = { bank_name: "Banesco", bank_account_type: "corriente", bank_account: "0134..." };

  it("false si todo igual", () => {
    expect(
      bankDataChanged(
        { bank_name: "Banesco", bank_account_type: "corriente", bank_account: "0134..." },
        current,
      ),
    ).toBe(false);
  });

  it("true si cambia la cuenta", () => {
    expect(
      bankDataChanged(
        { bank_name: "Banesco", bank_account_type: "corriente", bank_account: "0102-NUEVA" },
        current,
      ),
    ).toBe(true);
  });

  it("true si cambia el banco", () => {
    expect(
      bankDataChanged(
        { bank_name: "Mercantil", bank_account_type: "corriente", bank_account: "0134..." },
        current,
      ),
    ).toBe(true);
  });

  it("ignora espacios al comparar", () => {
    expect(
      bankDataChanged(
        { bank_name: " Banesco ", bank_account_type: "corriente", bank_account: "0134..." },
        current,
      ),
    ).toBe(false);
  });
});
