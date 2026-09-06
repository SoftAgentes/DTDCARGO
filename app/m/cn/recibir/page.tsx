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
import Link from "next/link";
import { isBoxCode } from "@/lib/studio/etiquetas-qr";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { LANG_COOKIE_NAME, type Lang } from "@/lib/lang";
import { lookupForReceptionAction } from "./actions";
import { RecibirClient } from "./_components/RecibirClient";

export const metadata = { title: "Recibir" };
export const dynamic = "force-dynamic";

export default async function RecibirIndexPage({ searchParams }: { searchParams: Promise<{ box?: string | string[] }> }) {
  const { box: rawBox } = await searchParams;
  const box = typeof rawBox === "string" && isBoxCode(rawBox) ? rawBox.trim().toUpperCase() : "";
  const operario = await getCurrentOperario();
  if (!operario) redirect(box ? `/m/cn/login?box=${encodeURIComponent(box)}` : "/m/cn/login");
  if (operario.region !== "cn") redirect("/m/cn");

  const cookieLang = (await cookies()).get(LANG_COOKIE_NAME)?.value;
  const lang: Lang = cookieLang === "cn" ? "cn" : "es";

  let initial = null;
  if (rawBox !== undefined) {
    try {
      initial = box ? await lookupForReceptionAction(box) : { found: false as const, error: "Código de caja inválido. Escanea una etiqueta DTD-B." };
    } catch {
      initial = { found: false as const, error: "No se pudo consultar la caja. Revisa la conexión y vuelve a intentarlo." };
    }
  }
  if (initial && !initial.found) {
    return <section className="p-6 space-y-4" aria-labelledby="reception-error-title" style={{ background: "var(--bg-base)", color: "var(--ink)", minHeight: "100dvh" }}>
      <h1 id="reception-error-title" className="text-xl font-bold">{lang === "cn" ? "无法查询箱子" : "No pudimos consultar esta caja"}</h1>
      <p role="alert">{initial.error}</p>
      {lang === "cn" && <p>请重试查询，或重新扫描标签。如仍有问题，请联系仓库工作人员。</p>}
      <div className="flex flex-wrap gap-3">
        {box && <a className="studio-btn studio-btn-primary" style={{ minHeight: "var(--s-12)" }} href={`/m/cn/recibir?box=${encodeURIComponent(box)}`}>{lang === "cn" ? "重试查询" : "Reintentar consulta"}</a>}
        <Link className="studio-btn studio-btn-ghost" style={{ minHeight: "var(--s-12)" }} href="/m/cn/recibir">{lang === "cn" ? "重新扫描" : "Volver a escanear"}</Link>
      </div>
    </section>;
  }
  return <RecibirClient initialLang={lang} initialLookup={initial?.found ? initial : undefined} />;
}
