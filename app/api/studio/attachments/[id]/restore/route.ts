import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { requireAttachmentsPilot } from "@/lib/studio/attachments/pilot-gate";

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { requireAttachmentsPilot(); } catch { return NextResponse.json({ error: "Piloto inactivo." }, { status: 404 }); }
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  const client = await createClient();
  if (!(await client.auth.getUser()).data.user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const denial = await moduleEditDenial(client, "expenses");
  if (denial) return NextResponse.json({ error: denial }, { status: 403 });
  let body: { reason?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (typeof body.reason !== "string" || body.reason.trim().length < 8) {
    return NextResponse.json({ error: "Indica un motivo de al menos 8 caracteres." }, { status: 400 });
  }
  const { data, error } = await client.rpc("request_document_restore", {
    p_document_id: id, p_reason: body.reason.trim(),
  });
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ restoreJobId: data }, { status: 202 });
}

