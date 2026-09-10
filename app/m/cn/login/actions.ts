"use server";

/**
 * Server actions del login del operario (SDD-0027).
 */

import { redirect } from "next/navigation";
import { signInWithPin } from "@/lib/auth/operario-session";
import type { SignInOperarioState } from "@/lib/studio/operario-types";
import { isValidPin } from "@/lib/studio/operario-types";
import { isBoxCode } from "@/lib/studio/etiquetas-qr";

export async function signInOperarioAction(
  _prev: SignInOperarioState,
  formData: FormData,
): Promise<SignInOperarioState> {
  const pin = String(formData.get("pin") ?? "").trim();

  if (!isValidPin(pin)) {
    return { error: "PIN inválido — son 4 dígitos numéricos." };
  }

  const session = await signInWithPin(pin, "cn");
  if (!session) {
    return { error: "PIN incorrecto o operario inactivo." };
  }

  // Redirect server-side (no return ok=true) para que el cliente
  // navegue después del setCookie del header.
  // Accept only a box identifier, never an arbitrary return URL.
  const boxes = formData.getAll("box");
  const box = boxes.length === 1 && typeof boxes[0] === "string" ? boxes[0].trim().toUpperCase() : "";
  redirect(isBoxCode(box) ? `/m/cn/recibir?box=${encodeURIComponent(box)}` : "/m/cn");
}
