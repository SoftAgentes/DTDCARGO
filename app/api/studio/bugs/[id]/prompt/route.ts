/**
 * /api/studio/bugs/[id]/prompt · GET
 *
 * Genera un prompt en texto plano (markdown) listo para pegar en Claude Code.
 * Incluye: folio + título + descripción + categoría + módulo + URL +
 * console logs + network requests + environment + replay URL.
 *
 * Solo admin del tenant del bug. Reporter no debería ver esto.
 *
 * SDD-0036 Fase 1.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import {
  getBugDetail,
  getBugTechData,
  listBugMessages,
} from "@/lib/studio/bug-queries";
import {
  BUG_CATEGORY_LABELS,
  BUG_STATE_LABELS,
  BUG_SEVERITY_LABELS,
} from "@/lib/studio/bug-types";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // P1-2 (codex review): cargar bug primero, despues validar que el caller
  // sea admin DEL TENANT DEL BUG. La version anterior validaba role global
  // sin tenant scope, permitiendo a un admin de otro tenant (que tenga
  // acceso al bug como reporter via RLS) generar el prompt cross-tenant.
  const bug = await getBugDetail(supabase, id);
  if (!bug) {
    return NextResponse.json({ error: "Bug no encontrado." }, { status: 404 });
  }

  const { data: tenantLink } = await supabase
    .from("user_tenants")
    .select("role")
    .eq("user_id", userResp.user.id)
    .eq("tenant_id", bug.tenant_id)
    .is("disabled_at", null)
    .maybeSingle<{ role: string }>();

  if (tenantLink?.role !== "admin") {
    return NextResponse.json(
      { error: "Solo admins del tenant del bug pueden generar el prompt." },
      { status: 403 },
    );
  }

  const [techData, messages] = await Promise.all([
    getBugTechData(supabase, id),
    listBugMessages(supabase, id),
  ]);

  const lines: string[] = [];

  lines.push(`# Bug ${bug.folio} · ${BUG_CATEGORY_LABELS[bug.category]}`);
  if (bug.severity) lines.push(`**Severidad:** ${BUG_SEVERITY_LABELS[bug.severity]}`);
  lines.push(`**Estado:** ${BUG_STATE_LABELS[bug.state]} (${bug.progress_pct}%)`);
  lines.push(`**Módulo:** \`${bug.module}\``);
  if (bug.url) lines.push(`**URL:** ${bug.url}`);
  if (bug.build_sha) lines.push(`**Build:** \`${bug.build_sha}\``);
  lines.push("");
  lines.push(`## Título`);
  lines.push(bug.title);
  lines.push("");
  lines.push(`## Descripción del reportador`);
  lines.push(bug.description);
  lines.push("");

  // Conversación
  if (messages.length > 0) {
    lines.push(`## Conversación`);
    for (const m of messages) {
      lines.push(`**[${m.author_type}]** ${m.body}`);
    }
    lines.push("");
  }

  // Tech data
  if (techData) {
    if (techData.environment && Object.keys(techData.environment).length > 0) {
      lines.push(`## Environment`);
      lines.push("```json");
      lines.push(JSON.stringify(techData.environment, null, 2));
      lines.push("```");
      lines.push("");
    }

    if (techData.console_logs && techData.console_logs.length > 0) {
      lines.push(`## Console logs (últimos ${techData.console_logs.length})`);
      for (const log of techData.console_logs) {
        lines.push(`### [${log.level}] ${log.ts}`);
        lines.push(log.message);
        if (log.stack) {
          lines.push("```");
          lines.push(log.stack);
          lines.push("```");
        }
      }
      lines.push("");
    }

    if (techData.network_requests && techData.network_requests.length > 0) {
      lines.push(`## Network requests (últimos ${techData.network_requests.length})`);
      lines.push("| Method | URL | Status | ms |");
      lines.push("|--------|-----|--------|----|");
      for (const r of techData.network_requests) {
        lines.push(`| ${r.method} | ${r.url} | ${r.status} | ${r.ms} |`);
      }
      lines.push("");
    }

    if (techData.session_replay_url) {
      lines.push(`## Session replay`);
      lines.push(`${techData.session_replay_url}`);
      lines.push("");
    }
  }

  // Footer
  lines.push(`---`);
  lines.push(
    `**Tarea:** investigá este bug y proponé un fix. El admin (humano) revisa tu propuesta antes de aplicarla y decide cuándo cerrar el bug manualmente en /studio/bugs. NO hay cierre automático.`,
  );
  lines.push(``);
  lines.push(
    `**Convención de commit cuando el fix se apruebe:** \`fix: ${bug.folio} — <resumen>\` (queda como trazabilidad, no dispara nada automático).`,
  );

  const prompt = lines.join("\n");

  // Devolvemos también texto plano si el caller lo pide (Accept: text/plain)
  return NextResponse.json({ prompt });
}
