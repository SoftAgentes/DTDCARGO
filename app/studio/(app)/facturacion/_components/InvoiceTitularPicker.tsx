"use client";

import { useEffect, useState } from "react";
import { lookupInvoiceBillingOptions } from "../actions";
import {
  billToForForm,
  resolveInvoiceTitular,
  type BillingKind,
  type InvoiceBillingOptions,
} from "@/lib/studio/invoice-billing";
import { etiquetaDocumento } from "@/lib/studio/invoice-client-doc";

/**
 * SDD-0487 · «Titular de la factura» en el borrador (decisión de Sam: el
 * operador puede elegir). Arranca en la preferencia del cliente o en lo que el
 * borrador ya eligió, muestra «Así sale en la factura» y manda `bill_to_kind`
 * sólo si difiere de la preferencia. El sello lo hace la base al emitir y, si
 * la elección difiere, lo audita.
 *
 * Sin 0466, o si el Shipping Mark no es de un cliente, no se muestra nada ni
 * viaja ningún campo: el borrador se guarda como antes.
 */
export function InvoiceTitularPicker({
  markbox,
  invoiceId,
}: {
  markbox: string;
  invoiceId: string | null;
}) {
  const [billing, setBilling] = useState<(InvoiceBillingOptions & { current: BillingKind | null }) | null>(null);
  const [chosen, setChosen] = useState<BillingKind | null>(null);

  useEffect(() => {
    const mb = markbox.trim();
    let alive = true;
    const t = setTimeout(async () => {
      const found = mb ? await lookupInvoiceBillingOptions(mb, invoiceId) : null;
      if (!alive) return;
      setBilling(found);
      // Si el borrador eligió una identidad que ya no existe, vuelve a la preferencia.
      const current = found?.current;
      setChosen(
        found
          ? current && found.options.some((o) => o.kind === current)
            ? current
            : found.preferred
          : null,
      );
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [markbox, invoiceId]);

  if (!billing || !chosen) return null;
  const titular = resolveInvoiceTitular(billing, chosen === billing.preferred ? null : chosen);

  return (
    <fieldset
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-4)",
        margin: 0,
      }}
    >
      <legend className="studio-label" style={{ padding: "0 var(--s-1)" }}>
        Titular de la factura
      </legend>
      <input type="hidden" name="bill_to_kind_present" value="1" />
      <input type="hidden" name="bill_to_kind" value={billToForForm(billing, chosen)} />

      <p style={{ margin: "0 0 var(--s-2)", fontSize: 12.5, color: "var(--ink-soft)" }}>
        Preferencia del cliente:{" "}
        <strong style={{ color: "var(--ink)" }}>
          {billing.preferred === "empresa" ? "Empresa" : "Persona"}
        </strong>
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
        {billing.options.map((option) => {
          const checked = chosen === option.kind;
          return (
            <label
              key={option.kind}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-3)",
                padding: "var(--s-2) var(--s-3)",
                borderRadius: "var(--r-md)",
                border: checked ? "2px solid var(--wine)" : "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="ivd-titular"
                value={option.kind}
                checked={checked}
                onChange={() => setChosen(option.kind)}
                style={{ accentColor: "var(--wine)" }}
              />
              <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14 }}>{option.name || "Sin nombre"}</span>
              <span className="studio-input-mono" style={{ fontSize: 13 }}>
                {option.doc ? `${etiquetaDocumento(option.kind)} ${option.doc}` : "Sin documento"}
              </span>
              {option.kind === billing.preferred ? (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "var(--r-pill)",
                    background: "var(--bg-elevated)",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--wine-text)",
                  }}
                >
                  Preferencia
                </span>
              ) : null}
            </label>
          );
        })}
      </div>

      <div
        role="status"
        style={{
          marginTop: "var(--s-3)",
          padding: "var(--s-3)",
          borderRadius: "var(--r-md)",
          background: "var(--bg-base)",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 800 }}>Así sale en la factura</div>
        <div style={{ fontWeight: 700 }}>{titular.name || "Sin nombre"}</div>
        {titular.doc ? (
          <div className="studio-input-mono">
            {etiquetaDocumento(titular.kind)}: {titular.doc}
          </div>
        ) : null}
        {titular.fiscalAddress ? <div style={{ color: "var(--ink-soft)" }}>{titular.fiscalAddress}</div> : null}
      </div>
      <p style={{ margin: "var(--s-2) 0 0", fontSize: 12.5, color: "var(--ink-soft)" }}>
        Se sella al emitir. Si eliges distinto a la preferencia, queda en la auditoría de la factura.
      </p>
    </fieldset>
  );
}
