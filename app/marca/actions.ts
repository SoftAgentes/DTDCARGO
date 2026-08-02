"use server";

/**
 * Server actions del gate de `/marca` (SDD-0238).
 *
 * Parsing manual de FormData + validador propio, sin Zod — convención del repo.
 */

import { redirect } from "next/navigation";
import { clearBrandCookie, submitBrandCode } from "@/lib/marca/access";

export type GateState = {
  error?: string;
  /** Intentos que quedan antes del próximo bloqueo. */
  attemptsLeft?: number;
  /** Epoch ms hasta el que está bloqueado, para el contador en vivo. */
  lockedUntil?: number;
};

export async function unlockBrandAction(
  _prev: GateState,
  formData: FormData,
): Promise<GateState> {
  const raw = formData.get("code");
  const code = typeof raw === "string" ? raw.trim() : "";

  // Se valida la forma acá para no gastar un intento del contador por un dedazo
  // obvio (un campo vacío o con letras no es un intento de adivinar).
  if (!/^\d{4,6}$/.test(code)) {
    return { error: "El código son 4 a 6 dígitos." };
  }

  const verdict = await submitBrandCode(code);

  switch (verdict.status) {
    case "ok":
      // `redirect()` lanza una excepción de control de Next → nunca cae al
      // siguiente case.
      redirect("/marca");
    case "locked":
      return { lockedUntil: verdict.until.getTime() };
    case "wrong":
      return {
        error:
          verdict.attemptsLeft === 1
            ? "Código incorrecto. Te queda 1 intento."
            : `Código incorrecto. Te quedan ${verdict.attemptsLeft} intentos.`,
        attemptsLeft: verdict.attemptsLeft,
      };
    case "closed":
      return {
        error:
          "El acceso al brand book está cerrado ahora mismo. Pídele a DTD Cargo un enlace nuevo.",
      };
    case "unavailable":
      return { error: "No pudimos verificar el código. Prueba de nuevo en un rato." };
  }
}

export async function lockBrandAction() {
  await clearBrandCookie();
  redirect("/marca");
}
