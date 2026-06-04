/**
 * GET /api/studio/conversaciones/[id] — hilo + contexto del cliente (SDD-0056).
 *
 * Devuelve los mensajes de una conversación + el contexto del cliente (MARKBOX,
 * envíos activos, saldo CxC) para el panel del hilo. Lazy: la bandeja lo pide
 * cuando se selecciona una conversación (evita N+1 en el server render de la lista).
 *
 * Route fino: sin lógica de negocio (delega en las queries). RLS filtra por
 * tenant; si la conversación es de otro tenant, las queries devuelven vacío.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { apiError } from "@/lib/http/api-error";
import { listMessages } from "@/lib/studio/conversaciones/messages-queries";
import { getClientContext } from "@/lib/studio/conversaciones/conversations-queries";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return apiError("Falta el id de la conversación.", null, 400, "conversaciones");

  const supabase = await createClient();

  // El hilo debe ser visible para el tenant del caller (RLS).
  const { data: conv, error } = await supabase
    .from("conversations")
    .select("id, client_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; client_id: string }>();

  if (error) return apiError("No se pudo leer la conversación.", error, 500, "conversaciones");
  if (!conv) return apiError("Conversación no encontrada.", null, 404, "conversaciones");

  const [messages, context] = await Promise.all([
    listMessages(supabase, id),
    getClientContext(supabase, conv.client_id),
  ]);

  return NextResponse.json({ messages, context });
}
