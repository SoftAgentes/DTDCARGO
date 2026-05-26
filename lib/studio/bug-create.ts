/**
 * Lógica core de creación de bugs · compartida entre:
 *   - POST /api/studio/bugs (route handler)
 *   - createBugAction (server action del FAB modal)
 *
 * Maneja: dedup hash check → next_bug_folio → insert bug_reports →
 * insert bug_tech_data (service_role) → insert bug_timeline (service_role).
 *
 * SDD-0036 Fase 1-2.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeBugDedupHash,
  extractStackSignature,
  type BugConsoleLogEntry,
  type BugEnvironment,
  type BugNetworkRequestEntry,
  type BugReport,
  type CreateBugInput,
} from "./bug-types";
import { findDuplicateBug } from "./bug-queries";

export type CreateBugResult =
  | {
      ok: true;
      duplicated: false;
      bug_id: string;
      folio: string;
    }
  | {
      ok: true;
      duplicated: true;
      bug_id: string;
      folio: string;
      duplicate_count: number;
    }
  | {
      ok: false;
      error: string;
      detail?: string;
    };

export async function createBugForReporter(args: {
  supabaseUser: SupabaseClient;          // cliente con cookies del user
  supabaseAdmin: SupabaseClient | null;  // service_role · null si no configurado
  reporterId: string;
  tenantId: string;
  input: CreateBugInput;
}): Promise<CreateBugResult> {
  const { supabaseUser, supabaseAdmin, reporterId, tenantId, input } = args;

  // 1. Dedup hash
  let duplicateHash = input.duplicate_hash ?? null;
  if (!duplicateHash) {
    const stackSig = extractStackSignature(input.console_logs);
    duplicateHash = await computeBugDedupHash(
      input.module,
      input.url,
      stackSig,
    );
  }

  // 2. Check dedup
  try {
    const dup = await findDuplicateBug(supabaseUser, tenantId, duplicateHash);
    if (dup) {
      const { data, error } = await supabaseUser.rpc("bug_increment_duplicate", {
        p_original_id: dup.id,
      });
      if (error) {
        return {
          ok: false,
          error: "No pudimos contabilizar el duplicado.",
          detail: error.message,
        };
      }
      const original = (data as unknown as BugReport) ?? dup;
      return {
        ok: true,
        duplicated: true,
        bug_id: original.id,
        folio: original.folio,
        duplicate_count: original.duplicate_count,
      };
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: "Error verificando duplicados.", detail };
  }

  // 3. Folio
  const { data: folioData, error: folioErr } = await supabaseUser.rpc(
    "next_bug_folio",
    { p_tenant_id: tenantId },
  );
  if (folioErr || !folioData) {
    return {
      ok: false,
      error: "No pudimos generar folio.",
      detail: folioErr?.message,
    };
  }
  const folio = folioData as unknown as string;

  // 4. Insert bug_reports (RLS valida reporter_id == auth.uid)
  const { data: insertedBug, error: insertErr } = await supabaseUser
    .from("bug_reports")
    .insert({
      tenant_id: tenantId,
      folio,
      reporter_id: reporterId,
      category: input.category,
      severity: input.severity,
      title: input.title,
      description: input.description,
      module: input.module,
      url: input.url,
      build_sha: input.build_sha,
      browser_info: input.browser_info ?? {},
      duplicate_hash: duplicateHash,
    })
    .select(
      "id, tenant_id, folio, reporter_id, category, severity, state, progress_pct, " +
        "title, description, module, url, build_sha, browser_info, duplicate_hash, " +
        "duplicate_count, duplicate_of_id, eta_days, admin_thanks, commit_url, " +
        "taken_by, taken_at, resolved_at, discarded_at, created_at, updated_at",
    )
    .single();

  if (insertErr || !insertedBug) {
    return {
      ok: false,
      error: "No pudimos crear el bug.",
      detail: insertErr?.message,
    };
  }
  const bug = insertedBug as unknown as BugReport;

  // 5. tech_data + timeline (necesitan service_role)
  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from("bug_tech_data").insert({
        bug_id: bug.id,
        console_logs: (input.console_logs ?? []) as BugConsoleLogEntry[],
        network_requests: (input.network_requests ?? []) as BugNetworkRequestEntry[],
        session_replay_url: input.session_replay_url,
        environment: (input.environment ?? {}) as BugEnvironment,
      });

      await supabaseAdmin.from("bug_timeline").insert({
        bug_id: bug.id,
        event_type: "created",
        actor_id: reporterId,
        actor_type: "user",
        payload: { category: bug.category, module: bug.module },
      });
    } catch {
      // Si falla tech_data/timeline, el bug ya fue creado · seguimos
    }
  }

  return {
    ok: true,
    duplicated: false,
    bug_id: bug.id,
    folio: bug.folio,
  };
}
