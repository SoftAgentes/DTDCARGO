"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { BillingIdentity, BillingKind } from "@/lib/portal/billing-identity";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";
import { removeBillingIdentityAction, type BillingActionState } from "./billing-actions";

const initial: BillingActionState = {};

/**
 * SDD-0487 · «Mi empresa» para quien se registró como persona, o «Tus datos
 * personales» para quien se registró como empresa: la identidad SECUNDARIA con
 * la que se le puede facturar. Agregar y editar abren la pantalla
 * `/portal/perfil/empresa`; quitar pide confirmación. No gasta cupo.
 */
export function BillingIdentityCard({
  principalKind,
  secondary,
}: {
  principalKind: BillingKind;
  secondary: BillingIdentity | null;
}) {
  const [state, action, pending] = useActionState(removeBillingIdentityAction, initial);
  const [confirm, setConfirm] = useState(false);
  const isCompany = principalKind === "persona";
  const title = isCompany ? "Mi empresa" : "Tus datos personales";

  return (
    <section
      id="empresa"
      aria-labelledby="empresa-titulo"
      className="scroll-mt-24 card-shadow bg-white border border-grey-200 rounded-[18px] p-5 sm:p-8"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="empresa-titulo"
          className="flex items-center gap-2 text-[12px] font-extrabold tracking-[0.14em] uppercase text-wine-text"
        >
          {isCompany ? <BuildingIcon /> : <PersonIcon />}
          {title}
        </h2>
        {secondary ? (
          <Link
            href="/portal/perfil/empresa"
            className="inline-flex min-h-11 items-center px-3 text-[14px] font-extrabold text-wine-text hover:text-wine-deep"
          >
            Editar
          </Link>
        ) : null}
      </div>

      {secondary ? (
        <>
          <dl className="mt-3 flex flex-col">
            <Row label={isCompany ? "Razón social" : "Nombre completo"} value={secondary.legalName} />
            <Row label={isCompany ? "RIF" : "Cédula"} value={secondary.doc} mono last={!secondary.fiscalAddress} />
            {secondary.fiscalAddress ? (
              <Row label="Domicilio fiscal" value={secondary.fiscalAddress} last />
            ) : null}
          </dl>
          {!confirm ? (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="mt-2 min-h-11 px-0 text-[14px] font-semibold text-grey-700 hover:text-ink"
            >
              {isCompany ? "Quitar empresa" : "Quitar mis datos personales"}
            </button>
          ) : (
            <div className="mt-3 rounded-[12px] border border-grey-200 bg-paper p-4">
              <p className="text-[14px] font-semibold text-ink">
                {isCompany ? "¿Quitar tu empresa?" : "¿Quitar tus datos personales?"}
              </p>
              <p className="mt-1 text-[13.5px] leading-[1.5] text-grey-700">
                Tus próximas facturas saldrán a nombre de tu cuenta. Las que ya emitimos no cambian.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={action}>
                  <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
                    {pending ? "Quitando…" : "Sí, quitar"}
                  </button>
                </form>
                <button type="button" onClick={() => setConfirm(false)} className="btn btn-ghost">
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {state.error ? <PortalFieldError>{state.error}</PortalFieldError> : null}
        </>
      ) : (
        <>
          <p className="mt-4 text-[17px] font-extrabold leading-snug text-ink">
            {isCompany ? "¿Importas para tu negocio?" : "¿Quieres que te facturemos a tu nombre?"}
          </p>
          <p className="mt-1.5 text-[14.5px] leading-[1.55] text-grey-700">
            {isCompany
              ? "Agrega tu empresa y elige si te facturamos a tu nombre o al de ella. Sólo te pedimos la razón social y el RIF."
              : "Agrega tu nombre y tu cédula y elige a nombre de quién te facturamos."}
          </p>
          <Link
            href="/portal/perfil/empresa"
            className="btn btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          >
            <PlusIcon />
            {isCompany ? "Agregar empresa" : "Agregar mis datos personales"}
          </Link>
        </>
      )}
    </section>
  );
}

function Row({ label, value, mono = false, last = false }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div className={`py-3 ${last ? "" : "border-b border-grey-100"}`}>
      <dt className="text-[12px] font-bold text-grey-500">{label}</dt>
      <dd
        className="mt-1 text-[16px] font-bold text-ink break-words"
        style={mono ? { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", fontSize: 15 } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

export function BuildingIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
      <path d="M15 9h4a1 1 0 0 1 1 1v11" />
      <path d="M3 21h18" />
      <path d="M8 8h3M8 12h3M8 16h3" />
    </svg>
  );
}

export function PersonIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
