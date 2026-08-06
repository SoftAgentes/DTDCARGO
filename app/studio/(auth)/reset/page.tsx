/**
 * Pantalla de "crea tu contraseña" del Studio (SDD-0250).
 *
 * Se llega acá SÓLO con una sesión de recuperación viva, que abre
 * `/studio/reset/confirmar` al canjear el token del correo. Si alguien entra
 * directo sin esa sesión, lo mandamos al login: sin sesión, `updateUser` no
 * podría hacer nada de todas formas, y es mejor decirlo antes que después.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = {
  title: "Crea tu contraseña · Studio",
  robots: { index: false, follow: false },
};

export default async function ResetPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/studio/login?error=enlace");
  }

  return <ResetForm email={data.user.email ?? ""} />;
}
