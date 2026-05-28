"use server";

/**
 * Server actions del selector "Modos" (Sprint D · plan v3).
 *
 * Setea la cookie `dtd_op_mode` (12h) con el rol elegido por el operario
 * multi-rol al arrancar el día. Validaciones:
 *  - Sesión activa
 *  - Region VE
 *  - El rol elegido está dentro de `session.roles`
 *  - El cookie maxAge es de 12h — al día siguiente reaparece el selector
 */

import { redirect } from "next/navigation";
import {
  clearOperarioMode,
  getCurrentOperario,
  setOperarioMode,
} from "@/lib/auth/operario-session";
import type { OperarioRole } from "@/lib/studio/operario-types";

const VALID_TARGETS: ReadonlyArray<OperarioRole> = [
  "bodeguero",
  "camionero",
  "supervisor",
  "operario",
];

export async function chooseModeAction(formData: FormData): Promise<void> {
  const session = await getCurrentOperario();
  if (!session) redirect("/m/ve/login");
  if (session.region !== "ve") redirect("/m/ve/login");

  const target = String(formData.get("mode") ?? "").trim() as OperarioRole;
  if (!VALID_TARGETS.includes(target)) {
    redirect("/m/ve/modos?error=invalid");
  }

  // Defensive: solo modos que el operario tiene autorizados (sus `roles`).
  if (!session.roles.includes(target)) {
    redirect("/m/ve/modos?error=no_permiso");
  }

  await setOperarioMode(target);

  // Redirect al destino según el modo elegido
  if (target === "camionero") {
    redirect("/m/ve/camionero");
  }
  // bodeguero / supervisor / operario → bodeguero (operan la cola)
  redirect("/m/ve/bodeguero");
}

/**
 * Limpia la cookie de modo activo y manda al selector. Invocado desde el
 * Settings menu del header (bodeguero/camionero) cuando el operario quiere
 * cambiar de rol durante el turno.
 */
export async function switchModeAction(): Promise<void> {
  const session = await getCurrentOperario();
  if (!session) redirect("/m/ve/login");
  if (session.region !== "ve") redirect("/m/ve/login");
  // Mono-rol no debería ver el botón, pero si lo dispara igual, no rompe:
  // mando al selector que va a re-redirigir al único rol disponible.
  await clearOperarioMode();
  redirect("/m/ve/modos");
}
