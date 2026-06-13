import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { socialMeta } from "@/lib/seo-og";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Registro de cliente",
  description:
    "Date de alta como cliente de DTD Cargo y obtén tu MARKBOX (shipping mark) al instante — el código que identifica tus cajas en nuestra bodega de Yiwu. Registro online en minutos; un asesor activa tu cuenta.",
  keywords: [
    "registro cliente DTD Cargo",
    "darse de alta importador China Venezuela",
    "MARKBOX shipping mark DTD",
    "abrir cuenta DTD Cargo",
  ],
  alternates: { canonical: "/registro" },
  ...socialMeta({
    title: "Registro de cliente · DTD Cargo",
    description:
      "Date de alta y obtén tu MARKBOX para empezar a importar de China con DTD Cargo.",
    path: "/registro",
  }),
};

/**
 * Registro self-service del cliente (SDD-0042 Fase 6 · unificado en /registro).
 *
 * SDD-0061 Fase B2.5: la registración real vive ACÁ — `dtdcargo.com/registro` es
 * el único punto de alta (antes el form estaba en /portal/registro y /registro
 * era marketing; se unificó por decisión founder). Es una ruta pública
 * Supabase-backed por diseño (mismo patrón que `app/invitar/`); la frontera
 * ESLint no la restringe. El alta genera MARKBOX + cuenta de portal al instante.
 *
 * Si ya hay sesión de portal → al portal. Captura `?est=EST-XXXX` (B2) para
 * vincular el estimado web al cliente al crearse.
 */
export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const client = await getPortalClient(supabase);
    if (client) redirect("/portal");
  }

  const raw = await searchParams;
  const estRaw = Array.isArray(raw.est) ? raw.est[0] : raw.est;
  const est = (estRaw ?? "").trim().slice(0, 40) || undefined;

  return (
    <>
      <Nav />
      <main className={`${jetbrainsMonoUi.variable} bg-paper min-h-screen`}>
        <RegisterForm est={est} />
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
