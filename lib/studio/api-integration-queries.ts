/**
 * API keys & webhooks (SDD-0128) — queries server-side.
 * RLS filtra por tenant. `key_hash` NUNCA se selecciona (no se expone).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiIntegrationData, ApiKey, Webhook } from "./api-integration-types";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: unknown;
  secret: string;
  active: boolean;
}

export async function getApiIntegration(
  supabase: SupabaseClient,
): Promise<ApiIntegrationData> {
  const [keysRes, hooksRes] = await Promise.all([
    supabase
      .from("api_keys")
      .select("id, name, key_prefix, last_used_at, created_at, revoked_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("webhooks")
      .select("id, name, url, events, secret, active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const apiKeys: ApiKey[] = (keysRes.data ?? []).map((r: ApiKeyRow) => ({
    id: r.id,
    name: r.name,
    keyPrefix: r.key_prefix,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  }));

  const webhooks: Webhook[] = (hooksRes.data ?? []).map((r: WebhookRow) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    events: Array.isArray(r.events) ? (r.events as string[]) : [],
    secret: r.secret,
    active: r.active,
  }));

  return { apiKeys, webhooks };
}
