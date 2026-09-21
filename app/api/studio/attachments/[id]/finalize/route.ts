/**
 * SDD-0499 · uniformidad de capas: `reserve`, `restore` y `download` ya pasaban
 * por `moduleEditDenial`/`moduleViewDenial` con "expenses"; `finalize` y
 * `reauthorize` verificaban sesión y nada más.
 *
 * No era un hueco explotable: la RPC `reauthorize_document_upload`
 * (`supabase/migrations/0309_document_reserve_finalize_rpcs.sql:114-115`) filtra
 * por `tenant_id` Y por `user_id = auth.uid()`, así que un llamador sólo alcanza
 * sus propias reservas. El gate se agrega para que las cinco rutas del recurso
 * digan lo mismo, no porque hubiera una puerta abierta.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { requireAttachmentsPilot } from "@/lib/studio/attachments/pilot-gate";
import { finalizeAttachment, reauthorizeAttachment } from "@/lib/studio/attachments/service";

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { requireAttachmentsPilot(); } catch { return NextResponse.json({ error: "Piloto inactivo." }, { status: 404 }); }
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Reserva inválida." }, { status: 400 });
  const client = await createClient();
  if (!(await client.auth.getUser()).data.user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const denial = await moduleEditDenial(client, "expenses");
  if (denial) return NextResponse.json({ error: denial }, { status: 403 });
  try {
    const reservation = await reauthorizeAttachment(client, id);
    const documentId = await finalizeAttachment(client, id, reservation.objectKey);
    return NextResponse.json({ documentId, status: "verificando" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo finalizar." }, { status: 400 });
  }
}

