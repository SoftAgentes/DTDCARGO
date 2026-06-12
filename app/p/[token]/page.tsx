import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { createAdminClient } from "@/lib/db/admin";
import { getProviderShareByToken } from "@/lib/studio/prealertas/queries";
import { buildLabels } from "@/lib/studio/prealertas/types";
import { ProviderShareClient } from "./ProviderShareClient";

export const runtime = "nodejs";

// Links privados de compartir → fuera del índice.
export const metadata: Metadata = {
  title: "Para tu proveedor · DTD Cargo",
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

  const labels = buildLabels(data.code, data.boxes);

  // Monta --font-jetbrains-mono (instancia única de lib/fonts.ts) para los
  // códigos/etiquetas en mono del share del proveedor.
  return (
    <div className={jetbrainsMonoUi.variable}>
      <ProviderShareClient
        token={token}
        code={data.code}
        description={data.description}
        markbox={data.markbox}
        clientName={data.clientName}
        supplierName={data.supplierName}
        labels={labels}
      />
    </div>
  );
}
