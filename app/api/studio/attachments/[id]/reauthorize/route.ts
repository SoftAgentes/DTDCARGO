import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { requireAttachmentsPilot } from "@/lib/studio/attachments/pilot-gate";
import { createTusAuthorization, directTusEndpoint, reauthorizeAttachment } from "@/lib/studio/attachments/service";

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
    const signature = await createTusAuthorization(reservation.objectKey);
    return NextResponse.json({ ...reservation, endpoint: directTusEndpoint(), signature });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo reautorizar." }, { status: 400 });
  }
}
