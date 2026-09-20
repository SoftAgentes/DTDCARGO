import { getLabelPresentation } from "@/lib/studio/label-presentation-queries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { createAdminClient } from "@/lib/db/admin";
import { resolveBrandForClient } from "@/lib/studio/aliados/brand-resolve";
import { getPrealertaIdsByToken, getProviderShareByToken } from "@/lib/studio/prealertas/queries";
import { parseDocumentDraft, toPackingDraft } from "@/lib/shared/document-import";
import { isPackingListCurrency } from "@/lib/studio/prealertas/packlist-form";
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

  /**
   * SDD-0473 · El documento que el cliente ya cargó. La idea entera del enlace es
   * que el proveedor no transcriba lo que ya está: llega precargado y sólo
   * corrige y confirma.
   *
   * Es best-effort a propósito. Si la tabla todavía no existe, si la lectura
   * falla o si el borrador viene corrupto, el proveedor ve el formulario vacío
   * como siempre — precargar es una comodidad, nunca un requisito para poder
   * despachar. Los archivos originales del cliente NO se exponen: sólo viajan los
   * datos normalizados.
   */
  let prefill = null;
  try {
    const ids = await getPrealertaIdsByToken(admin, token);
    if (ids) {
      const { data: workspace } = await admin
        .from("document_workspaces")
        .select("draft")
        .eq("prealerta_id", ids.prealertaId)
        .eq("tenant_id", ids.tenantId)
        .maybeSingle();
      if (workspace?.draft) {
        const { rows, currency, ...cabecera } = toPackingDraft(parseDocumentDraft(workspace.draft));
        // El formulario sólo maneja USD/RMB/EUR. Si el documento trae otra moneda
        // no se fuerza ninguna: el proveedor la elige, en vez de heredar una
        // equivocada sin enterarse.
        prefill = rows?.length
          ? { ...cabecera, ...(isPackingListCurrency(currency) ? { currency } : {}), rows }
          : null;
      }
    }
  } catch {
    /* Sin documento compartido el proveedor completa a mano, como siempre. */
  }
  const labels =
    data.predeclaredBoxes.length > 0
      ? buildLabelsFromBoxes(data.code, data.predeclaredBoxes)
      : buildLabels(data.code, data.boxes);

  // Monta --font-jetbrains-mono (instancia única de lib/fonts.ts) para los
  // códigos/etiquetas en mono del share del proveedor.
  return (
    <div className={jetbrainsMonoUi.variable}>
      <ProviderShareClient
        token={token}
        code={data.code}
        markbox={data.markbox}
        supplierName={data.supplierName}
        supplierWechat={data.supplierWechat}
        labels={labels}
        prefill={prefill}
        brand={brand}
        presentation={presentation.settings}
      />
    </div>
  );
}
