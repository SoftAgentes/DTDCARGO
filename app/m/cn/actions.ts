"use server";

/**
 * Server actions del home/menu del operario (SDD-0027).
 */

import { redirect } from "next/navigation";
import { signOutOperario } from "@/lib/auth/operario-session";

export async function signOutOperarioAction(): Promise<void> {
  await signOutOperario();
  redirect("/m/cn/login");
}
