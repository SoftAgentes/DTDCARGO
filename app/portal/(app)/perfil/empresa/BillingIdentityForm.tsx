"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { BillingIdentity, BillingKind } from "@/lib/portal/billing-identity";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";
import { saveBillingIdentityAction, type BillingActionState } from "../billing-actions";

const initial: BillingActionState = {};

/**
 * SDD-0487 · Formulario de la identidad secundaria (mockup aprobado: pantalla
 * propia en el teléfono). Empresa: razón social y RIF obligatorios, domicilio
 * fiscal opcional. Persona: nombre y cédula. Al guardar vuelve al perfil, que
 * anuncia el resultado. Lo escrito se conserva ante un error.
 */
export function BillingIdentityForm({
  kind,
  markbox,
  current,
}: {
  kind: BillingKind;
  markbox: string;
  current: BillingIdentity | null;
}) {
  const [state, action, pending] = useActionState(saveBillingIdentityAction, initial);
  const router = useRouter();
  const isCompany = kind === "empresa";
  const mode = current ? "edit" : "add";
  // Controlados: React 19 resetea los campos no controlados al terminar la
  // action, y lo escrito tiene que sobrevivir a un error.
  const [legalName, setLegalName] = useState(current?.legalName ?? "");
  const [doc, setDoc] = useState(current?.doc ?? "");
  const [fiscalAddress, setFiscalAddress] = useState(current?.fiscalAddress ?? "");
  const [setDefault, setSetDefault] = useState(true);

  useEffect(() => {
    if (state.ok) router.push(`/portal/perfil?guardado=${isCompany ? "empresa" : "persona"}#facturacion`);
  }, [state.ok, isCompany, router]);

  const err = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="mt-6 flex flex-col gap-5">
      <input type="hidden" name="mode" value={mode} />
      {state.error ? <PortalFieldError nivel="formulario">{state.error}</PortalFieldError> : null}

      <Field
        id="legal_name"
        label={isCompany ? "Razón social" : "Nombre completo"}
        hint={isCompany ? "Tal como aparece en el RIF." : "Tal como aparece en tu cédula."}
        error={err.legalName}
      >
        <input
          id="legal_name"
          name="legal_name"
          type="text"
          required
          autoComplete={isCompany ? "organization" : "name"}
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder={isCompany ? "Importadora Pérez C.A." : "Carlos Pérez"}
          aria-invalid={err.legalName ? true : undefined}
          aria-describedby={`legal_name-hint${err.legalName ? " legal_name-error" : ""}`}
          className="h-12 w-full rounded-[10px] border border-grey-500 bg-white px-3.5 text-[16px] font-semibold text-ink"
        />
      </Field>

      <Field
        id="doc"
        label={isCompany ? "RIF" : "Cédula"}
        hint={isCompany ? "Letra, 8 números y el dígito final. Con o sin guiones." : "Ej.: V-12345678. Con o sin guion."}
        error={err.doc}
      >
        <input
          id="doc"
          name="doc"
          type="text"
          required
          autoCapitalize="characters"
          autoComplete="off"
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
          placeholder={isCompany ? "J-12345678-9" : "V-12345678"}
          aria-invalid={err.doc ? true : undefined}
          aria-describedby={`doc-hint${err.doc ? " doc-error" : ""}`}
          className="h-12 w-full rounded-[10px] border border-grey-500 bg-white px-3.5 text-[16px] font-semibold text-ink"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        />
      </Field>

      {isCompany ? (
        <Field
          id="fiscal_address"
          label="Domicilio fiscal"
          optional
          hint="Si lo cargas, sale impreso en tus facturas."
          error={err.fiscalAddress}
        >
          <textarea
            id="fiscal_address"
            name="fiscal_address"
            rows={3}
            value={fiscalAddress}
            onChange={(e) => setFiscalAddress(e.target.value)}
            placeholder="Av. Bolívar Norte, C.C. Camoruco, local 14, Valencia"
            aria-invalid={err.fiscalAddress ? true : undefined}
            aria-describedby={`fiscal_address-hint${err.fiscalAddress ? " fiscal_address-error" : ""}`}
            className="w-full resize-none rounded-[10px] border border-grey-500 bg-white px-3.5 py-3 text-[16px] font-semibold text-ink"
          />
        </Field>
      ) : null}

      {mode === "add" ? (
        <label className="flex min-h-11 items-start gap-3 rounded-[12px] border border-grey-200 bg-white p-3.5">
          <input
            type="checkbox"
            name="set_default"
            checked={setDefault}
            onChange={(e) => setSetDefault(e.target.checked)}
            className="mt-0.5 h-[22px] w-[22px] flex-shrink-0"
            style={{ accentColor: "var(--color-wine)" }}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-extrabold text-ink">
              {isCompany ? "Facturar a nombre de esta empresa" : "Facturar a mi nombre"}
            </span>
            <span className="text-[13.5px] text-grey-700">
              Lo puedes cambiar cuando quieras en «Facturar a nombre de».
            </span>
          </span>
        </label>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-[12px] bg-grey-100 p-3.5">
        <span className="mt-0.5 flex-shrink-0 text-ink" aria-hidden>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
            <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" />
          </svg>
        </span>
        <p className="text-[13.5px] leading-[1.5] text-grey-700">
          Tu Shipping Mark{" "}
          <code className="font-semibold text-ink" style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}>
            {markbox}
          </code>{" "}
          no cambia. Las facturas ya emitidas tampoco. Esto no gasta tus cambios de perfil.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-end">
        <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary w-full sm:w-auto disabled:opacity-60">
          {pending ? "Guardando…" : isCompany ? "Guardar empresa" : "Guardar mis datos"}
        </button>
        <Link href="/portal/perfil#empresa" className="btn btn-ghost inline-flex w-full items-center justify-center sm:w-auto">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  optional = false,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14.5px] font-extrabold text-ink">
        {label}{" "}
        {optional ? (
          <span className="font-semibold text-grey-500">(opcional)</span>
        ) : (
          <span className="text-wine-text" aria-hidden>*</span>
        )}
      </label>
      {children}
      <span id={`${id}-hint`} className="text-[13px] text-grey-500">{hint}</span>
      {error ? <PortalFieldError id={`${id}-error`}>{error}</PortalFieldError> : null}
    </div>
  );
}
