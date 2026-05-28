"use server";

/**
 * Server actions del módulo "Mis reportes" (SDD-0036 Fase 2).
 *
 * - createBugAction: invocada desde el BugReportModal (FAB).
 *   Usa useActionState pattern.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { createBugForReporter } from "@/lib/studio/bug-create";
import {
  validateCreateBugInput,
  type BugActionState,
  type BugCategory,
  type BugConsoleLogEntry,
  type BugEnvironment,
  type BugNetworkRequestEntry,
  type BugSeverity,
  type CreateBugInput,
} from "@/lib/studio/bug-types";

function parseCategory(v: FormDataEntryValue | null): BugCategory | undefined {
  const s = typeof v === "string" ? v : undefined;
  if (s === "error" || s === "improve" || s === "suggest" || s === "question") {
    return s;
  }
  return undefined;
}

function parseSeverity(v: FormDataEntryValue | null): BugSeverity | undefined {
  const s = typeof v === "string" ? v : undefined;
  if (s === "baja" || s === "media" || s === "alta" || s === "critica") {
    return s;
  }
  return undefined;
}

function parseJson<T>(v: FormDataEntryValue | null): T | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  try {
    return JSON.parse(v) as T;
  } catch {
    return undefined;
  }
}

export async function createBugAction(
  _prev: BugActionState,
  formData: FormData,
): Promise<BugActionState> {
  // Si el reporter está en zh-CN y dejó traducción al español opcional,
  // la appendeamos a la descripción con un prefijo claro para que el
  // triage VE la vea sin tener que abrir un campo extra.
  const rawDescription = (formData.get("description") as string | null) ?? "";
  const translationEs = ((formData.get("translation_es") as string | null) ?? "").trim();
  const composedDescription = translationEs
    ? `${rawDescription}\n\n--- Traducción al español ---\n${translationEs}`
    : rawDescription;

  const reporterLocale = (formData.get("reporter_locale") as string | null) || "es-VE";

  const partial: Partial<CreateBugInput> = {
    category: parseCategory(formData.get("category")),
    severity: parseSeverity(formData.get("severity")) ?? null,
    title: (formData.get("title") as string | null) ?? undefined,
    description: composedDescription,
    module: (formData.get("module") as string | null) ?? undefined,
    url: (formData.get("url") as string | null) || null,
    build_sha: (formData.get("build_sha") as string | null) || null,
    browser_info:
      parseJson<Record<string, unknown>>(formData.get("browser_info")) ?? {},
    console_logs:
      parseJson<BugConsoleLogEntry[]>(formData.get("console_logs")) ?? [],
    network_requests:
      parseJson<BugNetworkRequestEntry[]>(formData.get("network_requests")) ??
      [],
    session_replay_url:
      (formData.get("session_replay_url") as string | null) || null,
    environment: parseJson<BugEnvironment>(formData.get("environment")) ?? {},
    duplicate_hash: (formData.get("duplicate_hash") as string | null) || null,
    reporter_locale: reporterLocale,
    translation_es: translationEs || null,
  };

  const { input, fieldErrors } = validateCreateBugInput(partial);
  if (fieldErrors) return { fieldErrors, errorCode: "field_errors_present" };
  if (!input) return { errorCode: "bug_invalid_input" };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { errorCode: "auth_required" };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { errorCode: "tenant_unresolved" };

  let supabaseAdmin = null;
  try {
    supabaseAdmin = createAdminClient();
  } catch {
    // sin admin client el bug se crea igual, solo no se persisten tech_data + timeline
  }

  const result = await createBugForReporter({
    supabaseUser: supabase,
    supabaseAdmin,
    reporterId: userResp.user.id,
    tenantId: link.tenant_id,
    input,
  });

  if (!result.ok) {
    // El error string sigue como legacy (viene del INSERT a Postgres
    // con detalle específico) · sumamos errorCode genérico para que el
    // cliente lo pueda traducir si está en CN sin perder el detalle.
    return { errorCode: "bug_create_failed", error: result.error };
  }

  revalidatePath("/studio/mis-bugs");
  revalidatePath("/studio/bugs");

  return {
    ok: true,
    bugId: result.bug_id,
    folio: result.folio,
    duplicated: result.duplicated,
  };
}
