import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { requireAttachmentsPilot } from "@/lib/studio/attachments/pilot-gate";
import { isAttachmentMime } from "@/lib/studio/attachments/policy";
import { createTusAuthorization, directTusEndpoint, reserveAttachment } from "@/lib/studio/attachments/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try { requireAttachmentsPilot(); } catch { return NextResponse.json({ error: "Piloto inactivo." }, { status: 404 }); }
  const client = await createClient();
  const user = (await client.auth.getUser()).data.user;
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const denial = await moduleEditDenial(client, "expenses");
  if (denial) return NextResponse.json({ error: denial }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (
    body.entityType !== "expense" || body.folder !== "receipt"
    || typeof body.entityId !== "string" || !UUID.test(body.entityId)
    || typeof body.idempotencyKey !== "string" || !UUID.test(body.idempotencyKey)
    || typeof body.originalName !== "string"
    || typeof body.declaredMime !== "string" || !isAttachmentMime(body.declaredMime)
    || typeof body.declaredSize !== "number"
    || (body.docType !== undefined && typeof body.docType !== "string")
  ) return NextResponse.json({ error: "Solicitud de adjunto inválida." }, { status: 400 });

  try {
    const reservation = await reserveAttachment(client, {
      entityType: "expense", entityId: body.entityId, folder: "receipt",
      docType: body.docType as string | undefined, originalName: body.originalName,
      declaredMime: body.declaredMime, declaredSize: body.declaredSize,
      idempotencyKey: body.idempotencyKey,
    });
    const signature = await createTusAuthorization(reservation.objectKey);
    return NextResponse.json({ ...reservation, endpoint: directTusEndpoint(), signature }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo reservar." }, { status: 400 });
  }
}

