import { etiquetaDocumento } from "@/lib/studio/invoice-client-doc";

export type ClientBillingIdentityRow = {
  kind: string;
  legal_name: string;
  doc: string;
  fiscal_address: string | null;
  is_billing_default: boolean;
};

/**
 * SDD-0487 · Lo que el cliente cargó desde el Portal para facturar: su empresa
 * (o sus datos personales, si se registró como empresa) y a nombre de quién
 * quiere sus facturas. Sólo lectura: lo edita el cliente. El Studio puede elegir
 * otro titular en el borrador de cada factura, y la base lo sella al emitir.
 */
export function ClientBillingCard({
  principalKind,
  identity,
}: {
  principalKind: string | null;
  identity: ClientBillingIdentityRow;
}) {
  const principal = principalKind === "empresa" ? "empresa" : "persona";
  const preferred = identity.is_billing_default ? identity.kind : principal;
  const isCompany = identity.kind === "empresa";
  return (
    <section
      aria-labelledby="facturacion-cliente"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 20,
      }}
    >
      <h2 id="facturacion-cliente" className="studio-label" style={{ margin: 0 }}>
        Facturación
      </h2>
      <p style={{ margin: "var(--s-2) 0 0", fontSize: 13.5 }}>
        Factura a nombre de:{" "}
        <strong>{preferred === "empresa" ? "la empresa" : "la persona"}</strong>{" "}
        <span style={{ color: "var(--ink-soft)" }}>(preferencia del cliente)</span>
      </p>
      <dl style={{ margin: "var(--s-3) 0 0", display: "grid", gap: "var(--s-2)" }}>
        <div>
          <dt style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            {isCompany ? "Razón social" : "Nombre de la persona"}
          </dt>
          <dd style={{ margin: 0, fontWeight: 700 }}>{identity.legal_name}</dd>
        </div>
        <div>
          <dt style={{ fontSize: 12, color: "var(--ink-soft)" }}>{etiquetaDocumento(identity.kind)}</dt>
          <dd className="studio-input-mono" style={{ margin: 0 }}>{identity.doc}</dd>
        </div>
        {identity.fiscal_address ? (
          <div>
            <dt style={{ fontSize: 12, color: "var(--ink-soft)" }}>Domicilio fiscal</dt>
            <dd style={{ margin: 0 }}>{identity.fiscal_address}</dd>
          </div>
        ) : null}
      </dl>
      <p style={{ margin: "var(--s-3) 0 0", fontSize: 12.5, color: "var(--ink-soft)" }}>
        Lo carga el cliente desde su Portal. En cada borrador puedes elegir otro titular; se sella al emitir.
      </p>
    </section>
  );
}
