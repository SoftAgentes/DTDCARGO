/**
 * Lecturas de los destinos de alerta de Telegram (SDD-0271, migr 0386).
 *
 * Funciones puras que reciben el `SupabaseClient` — convención del Studio
 * (`lib/studio/<entidad>-queries.ts`). Con el cliente del usuario la RLS ya
 * limita a admin del tenant; con el `service_role` se lee todo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TelegramAlertCategory } from "./alert-routing";

export interface TelegramDestination {
  id: string;
  label: string;
  /** NULL = pendiente de enlace. Un destino pendiente no recibe nada. */
  chatId: string | null;
  /** El código de `/start <código>`. NULL una vez enlazado. */
  linkCode: string | null;
  telegramUsername: string | null;
  linkedAt: string | null;
  active: boolean;
  /** Categorías ruteadas a este destino. */
  categories: TelegramAlertCategory[];
}

interface DestinationRow {
  id: string;
  label: string;
  chat_id: string | null;
  link_code: string | null;
  telegram_username: string | null;
  linked_at: string | null;
  active: boolean;
}

interface RouteRow {
  category: TelegramAlertCategory;
  destination_id: string;
}

/**
 * Destinos del tenant con sus categorías. Dos queries en vez de un embed: el
 * embed de PostgREST devuelve el hijo como objeto o array según la cardinalidad
 * que infiera, y acá el orden de los destinos importa para la pantalla.
 */
export async function listTelegramDestinations(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<TelegramDestination[]> {
  const { data: dests, error } = await supabase
    .from("telegram_destinations")
    .select("id, label, chat_id, link_code, telegram_username, linked_at, active")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error || !dests || dests.length === 0) return [];

  const { data: routes } = await supabase
    .from("telegram_alert_routes")
    .select("category, destination_id")
    .eq("tenant_id", tenantId);

  const byDestination = new Map<string, TelegramAlertCategory[]>();
  for (const r of (routes ?? []) as RouteRow[]) {
    const list = byDestination.get(r.destination_id) ?? [];
    list.push(r.category);
    byDestination.set(r.destination_id, list);
  }

  return (dests as DestinationRow[]).map((d) => ({
    id: d.id,
    label: d.label,
    chatId: d.chat_id,
    linkCode: d.link_code,
    telegramUsername: d.telegram_username,
    linkedAt: d.linked_at,
    active: d.active,
    categories: byDestination.get(d.id) ?? [],
  }));
}

/**
 * ¿Qué categorías NO tienen ningún destino enlazado y activo? Son las que hoy
 * caen al broadcast de admins. La pantalla lo dice en voz alta: una ruta
 * configurada sobre un destino sin enlazar se ve igual que una que funciona, y
 * esa es exactamente la confusión que hace pensar que un aviso "se perdió".
 */
export function categoriesWithoutLiveDestination(
  destinations: ReadonlyArray<TelegramDestination>,
  allCategories: ReadonlyArray<TelegramAlertCategory>,
): TelegramAlertCategory[] {
  const cubiertas = new Set<TelegramAlertCategory>();
  for (const d of destinations) {
    if (!d.active || !d.chatId) continue;
    for (const c of d.categories) cubiertas.add(c);
  }
  return allCategories.filter((c) => !cubiertas.has(c));
}
