"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { BillingIdentity, BillingKind } from "@/lib/portal/billing-identity";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";
import { setBillingKindAction, type BillingActionState } from "./billing-actions";

const initial: BillingActionState = {};

type Option = {
  kind: BillingKind;
  title: string;
  name: string | null;
  doc: string | null;
  /** Qué falta para poder elegirla; null = disponible. */
  missing: string | null;
};

/**
 * SDD-0487 · «Facturar a nombre de». Radios en tarjetas (fieldset + legend):
 * cada opción muestra el nombre y el documento que saldrán en la factura. La
 * que no tiene datos queda deshabilitada y dice qué falta. Se guarda al elegir,
 * no gasta cupo y el resultado se anuncia con role="status".
 */
export function BillingKindSelector({
  principalKind,
  principalName,
  principalDoc,
  secondary,
  billingKind,
}: {
  principalKind: BillingKind;
  principalName: string;
  principalDoc: string | null;
  secondary: BillingIdentity | null;
  billingKind: BillingKind;
}) {
  const [state, action, pending] = useActionState(setBillingKindAction, initial);
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<BillingKind>(billingKind);
  const [announced, setAnnounced] = useState(false);
  const lastServer = useRef(billingKind);

  // Lo que dice el servidor manda: tras revalidar, o si el guardado falló.
  useEffect(() => {
    if (billingKind !== lastServer.current) {
      lastServer.current = billingKind;
      setSelected(billingKind);
    }
  }, [billingKind]);
  useEffect(() => {
    if (state.error) setSelected(lastServer.current);
  }, [state]);

  const principal: Option = {
    kind: principalKind,
    title: principalKind === "empresa" ? "A nombre de mi empresa" : "A mi nombre",
    name: principalName || null,
    doc: principalDoc,
    missing: null,
  };
  const secondaryKind: BillingKind = principalKind === "empresa" ? "persona" : "empresa";
  const other: Option = {
    kind: secondaryKind,
    title: secondaryKind === "empresa" ? "A nombre de mi empresa" : "A mi nombre",
    name: secondary?.legalName ?? null,
    doc: secondary?.doc ?? null,
    missing: secondary
      ? null
      : secondaryKind === "empresa"
        ? "Primero agrega tu empresa."
        : "Agrega tu nombre y tu cédula para usar esta opción.",
  };

  function choose(kind: BillingKind) {
    if (kind === selected || pending) return;
    setSelected(kind);
    setAnnounced(true);
    const fd = new FormData();
    fd.set("billing_kind", kind);
    startTransition(() => action(fd));
  }

  const chosen = selected === principal.kind ? principal : other;

  return (
    <section
      id="facturacion"
      aria-labelledby="facturacion-titulo"
      className="scroll-mt-24 card-shadow bg-white border border-grey-200 rounded-[18px] p-5 sm:p-8"
    >
      <div className="text-[12px] font-extrabold tracking-[0.14em] uppercase text-wine-text">Facturación</div>
      <h2
        id="facturacion-titulo"
        className="mt-2 text-[20px] sm:text-[22px] leading-tight text-ink"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        Facturar a nombre de
      </h2>

      <fieldset className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4">
        <legend className="sr-only">Facturar a nombre de</legend>
        {[principal, other].map((option) => {
          const checked = selected === option.kind;
          const disabled = option.missing != null;
          return (
            <label
              key={option.kind}
              className={`flex items-start gap-3 rounded-[12px] p-3.5 sm:p-4 ${
                disabled ? "border border-dashed border-grey-500 bg-paper" : "bg-white cursor-pointer"
              }`}
              style={
                disabled
                  ? undefined
                  : checked
                    ? { border: "2px solid var(--color-wine)" }
                    : { border: "1px solid var(--color-grey-300)" }
              }
            >
              <input
                type="radio"
                name="billing_kind"
                value={option.kind}
                checked={checked}
                disabled={disabled || pending}
                onChange={() => choose(option.kind)}
                className="mt-0.5 h-[22px] w-[22px] flex-shrink-0"
                style={{ accentColor: "var(--color-wine)" }}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={`text-[15.5px] font-extrabold ${disabled ? "text-grey-500" : "text-ink"}`}>
                  {option.title}
                </span>
                {disabled ? (
                  <span className="text-[14px] text-grey-500">{option.missing}</span>
                ) : (
                  <>
                    {option.name ? <span className="text-[14px] text-grey-700 break-words">{option.name}</span> : null}
                    {option.doc ? (
                      <span
                        className="text-[13.5px] text-grey-700"
                        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                      >
                        {option.kind === "empresa" ? `RIF ${option.doc}` : `Cédula ${option.doc}`}
                      </span>
                    ) : (
                      <span className="text-[13.5px] text-grey-500">Sin documento cargado</span>
                    )}
                  </>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>

      <p className="mt-3 text-[13.5px] leading-[1.5] text-grey-700">
        Aplica a tus próximas facturas. Las que ya emitimos no cambian. Cambiarlo no gasta cambios.
      </p>
      <p role="status" className="mt-1 min-h-[1lh] text-[13.5px] font-semibold text-ink">
        {announced && !pending && state.ok && !state.error
          ? `Listo. Tus próximas facturas salen ${chosen.kind === "empresa" ? "a nombre de tu empresa" : "a tu nombre"}.`
          : pending
            ? "Guardando…"
            : ""}
      </p>
      {state.error ? <PortalFieldError>{state.error}</PortalFieldError> : null}
    </section>
  );
}
