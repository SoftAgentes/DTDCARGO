/**
 * SDD-0487 · Titular de la factura en el Studio.
 *
 * El sello lo hace la base (contrato 0466). Aquí se prueba la vista previa del
 * borrador —que tiene que coincidir con la regla del trigger— y qué viaja de
 * `bill_to_kind`: sin selector (sin 0466) la columna no se nombra nunca.
 */
import { describe, expect, it } from "vitest";
import {
  billToForForm,
  billToInsertPatch,
  billToUpdatePatch,
  buildInvoiceBillingOptions,
  parseBillToKind,
  resolveInvoiceTitular,
} from "../invoice-billing";

const persona = { name: "Cliente Persona A", rif: "V-12345678", doc_kind: "persona" };
const empresaIdentity = {
  kind: "empresa",
  legal_name: "Importadora Pérez C.A.",
  doc: "J-12345678-9",
  fiscal_address: "Av. Bolívar Norte, local 14, Valencia",
  is_billing_default: true,
};

describe("buildInvoiceBillingOptions + resolveInvoiceTitular (misma regla que el trigger 0466)", () => {
  it("con la empresa como preferencia, sale la empresa con su domicilio", () => {
    const billing = buildInvoiceBillingOptions(persona, empresaIdentity);
    expect(billing.preferred).toBe("empresa");
    expect(resolveInvoiceTitular(billing, null)).toMatchObject({
      kind: "empresa",
      name: "Importadora Pérez C.A.",
      doc: "J-12345678-9",
      fiscalAddress: "Av. Bolívar Norte, local 14, Valencia",
    });
  });

  it("el operador elige la persona: sale la ficha y sin domicilio", () => {
    const billing = buildInvoiceBillingOptions(persona, empresaIdentity);
    expect(resolveInvoiceTitular(billing, "persona")).toMatchObject({
      kind: "persona",
      name: "Cliente Persona A",
      doc: "V-12345678",
      fiscalAddress: null,
      principal: true,
    });
  });

  it("sin preferencia marcada manda la principal, y sin identidad no hay segunda opción", () => {
    expect(buildInvoiceBillingOptions(persona, { ...empresaIdentity, is_billing_default: false }).preferred)
      .toBe("persona");
    const sola = buildInvoiceBillingOptions(persona, null);
    expect(sola.options).toHaveLength(1);
    // Pedir la empresa sin empresa cae a la principal, como el trigger.
    expect(resolveInvoiceTitular(sola, "empresa").principal).toBe(true);
  });

  it("una cuenta de empresa con sus datos personales", () => {
    const billing = buildInvoiceBillingOptions(
      { name: "Comercial Andina C.A.", rif: "J-50123456-1", doc_kind: "empresa" },
      { kind: "persona", legal_name: "Juan Gómez", doc: "V-20000000", fiscal_address: null, is_billing_default: false },
    );
    expect(billing.options.map((o) => o.kind)).toEqual(["empresa", "persona"]);
    expect(resolveInvoiceTitular(billing, "persona")).toMatchObject({ name: "Juan Gómez", doc: "V-20000000" });
  });

  it("una identidad del mismo tipo que la principal no se ofrece", () => {
    expect(buildInvoiceBillingOptions(persona, { ...empresaIdentity, kind: "persona" }).options).toHaveLength(1);
  });
});

describe("qué viaja de bill_to_kind", () => {
  const withPicker = (value: string) => {
    const fd = new FormData();
    fd.set("bill_to_kind_present", "1");
    fd.set("bill_to_kind", value);
    return fd;
  };

  it("control: sin selector no se nombra la columna, ni al crear ni al editar", () => {
    const none = parseBillToKind(new FormData());
    expect(none).toEqual({ present: false, value: null });
    expect(billToInsertPatch(none)).toEqual({});
    expect(billToUpdatePatch(none)).toEqual({});
  });

  it("al crear sólo viaja una elección explícita", () => {
    expect(billToInsertPatch(parseBillToKind(withPicker("persona")))).toEqual({ bill_to_kind: "persona" });
    expect(billToInsertPatch(parseBillToKind(withPicker("")))).toEqual({});
  });

  it("al editar, volver a la preferencia limpia la elección", () => {
    expect(billToUpdatePatch(parseBillToKind(withPicker("")))).toEqual({ bill_to_kind: null });
    expect(billToUpdatePatch(parseBillToKind(withPicker("tercero")))).toEqual({ bill_to_kind: null });
  });

  it("el formulario manda vacío cuando la elección es la preferencia", () => {
    const billing = buildInvoiceBillingOptions(persona, empresaIdentity);
    expect(billToForForm(billing, "empresa")).toBe("");
    expect(billToForForm(billing, "persona")).toBe("persona");
  });
});
