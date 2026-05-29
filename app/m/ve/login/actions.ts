"use server";

/**
 * Server action del login del operario VE (SDD-0030).
 *
 * Reusa signInWithPin del SDD-0027 (cookie HTTP-only + service_role).
 * Después de validar el PIN, verifica que la session sea region='ve' y
 * redirige según role a la app correspondiente.
 */

import { redirect } from "next/navigation";
import { signInWithPin, signOutOperario } from "@/lib/auth/operario-session";
import { isValidPin, type SignInOperarioState } from "@/lib/studio/operario-types";

export async function signInOperarioVeAction(
  _prev: SignInOperarioState,
  formData: FormData,
): Promise<SignInOperarioState> {
  const pin = String(formData.get("pin") ?? "").trim();

  if (!isValidPin(pin)) {
    return { error: "PIN inválido — son 4 dígitos numéricos." };
  }

  const session = await signInWithPin(pin);
  if (!session) {
    return { error: "PIN incorrecto o operario inactivo." };
  }

  // Defensive: solo operarios VE entran a /m/ve
  if (session.region !== "ve") {
    await signOutOperario();
    return { error: "Esta app es para operarios VE. Tu cuenta es de almacén CN." };
  }

  // Sprint D (multi-rol "Modos"): si tiene más de 1 rol y NO eligió modo
  // hoy, mandarlo al selector. signInWithPin ya auto-setea current_mode si
  // es mono-rol → session.current_mode contiene el rol activo o null.
  if (session.roles.length > 1 && !session.current_mode) {
    redirect("/m/ve/modos");
  }

  // Mono-rol o multi-rol con modo persistido → ir a la app del modo activo
  const activeMode = session.current_mode ?? session.role;
  switch (activeMode) {
    case "camionero":
      redirect("/m/ve/camionero");
    case "bodeguero":
    case "supervisor":
    case "operario":
    default:
      redirect("/m/ve/bodeguero");
  }
}
