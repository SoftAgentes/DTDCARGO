/**
 * /m/ve/modos — Selector "Modos" para operarios multi-rol (Sprint D · plan v3).
 *
 * El operario que tiene 2+ roles entra acá al arrancar el día y elige qué
 * modo va a operar. La cookie `dtd_op_mode` (12h) persiste la elección
 * hasta el siguiente turno.
 *
 * Mono-rol: redirect directo al dashboard del único rol — esta página no
 * aplica (signInWithPin ya auto-setea cookie).
 *
 * Re-entrada via "Cambiar modo" desde el SettingsMenu del header del
 * bodeguero/camionero (limpia la cookie via clearOperarioMode y manda acá).
 */

import { redirect } from "next/navigation";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { ModosClient } from "./_components/ModosClient";

export const metadata = { title: "Elige tu modo del día · DTD" };
export const dynamic = "force-dynamic";

export default async function ModosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/ve/login");
  if (operario.region !== "ve") redirect("/m/ve/login");

  // Mono-rol no debería estar acá · re-dirigir a su único modo
  if (operario.roles.length <= 1) {
    const single = operario.roles[0] ?? operario.role;
    if (single === "camionero") redirect("/m/ve/camionero");
    redirect("/m/ve/bodeguero");
  }

  const { error } = await searchParams;
  const firstName =
    operario.display_name.split(/\s+/)[0] ?? operario.display_name;

  return (
    <ModosClient
      operario={{
        firstName,
        displayName: operario.display_name,
        roles: operario.roles,
      }}
      errorMsg={errorLabel(error)}
    />
  );
}

function errorLabel(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "no_permiso":
      return "Ese modo no está autorizado para tu cuenta.";
    case "invalid":
      return "Modo inválido · elige uno de los disponibles.";
    default:
      return null;
  }
}
