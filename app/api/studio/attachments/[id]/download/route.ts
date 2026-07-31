import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { requireAttachmentsPilot } from "@/lib/studio/attachments/pilot-gate";
import { authorizeAttachmentDownload } from "@/lib/studio/attachments/service";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { requireAttachmentsPilot(); } catch { return NextResponse.json({ error: "Piloto inactivo." }, { status: 404 }); }
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  const client = await createClient();
  if (!(await client.auth.getUser()).data.user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const url = await authorizeAttachmentDownload(client, id);
    return NextResponse.redirect(url, 307);
  } catch {
    return NextResponse.json({ error: "Adjunto no disponible." }, { status: 404 });
  }
}

