/**
 * SDD-0158 — Documentos de Marketing dentro del Studio.
 *
 * Lector read-only de todo `docs/marketing/` para que el equipo (y el founder)
 * NO olvide que esta documentación existe: vive en el menú del ERP, no en un
 * archivo suelto. Sin base de datos: lee los `.md` del repo y los renderiza.
 * Gate: módulo `marketing-docs` (marketing + comercial + support; admin siempre).
 */

import { requireModuleView } from "@/lib/studio/rbac-guard";
import { getMarketingDocs } from "@/lib/studio/marketing/docs-reader";
import { DocsReaderClient } from "./_components/DocsReaderClient";

export const metadata = { title: "Documentos · Marketing · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function MarketingDocsPage() {
  await requireModuleView("marketing-docs");
  const docs = getMarketingDocs();
  return <DocsReaderClient docs={docs} />;
}
