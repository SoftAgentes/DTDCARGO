import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JetBrains_Mono } from "next/font/google";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Crear cuenta" };

/**
 * JetBrains Mono — scoped al registro del portal para los códigos (MARKBOX,
 * cédula/RIF). Igual que el layout autenticado: el layout público no la carga.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/**
 * Registro self-service del Portal del Cliente (SDD-0042 Fase 6 · slice 10.1).
 *
 * El cliente se da de alta solo y obtiene su MARKBOX al instante con cuenta
 * ACTIVA (no "en revisión"). Si ya hay una sesión de portal vinculada → al portal.
 */
export default async function PortalRegisterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const client = await getPortalClient(supabase);
    if (client) redirect("/portal");
  }

  return (
    <div className={`${jetbrainsMono.variable} min-h-screen bg-paper`}>
      <RegisterForm />
    </div>
  );
}
