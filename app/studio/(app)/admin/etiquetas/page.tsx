import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { getLabelPresentation } from "@/lib/studio/label-presentation-queries";
import { LabelEditor } from "./LabelEditor";

export const metadata = { title: "Edición de etiquetas · Administración" };
export default async function LabelEditorPage() {
  await requireModuleView("admin");
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/studio/login");
  const { data: membership } = await db.from("user_tenants").select("tenant_id,role")
    .eq("user_id", user.id).is("disabled_at", null).limit(1).maybeSingle();
  if (!membership || membership.role !== "admin") redirect("/studio/admin");
  const current = await getLabelPresentation(db, membership.tenant_id);
  return <main className="max-w-4xl space-y-5">
    <Link href="/studio/admin" className="underline">Administración</Link>
    <h1 className="text-2xl font-bold">Edición de etiquetas</h1>
    <p>Ajusta las etiquetas de compras del portal y del proveedor y comprueba la impresión. Shipping Mark, compra, caja y QR permanecen protegidos; las etiquetas nunca muestran datos personales del cliente.</p>
    <LabelEditor initial={current.settings} version={current.version} available={current.available} />
  </main>;
}
