"use server";

/**
 * Server actions del Bug Tracker admin (SDD-0036 Fase 3).
 *
 * Reglas:
 * - Reusa RPC bug_advance_state (validación + auto-stamp + timeline).
 * - Updates de campos editables (severity, eta_days, admin_thanks, commit_url)
 *   via UPDATE directo · RLS valida que el caller sea admin del tenant.
 * - Mensajes: insert directo · RLS valida acceso (admin del tenant del bug).
 *
 * Pattern useActionState con BugActionState shape.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import {
  validatePostBugMessageInput,
  type BugActionState,
  type BugAuthorType,
  type BugSeverity,
  type BugState,
  type PostBugMessageInput,
} from "@/lib/studio/bug-types";

// ─────────────────────────────────────────────────────────────
// Campanita in-app · marcar leído (SDD-0036 Fase 5)
// ─────────────────────────────────────────────────────────────

/**
 * Marca notificaciones in-app como leídas. Con `ids` marca esas; sin `ids`
 * marca TODAS las no-leídas del user. RLS (bug_notifications_owner_update)
 * garantiza que solo toca las propias — el `.eq(user_id)` es defensa extra.
 * Server action plana (no useActionState): se llama desde la campanita client.
 */
export async function markBugNotificationsReadAction(
  ids?: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { ok: false, error: "Inicia sesión primero." };

  let q = supabase
    .from("bug_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userResp.user.id)
    .is("read_at", null);

  if (ids && ids.length > 0) q = q.in("id", ids);

  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Advance state (admin)
// ─────────────────────────────────────────────────────────────

export async function advanceBugStateAction(
  _prev: BugActionState,
  formData: FormData,
): Promise<BugActionState> {
  const bugId = (formData.get("bug_id") as string | null)?.trim();
  const newState = formData.get("new_state") as BugState | null;
  const note = (formData.get("note") as string | null)?.trim() || null;

  if (!bugId) return { error: "Falta el ID del bug." };
  if (!newState) return { error: "Falta el estado destino." };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const { error } = await supabase.rpc("bug_advance_state", {
    p_bug_id: bugId,
    p_new_state: newState,
    p_note: note,
  });

  if (error) {
    return { error: error.message };
  }

  // SDD-0036 F5 · email notif al reportador (best-effort)
  await notifyStateChangeBestEffort(bugId, userResp.user.id);

  revalidatePath("/studio/bugs");
  revalidatePath("/studio/mis-bugs");
  return { ok: true, bugId };
}

// ─────────────────────────────────────────────────────────────
// Take bug (admin · wrapper de advance a triaje)
// ─────────────────────────────────────────────────────────────

export async function takeBugAction(
  _prev: BugActionState,
  formData: FormData,
): Promise<BugActionState> {
  const bugId = (formData.get("bug_id") as string | null)?.trim();
  if (!bugId) return { error: "Falta el ID del bug." };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const { error } = await supabase.rpc("bug_advance_state", {
    p_bug_id: bugId,
    p_new_state: "triaje",
    p_note: "Bug tomado por admin",
  });
  if (error) return { error: error.message };

  // SDD-0036 F5 · email notif al reportador (best-effort)
  await notifyStateChangeBestEffort(bugId, userResp.user.id);

  revalidatePath("/studio/bugs");
  revalidatePath("/studio/mis-bugs");
  return { ok: true, bugId };
}

// ─────────────────────────────────────────────────────────────
// Helper interno: dispara F5 email state change (best-effort).
// Usado por advanceBugStateAction y takeBugAction. No propaga errores.
// ─────────────────────────────────────────────────────────────

async function notifyStateChangeBestEffort(
  bugId: string,
  actorId: string,
): Promise<void> {
  try {
    const supabaseAdmin = createAdminClient();
    const { data: bugRow } = await supabaseAdmin
      .from("bug_reports")
      .select("id, tenant_id, folio, title, state, severity, reporter_id")
      .eq("id", bugId)
      .maybeSingle<{
        id: string;
        tenant_id: string;
        folio: string;
        title: string;
        state: string;
        severity: string | null;
        reporter_id: string;
      }>();
    if (!bugRow) return;
    const { notifyBugStateChangeToReporter } = await import(
      "@/lib/studio/bug-email-notify"
    );
    await notifyBugStateChangeToReporter(
      supabaseAdmin,
      bugRow.tenant_id,
      {
        id: bugRow.id,
        folio: bugRow.folio,
        title: bugRow.title,
        state: bugRow.state as never,
        severity: bugRow.severity as never,
        reporter_id: bugRow.reporter_id,
      },
      actorId,
    );
  } catch (err) {
    console.error("[bugs/actions] notifyStateChange failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// Update bug admin fields (severity, eta_days, admin_thanks, commit_url)
// ─────────────────────────────────────────────────────────────

export async function updateBugAdminAction(
  _prev: BugActionState,
  formData: FormData,
): Promise<BugActionState> {
  const bugId = (formData.get("bug_id") as string | null)?.trim();
  if (!bugId) return { error: "Falta el ID del bug." };

  const update: Record<string, unknown> = {};
  const severityRaw = formData.get("severity");
  if (severityRaw !== null) {
    const s = severityRaw as string;
    if (s === "" || s === "null") {
      update.severity = null;
    } else if (["baja", "media", "alta", "critica"].includes(s)) {
      update.severity = s as BugSeverity;
    } else {
      return { fieldErrors: { severity: "Severidad inválida." } };
    }
  }

  const etaRaw = formData.get("eta_days");
  if (etaRaw !== null) {
    const v = (etaRaw as string).trim();
    if (v === "") {
      update.eta_days = null;
    } else {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 365) {
        return { fieldErrors: { eta_days: "Días entre 0 y 365." } };
      }
      update.eta_days = n;
    }
  }

  const thanksRaw = formData.get("admin_thanks");
  if (thanksRaw !== null) {
    const v = (thanksRaw as string).trim();
    update.admin_thanks = v.length > 0 ? v.slice(0, 1000) : null;
  }

  const commitRaw = formData.get("commit_url");
  if (commitRaw !== null) {
    const v = (commitRaw as string).trim();
    if (v && !/^https?:\/\//.test(v)) {
      return { fieldErrors: { commit_url: "Debe ser una URL http(s)." } };
    }
    update.commit_url = v || null;
  }

  if (Object.keys(update).length === 0) {
    return { error: "Sin cambios para guardar." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("bug_reports")
    .update(update)
    .eq("id", bugId);

  if (error) {
    if (error.code === "42501") {
      return { error: "Solo admins pueden editar bugs." };
    }
    return { error: error.message };
  }

  revalidatePath("/studio/bugs");
  revalidatePath("/studio/mis-bugs");
  return { ok: true, bugId };
}

// ─────────────────────────────────────────────────────────────
// Reply message (admin o reporter)
// ─────────────────────────────────────────────────────────────

export async function replyBugMessageAction(
  _prev: BugActionState,
  formData: FormData,
): Promise<BugActionState> {
  const partial: Partial<PostBugMessageInput> = {
    bug_id: (formData.get("bug_id") as string | null)?.trim() ?? undefined,
    body: (formData.get("body") as string | null)?.trim() ?? undefined,
  };

  const { input, fieldErrors } = validatePostBugMessageInput(partial);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Mensaje inválido." };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("role")
    .maybeSingle<{ role: string }>();

  const authorType: BugAuthorType = link?.role === "admin" ? "admin" : "user";

  const { data: msg, error: msgErr } = await supabase
    .from("bug_messages")
    .insert({
      bug_id: input.bug_id,
      author_id: userResp.user.id,
      author_type: authorType,
      body: input.body,
    })
    .select("id")
    .single();

  if (msgErr) {
    return { error: msgErr.message };
  }

  // P1-3 (codex review): si el caller es reporter del bug y el bug está en
  // 'espera', auto-avanzar a 'triaje'. Esto replica el side-effect del
  // endpoint REST POST /api/studio/bugs/[id]/messages para que el flujo sea
  // consistente vengas por la API o por el Drawer (que usa esta server
  // action). D9 permite esta única excepción al "admin supervisa siempre"
  // porque destraba el bug que el admin dejó esperando.
  if (authorType === "user") {
    const { data: bugCheck } = await supabase
      .from("bug_reports")
      .select("state, reporter_id")
      .eq("id", input.bug_id)
      .maybeSingle<{ state: string; reporter_id: string }>();

    if (
      bugCheck &&
      bugCheck.state === "espera" &&
      bugCheck.reporter_id === userResp.user.id
    ) {
      await supabase.rpc("bug_advance_state", {
        p_bug_id: input.bug_id,
        p_new_state: "triaje",
        p_note: "Auto: reportador respondió",
      });
    }
  }

  // Timeline entry + SDD-0036 F5 email notif (service_role)
  try {
    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.from("bug_timeline").insert({
      bug_id: input.bug_id,
      event_type: "message",
      actor_id: userResp.user.id,
      actor_type: authorType,
      payload: { message_id: msg.id, preview: input.body.slice(0, 120) },
    });

    // Email notif al reportador cuando el admin responde desde el drawer.
    // Mirror del wire en /api/studio/bugs/[id]/messages para consistencia.
    if (authorType === "admin") {
      const { data: bugRow } = await supabaseAdmin
        .from("bug_reports")
        .select("id, tenant_id, folio, title, state, severity, reporter_id")
        .eq("id", input.bug_id)
        .maybeSingle<{
          id: string;
          tenant_id: string;
          folio: string;
          title: string;
          state: string;
          severity: string | null;
          reporter_id: string;
        }>();
      if (bugRow) {
        const { notifyBugMessageToReporter } = await import(
          "@/lib/studio/bug-email-notify"
        );
        await notifyBugMessageToReporter(
          supabaseAdmin,
          bugRow.tenant_id,
          {
            id: bugRow.id,
            folio: bugRow.folio,
            title: bugRow.title,
            state: bugRow.state as never,
            severity: bugRow.severity as never,
            reporter_id: bugRow.reporter_id,
          },
          input.body,
          userResp.user.id,
        );
      }
    }
  } catch (err) {
    console.error("[replyBugMessageAction] timeline/notify failed:", err);
  }

  revalidatePath("/studio/bugs");
  revalidatePath("/studio/mis-bugs");
  return { ok: true, bugId: input.bug_id };
}
