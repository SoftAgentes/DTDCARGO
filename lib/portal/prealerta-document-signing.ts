import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { listPrealertaDocuments } from "@/lib/studio/prealertas/queries";
import {
  PREALERTA_DOC_BUCKET,
  PREALERTA_DOC_TYPE_LABEL,
  type PrealertaDocument,
} from "@/lib/studio/prealertas/types";

export type SignedPrealertaDocument = {
  id: string;
  label: string;
  fileName: string;
  url: string | null;
};

function withoutUrl(doc: PrealertaDocument): SignedPrealertaDocument {
  return {
    id: doc.id,
    label: PREALERTA_DOC_TYPE_LABEL[doc.doc_type],
    fileName: doc.file_name,
    url: null,
  };
}

/**
 * Firma únicamente los paths que una consulta RLS-bound acaba de devolver para
 * la compra y Shipping Mark del principal. El caller no puede suministrar rutas
 * de Storage; si la lectura o la firma falla, conserva metadatos pero no URL.
 */
export async function listSignedPrealertaDocuments(
  db: SupabaseClient,
  opts: { tenantId: string; prealertaId: string; markbox: string },
): Promise<SignedPrealertaDocument[]> {
  const tenantId = String(opts.tenantId ?? "").trim();
  const prealertaId = String(opts.prealertaId ?? "").trim();
  const markbox = String(opts.markbox ?? "").trim();
  if (!tenantId || !prealertaId || !markbox) return [];

  const docs = await listPrealertaDocuments(db, {
    tenantId,
    prealertaId,
    markbox,
  });
  if (docs.length === 0) return [];

  try {
    const storage = createAdminClient().storage.from(PREALERTA_DOC_BUCKET);
    return await Promise.all(
      docs.map(async (doc) => {
        const { data } = await storage.createSignedUrl(doc.storage_path, 120);
        return { ...withoutUrl(doc), url: data?.signedUrl ?? null };
      }),
    );
  } catch {
    return docs.map(withoutUrl);
  }
}
