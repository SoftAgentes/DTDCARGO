"use client";

/**
 * CompanySection — sección "Datos de la empresa" del admin (SDD-0120).
 *
 * 4 tarjetas alineadas al handoff del Norte (erp/modules/admin.jsx · SectionCompany):
 *   1. Identificación fiscal + contacto  → form con save único.
 *   2. Oficinas (CN/VE)                  → lista + drawer CRUD.
 *   3. Datos bancarios                   → lista + drawer CRUD.
 *   4. Impuestos (IVA / ISLR / IGTF)     → parte del form de identidad (mismo save).
 *
 * Identidad + impuestos comparten un solo form (un botón "Guardar cambios").
 * Oficinas y bancos son 1-a-N con sus propias actions (drawers).
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { updateCompanyIdentityAction } from "../company-actions";
import { OfficeDrawer } from "./OfficeDrawer";
import { BankAccountDrawer } from "./BankAccountDrawer";
import {
  officeCountryLabel,
  bankCurrencyLabel,
  type CompanyActionState,
  type CompanyBankAccount,
  type CompanyData,
  type CompanyOffice,
} from "@/lib/studio/company-types";

const INITIAL: CompanyActionState = {};

type OfficeDrawerState = { mode: "create" | "edit"; office: CompanyOffice | null } | null;
type BankDrawerState = { mode: "create" | "edit"; account: CompanyBankAccount | null } | null;

export function CompanySection({ data }: { data: CompanyData }) {
  const toast = useToast();
  const { identity, offices, bankAccounts } = data;

  const [officeDrawer, setOfficeDrawer] = useState<OfficeDrawerState>(null);
  const [bankDrawer, setBankDrawer] = useState<BankDrawerState>(null);

  const [state, formAction, isPending] = useActionState(updateCompanyIdentityAction, INITIAL);
  const [ivaEnabled, setIvaEnabled] = useState(identity.ivaEnabled);

  const handledSave = useRef<CompanyActionState | null>(null);
  useEffect(() => {
    if (state?.ok && handledSave.current !== state) {
      handledSave.current = state;
      toast.success("Datos de la empresa guardados");
    }
  }, [state, toast]);

  const fe = state?.fieldErrors ?? {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Form identidad + impuestos (save único) ── */}
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* 1. Identificación fiscal */}
        <Card>
          <CardEyebrow>Identificación fiscal</CardEyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Razón social" name="legal_name" defaultValue={identity.legalName} placeholder="DTD Cargo CA" error={fe.legal_name} />
            <Field label="RIF" name="rif" defaultValue={identity.rif} placeholder="J-30182554-9" mono error={fe.rif} />
            <Field label="Nombre comercial" name="trade_name" defaultValue={identity.tradeName} placeholder="DTD Cargo" />
            <Field label="Email comercial" name="commercial_email" defaultValue={identity.commercialEmail} placeholder="comercial@dtdcargo.com" error={fe.commercial_email} />
          </div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Teléfono" name="phone" defaultValue={identity.phone} placeholder="+58 241 414 7886" mono />
            <Field label="WhatsApp Business" name="whatsapp" defaultValue={identity.whatsapp} placeholder="+58 412 166 8021" mono />
            <Field label="Sitio web" name="website" defaultValue={identity.website} placeholder="dtdcargo.com" mono />
          </div>
        </Card>

        {/* 4. Impuestos (mismo form) */}
        <Card>
          <CardEyebrow>Impuestos</CardEyebrow>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
              font: "600 12.5px/1 var(--f-sans)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="iva_enabled"
              checked={ivaEnabled}
              onChange={(e) => setIvaEnabled(e.target.checked)}
              style={{ accentColor: "var(--wine)" }}
            />
            <span>IVA activo en facturación</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <Field label="IVA (%)" name="iva_rate" defaultValue={String(identity.ivaRate)} mono error={fe.iva_rate} />
            <Field label="ISLR retención (%)" name="islr_rate" defaultValue={String(identity.islrRate)} mono error={fe.islr_rate} />
            <Field label="IGTF (%)" name="igtf_rate" defaultValue={String(identity.igtfRate)} mono error={fe.igtf_rate} />
          </div>
        </Card>

        {state?.error && (
          <div
            style={{
              padding: 12,
              background: "var(--danger-bg)",
              color: "var(--danger)",
              borderRadius: "var(--r-md)",
              font: "600 13px/1.3 var(--f-sans)",
            }}
          >
            {state.error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" className="studio-btn studio-btn-primary" disabled={isPending}>
            {isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>

      {/* 2. Oficinas */}
      <Card>
        <CardEyebrow>Oficinas</CardEyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {offices.length === 0 && (
            <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
              Todavía no hay oficinas cargadas.
            </p>
          )}
          {offices.map((o) => (
            <div
              key={o.id}
              style={{
                display: "grid",
                gridTemplateColumns: "72px 1fr 80px",
                gap: 14,
                padding: "10px 12px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-md)",
                alignItems: "center",
              }}
            >
              <Badge tone={o.country === "VE" ? "wine" : "info"} size="sm">
                {officeCountryLabel(o.country)}
              </Badge>
              <div>
                <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>{o.name}</div>
                <div style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>{o.address}</div>
              </div>
              <button
                type="button"
                onClick={() => setOfficeDrawer({ mode: "edit", office: o })}
                style={editLinkStyle}
              >
                Editar →
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setOfficeDrawer({ mode: "create", office: null })} style={addRowStyle}>
            + Agregar oficina
          </button>
        </div>
      </Card>

      {/* 3. Datos bancarios */}
      <Card>
        <CardEyebrow>Datos bancarios (aparecen en facturas)</CardEyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bankAccounts.length === 0 && (
            <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
              Todavía no hay cuentas bancarias cargadas.
            </p>
          )}
          {bankAccounts.map((b) => (
            <div
              key={b.id}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 160px 1fr 80px",
                gap: 14,
                padding: "10px 12px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-md)",
                alignItems: "center",
              }}
            >
              <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>{b.bankName}</div>
              <Badge tone="info" size="sm">
                {b.accountType} · {bankCurrencyLabel(b.currency).split(" · ")[1] ?? b.currency}
              </Badge>
              <code style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)" }}>{b.accountNumber}</code>
              <button
                type="button"
                onClick={() => setBankDrawer({ mode: "edit", account: b })}
                style={editLinkStyle}
              >
                Editar →
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setBankDrawer({ mode: "create", account: null })} style={addRowStyle}>
            + Agregar cuenta bancaria
          </button>
        </div>
      </Card>

      {officeDrawer && (
        <OfficeDrawer
          mode={officeDrawer.mode}
          office={officeDrawer.office}
          onClose={() => setOfficeDrawer(null)}
          onSaved={(msg) => toast.success(msg)}
        />
      )}
      {bankDrawer && (
        <BankAccountDrawer
          mode={bankDrawer.mode}
          account={bankDrawer.account}
          onClose={() => setBankDrawer(null)}
          onSaved={(msg) => toast.success(msg)}
        />
      )}
    </div>
  );
}

// ── Primitivas locales ────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "22px 24px",
      }}
    >
      {children}
    </section>
  );
}

function CardEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="studio-eyebrow"
      style={{ color: "var(--wine)", marginBottom: 14 }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  mono,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  mono?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="studio-label" htmlFor={`co-${name}`}>
        {label}
      </label>
      <input
        id={`co-${name}`}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`studio-input${mono ? " studio-input-mono" : ""}`}
        style={{ marginTop: 6 }}
      />
      {error && (
        <p style={{ font: "600 11px/1.3 var(--f-sans)", color: "var(--danger)", margin: "6px 0 0" }}>{error}</p>
      )}
    </div>
  );
}

const editLinkStyle: React.CSSProperties = {
  font: "600 11.5px/1 var(--f-sans)",
  color: "var(--wine)",
  justifySelf: "end",
  background: "transparent",
  border: 0,
  cursor: "pointer",
};

const addRowStyle: React.CSSProperties = {
  padding: 12,
  font: "600 12.5px/1 var(--f-sans)",
  color: "var(--ink-soft)",
  border: "1px dashed var(--border-strong)",
  borderRadius: "var(--r-md)",
  textAlign: "center",
  background: "transparent",
  cursor: "pointer",
};
