import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Acceder" };

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  // Si ya hay sesión vinculada a un cliente → directo al portal.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const client = await getPortalClient(supabase);
    if (client) redirect("/portal");
  }

  const notice =
    sp.status === "nohabilitado"
      ? "Iniciaste sesión, pero ese email todavía no tiene el portal habilitado. Pídele a tu asesor que te invite."
      : sp.error === "expired"
        ? "El enlace venció o ya se usó. Pide uno nuevo."
        : sp.error === "link"
          ? "Ese enlace no es válido. Pide uno nuevo."
          : null;

  return <LoginForm notice={notice} authedNotBound={!!user} />;
}
