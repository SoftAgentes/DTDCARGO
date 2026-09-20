/**
 * SDD-0487 · Titular de la factura en el Studio.
 *
 * El titular se SELLA en la base al emitir (trigger `invoices_seal_billing_titular`,
 * migración 0466): este módulo no sella nada. Sirve para que el borrador muestre
 * a nombre de quién saldrá la factura y para que el operador elija otro titular
 * (decisión de Sam: «Sí, en el borrador»). La regla es la misma del trigger:
 *
 *   tipo = elección del borrador ?? preferencia del cliente ?? tipo principal.
 *   Si el tipo es el de la identidad secundaria, sale la secundaria; si no, la
 *   principal (la ficha del cliente).
 *
 * PURO: sin I/O. El trigger es la fuente de verdad; esto es la vista previa.
 */

export type BillingKind = "persona" | "empresa";

export type InvoiceBillingOption = {
  kind: BillingKind;
  name: string;
  doc: string | null;
  fiscalAddress: string | null;
  principal: boolean;
};

export type InvoiceBillingOptions = {
  preferred: BillingKind;
  options: InvoiceBillingOption[];
};

export function isBillingKind(value: unknown): value is BillingKind {
  return value === "persona" || value === "empresa";
}

export function buildInvoiceBillingOptions(
  client: { name: string | null; rif: string | null; doc_kind: string | null },
  identity: {
    kind: string;
    legal_name: string;
    doc: string;
    fiscal_address: string | null;
    is_billing_default: boolean;
  } | null,
): InvoiceBillingOptions {
  const principalKind: BillingKind = client.doc_kind === "empresa" ? "empresa" : "persona";
  const options: InvoiceBillingOption[] = [
    {
      kind: principalKind,
      name: (client.name ?? "").trim(),
      doc: (client.rif ?? "").trim() || null,
      fiscalAddress: null,
      principal: true,
    },
  ];
  let preferred: BillingKind = principalKind;
  if (identity && isBillingKind(identity.kind) && identity.kind !== principalKind) {
    options.push({
      kind: identity.kind,
      name: identity.legal_name,
      doc: identity.doc,
      fiscalAddress: identity.fiscal_address,
      principal: false,
    });
    if (identity.is_billing_default) preferred = identity.kind;
  }
  return { preferred, options };
}

/** Lo que el trigger sellará con esta elección (vista previa del borrador). */
export function resolveInvoiceTitular(
  billing: InvoiceBillingOptions,
  billToKind: BillingKind | null,
): InvoiceBillingOption {
  const kind = billToKind ?? billing.preferred;
  const principal = billing.options.find((o) => o.principal)!;
  return billing.options.find((o) => !o.principal && o.kind === kind) ?? principal;
}

/**
 * Valor de `bill_to_kind` que el formulario manda: vacío cuando la elección
 * coincide con la preferencia (la factura sigue la preferencia vigente al
 * emitir), el tipo cuando el operador eligió otro.
 */
export function billToForForm(billing: InvoiceBillingOptions, chosen: BillingKind): string {
  return chosen === billing.preferred ? "" : chosen;
}

/**
 * Lee `bill_to_kind` del formulario. `present` es falso si el selector no se
 * mostró (sin 0466 o sin cliente): entonces la action no toca la columna, y un
 * borrador se guarda igual que antes de esta SDD.
 */
export function parseBillToKind(formData: FormData): { present: boolean; value: BillingKind | null } {
  if (formData.get("bill_to_kind_present") !== "1") return { present: false, value: null };
  const raw = formData.get("bill_to_kind");
  return { present: true, value: isBillingKind(raw) ? raw : null };
}

/**
 * Qué viaja de `bill_to_kind` al CREAR: sólo una elección explícita. Sin
 * selector (sin 0466) no se nombra la columna y el alta sigue como antes.
 */
export function billToInsertPatch(billTo: { present: boolean; value: BillingKind | null }): {
  bill_to_kind?: BillingKind;
} {
  return billTo.present && billTo.value ? { bill_to_kind: billTo.value } : {};
}

/**
 * Qué viaja al EDITAR un borrador: con selector, la elección o null (volver a
 * la preferencia); sin selector, nada.
 */
export function billToUpdatePatch(billTo: { present: boolean; value: BillingKind | null }): {
  bill_to_kind?: BillingKind | null;
} {
  return billTo.present ? { bill_to_kind: billTo.value } : {};
}
