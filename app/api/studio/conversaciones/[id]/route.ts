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
import { moduleViewDenial } from "@/lib/studio/rbac-guard";
import { listMessages } from "@/lib/studio/conversaciones/messages-queries";
import {
  getClientContext,
  listClientConversationDigests,
} from "@/lib/studio/conversaciones/conversations-queries";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return apiError("Falta el id de la conversación.", null, 400, "conversaciones");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const denial = await moduleViewDenial(supabase, "conversaciones");
  if (denial) return NextResponse.json({ error: denial }, { status: 403 });

  // El hilo debe ser visible para el tenant del caller (RLS).
  const { data: conv, error } = await supabase
    .from("conversations")
    .select("id, client_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; client_id: string }>();

  if (error) return apiError("No se pudo leer la conversación.", error, 500, "conversaciones");
  if (!conv) return apiError("Conversación no encontrada.", null, 404, "conversaciones");

  const [messages, context, digests] = await Promise.all([
    listMessages(supabase, id),
    // SDD-0558: el saldo se pide por el cliente del hilo, ya resuelto acá bajo
    // RLS; el id del hilo solo hace falta si el rol no ve el saldo y hay que
    // caer a la fachada de 0412.
    getClientContext(supabase, conv.client_id, conv.id),
    // Histórico de resúmenes mensuales (SDD-0149 · Fase 2).
    listClientConversationDigests(supabase, conv.client_id),
  ]);

  return NextResponse.json({ messages, context, digests });
}
