import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import { getPortalBillingContext } from "@/lib/portal/billing-profile-context";
import { secondaryKindFor } from "@/lib/portal/billing-identity";
import { BillingIdentityForm } from "./BillingIdentityForm";

export const metadata: Metadata = { title: "Mi empresa" };

/**
 * SDD-0487 · Agregar o editar la identidad secundaria: la empresa de quien se
 * registró como persona, o los datos personales de quien se registró como
 * empresa. Pantalla propia, como en el mockup aprobado por Sam. Sin la
 * migración 0466 no hay a dónde guardar: vuelve al perfil.
 */
export default async function PortalBillingIdentityPage() {
  const supabase = await createClient();
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return null;

  const billing = await getPortalBillingContext(supabase);
  if (!billing.available || !billing.profile) redirect("/portal/perfil");

  const kind = secondaryKindFor(billing.profile.principalKind);
  const current = billing.profile.secondary;
  const isCompany = kind === "empresa";
  const title = current
    ? isCompany ? "Edita tu empresa" : "Edita tus datos personales"
    : isCompany ? "Agrega tu empresa" : "Agrega tus datos personales";

  return (
    <div className="mx-auto max-w-[560px]">
      <Link
        href="/portal/perfil#empresa"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-[15px] font-bold text-ink"
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 5l-7 7 7 7" />
        </svg>
        Mi perfil
      </Link>
      <h1 className="h-display mt-3" style={{ fontSize: "clamp(26px, 4vw, 36px)" }}>
        {title}
      </h1>
      <p className="lead mt-2 max-w-[52ch]">
        {isCompany
          ? "Con estos datos te facturamos a nombre de tu empresa. Tu cuenta personal sigue igual."
          : "Con estos datos te facturamos a tu nombre. Tu cuenta de empresa sigue igual."}
      </p>
      <BillingIdentityForm kind={kind} markbox={principal.client.markbox} current={current} />
    </div>
  );
}
