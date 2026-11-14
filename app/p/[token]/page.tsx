import { getLabelPresentation } from "@/lib/studio/label-presentation-queries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { jetbrainsMonoUi,sora,nunitoSans } from "@/lib/fonts";
import { createAdminClient } from "@/lib/db/admin";
import { resolveBrandForClient } from "@/lib/studio/aliados/brand-resolve";
import { getPrealertaIdsByToken, getProviderShareByToken } from "@/lib/studio/prealertas/queries";
import { authorizeWorkspace,portalEnabled, type WorkspaceRow } from "@/lib/studio/document-import/access";
import { WORKSPACE_SELECT, projectWorkspace } from "@/lib/studio/document-import/service";
import type { DocumentWorkspace } from "@/components/document-import/document-client";
import { buildLabels, buildLabelsFromBoxes } from "@/lib/studio/prealertas/types";
import { ProviderShareClient } from "./ProviderShareClient";

export const runtime = "nodejs";

// Links privados de compartir → fuera del índice.
// SDD-0468 · Esta pestaña la ve el PROVEEDOR, no el cliente: chino primero.
// («Para tu proveedor» le hablaba al cliente desde la pantalla del proveedor.)
// El título describe ahora el documento que completa el proveedor.
export const metadata: Metadata = {
  title: "装箱单与商业发票 · Factura y packing list · DTD Cargo",
  robots: { index: false, follow: false },
};

/**
 * SDD-0057 ext · Página PÚBLICA del proveedor (`/p/{share_token}`). Sin login: el
 * proveedor chino abre el link que le pasó el cliente y se baja todo solo — la
 * dirección de la bodega CN (con el shipping mark del cliente) + las etiquetas de
 * esa compra. Bilingüe 中文/Español. (Fase 2: + template de packing list/factura.)
 *
 * Lee por `share_token` con admin client (service_role): el visitante es anónimo.
 * El token ES la capacidad; solo expone esa compra. Es una ruta pública
 * Supabase-backed (patrón /registro, /invitar) — fuera de la frontera ESLint.
 */
export default async function ProviderSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = createAdminClient();
  const data = await getProviderShareByToken(admin, token);
  if (!data) notFound();

  // SDD-0153: etiqueta escaneable por caja si la compra ya está pre-declarada;
  // si no, la etiqueta por cliente de siempre.
  // SDD-0255 · marca del cliente dueño de la compra. Esta ruta ya corre con
  // service_role (política `aliados service_role all`, migr 0362).
  const brand = await resolveBrandForClient(admin, { markbox: data.markbox });

  const presentation = await getLabelPresentation(admin, data.tenantId);

  let sharedWorkspace:DocumentWorkspace|null = null;
  let sharedUnavailable=false;
  try {
    const ids = await getPrealertaIdsByToken(admin, token);
    if (ids) {
      const { data: workspace,error } = await admin
        .from("document_workspaces")
        .select(WORKSPACE_SELECT)
        .eq("prealerta_id", ids.prealertaId)
        .eq("tenant_id", ids.tenantId)
        .maybeSingle();
      if(error&&portalEnabled())sharedUnavailable=true;
      if(workspace) {
        if(portalEnabled()){
          const row=workspace as unknown as WorkspaceRow;
          const actor=await authorizeWorkspace(admin,admin,row,new Headers({"x-supplier-token":token}));
          sharedWorkspace=projectWorkspace(row,actor);
        }
        else sharedUnavailable=true;
      }
    }
  } catch {
    if(portalEnabled())sharedUnavailable=true;
  }
  const labels =
    data.predeclaredBoxes.length > 0
      ? buildLabelsFromBoxes(data.code, data.predeclaredBoxes)
      : buildLabels(data.code, data.boxes);

  // Monta --font-jetbrains-mono (instancia única de lib/fonts.ts) para los
  // códigos/etiquetas en mono del share del proveedor.
  return (
    <div className={`${jetbrainsMonoUi.variable} ${sora.variable} ${nunitoSans.variable}`}>
      <ProviderShareClient
        token={token}
        code={data.code}
        markbox={data.markbox}
        supplierName={data.supplierName}
        supplierWechat={data.supplierWechat}
        labels={labels}
        sharedWorkspace={sharedWorkspace}
        sharedUnavailable={sharedUnavailable}
        brand={brand}
        presentation={presentation.settings}
      />
    </div>
  );
}
