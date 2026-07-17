/**
 * /m/cn/recibir — recepción por escaneo (SDD-0154).
 *
 * El operario escanea una etiqueta pre-declarada (DTD-B, SDD-0153) → el sistema
 * dice de quién es y cuántas cajas se anunciaron → confirma (rectificando la
 * cantidad si hace falta) → recibe. Es el flujo que el founder describió:
 * "escanean, ponen sí recibir, rectifican si las cantidades están bien".
 *
 * Server component: solo puerta de acceso (operario CN). Toda la interacción
 * vive en RecibirClient. El operario NO es `auth.users` → el gate es por cookie
 * (getCurrentOperario), no por RLS.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { LANG_COOKIE_NAME, type Lang } from "@/lib/lang";
import { RecibirClient } from "./_components/RecibirClient";

export const metadata = { title: "Recibir" };
export const dynamic = "force-dynamic";

export default async function RecibirIndexPage() {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/cn/login");
  if (operario.region !== "cn") redirect("/m/cn");

  const cookieLang = (await cookies()).get(LANG_COOKIE_NAME)?.value;
  const lang: Lang = cookieLang === "cn" ? "cn" : "es";

  return <RecibirClient initialLang={lang} />;
}
