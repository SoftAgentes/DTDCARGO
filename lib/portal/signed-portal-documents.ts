import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { listMyDocuments } from "@/lib/portal/portal-queries";
import type { PortalDocument } from "@/lib/portal/portal-types";
import { signDocumentUrls } from "@/lib/studio/shipment-document-queries";

export type SignedPortalDocument = {
  document: PortalDocument;
  url: string | null;
};

/**
 * Relee los documentos visibles por RLS y firma exclusivamente esos paths. El
 * caller no entrega rutas ni ids; sin documentos no se construye service_role.
 */
export async function listSignedPortalDocuments(
  db: SupabaseClient,
): Promise<SignedPortalDocument[]> {
  const documents = await listMyDocuments(db);
  if (documents.length === 0) return [];

  try {
    const urls = await signDocumentUrls(
      createAdminClient(),
      documents.map((document) => document.storagePath),
    );
    return documents.map((document) => ({
      document,
      url: urls[document.storagePath] ?? null,
    }));
  } catch {
    return documents.map((document) => ({ document, url: null }));
  }
}
