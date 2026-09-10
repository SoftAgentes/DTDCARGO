import { RECEPTION_INSTRUCTIONS } from "@/lib/studio/prealertas/reception-instructions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { defaultAddon, psrStatusLabel } from "@/lib/studio/prealertas/addons";

export const metadata = { title: "Servicios pendientes · DTD Cargo" };

/** Existing service requests are the work queue; reception never completes them. */
export default async function ReceptionServicesPage() {
  const session = await getCurrentOperario();
  if (!session || session.region !== "cn") redirect("/m/cn");
  const admin = createAdminClient();
  const { data, error } = await admin.from("prealerta_service_requests")
    .select("id,addon_code,status,client_markbox,prealertas!inner(code)")
    .eq("tenant_id", session.tenant_id).is("deleted_at", null)
    .is("prealertas.deleted_at", null)
    .in("status", ["solicitada", "en_proceso"])
    .order("created_at", { ascending: true }).limit(100);
  return <main className="p-5" style={{ color: "var(--ink)", background: "var(--bg-base)", minHeight: "100dvh" }}>
    <Link href="/m/cn/recibir" className="underline">返回接收 · Volver a recepción</Link>
    <h1 className="text-xl font-bold mt-5">待办服务 · Servicios pendientes</h1>
    <p className="mt-3">收箱不代表已完成验货。 · Recibir las cajas no completa la revisión de artículos.</p>
    <p className="mt-2">El responsable registra los avances y resultados en Servicios de recepción del ERP. Esta lista conserva las solicitudes pendientes, incluso después de recibir la compra.</p>
    {error ? <p role="alert">No pudimos cargar los servicios. Intenta de nuevo.</p> :
      <ul className="mt-5 space-y-3">{(data ?? []).map(item => {
        const relation = item.prealertas as unknown as { code: string } | { code: string }[];
        const purchase = Array.isArray(relation) ? relation[0] : relation;
        return <li key={item.id} className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
          <strong>{defaultAddon(item.addon_code)?.label ?? item.addon_code}</strong>
          <p>{RECEPTION_INSTRUCTIONS[item.addon_code]?.zh}</p>
          <p>{RECEPTION_INSTRUCTIONS[item.addon_code]?.es}</p>
          <p>Shipping Mark: {item.client_markbox} · {purchase?.code}</p>
          <p>{psrStatusLabel(item.status)}</p>
        </li>;
      })}</ul>}
    {!error && !data?.length && <p className="mt-5">暂无待办服务 · No hay servicios pendientes.</p>}
    {data?.length === 100 && <p>Se muestran las primeras 100 solicitudes pendientes.</p>}
  </main>;
}
