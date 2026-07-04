/**
 * Server actions de Bitácora (SDD-0146 · Fase 1).
 *
 *  - createTaskAction   · tarea manual: dueño único opcional del pool +
 *                         assigned_role opcional (cola) + checklist inicial.
 *  - updateTaskAction   · edita meta + dueño/cola desde el drawer.
 *  - moveTaskAction     · cambia estado (los 4; sin máquina server — el
 *                         trigger de la DB fija/limpia completed_at).
 *  - toggleChecklistItemAction / addChecklistItemAction.
 *  - reassignTaskAction · cambia el dueño (o lo quita).
 *  - takeTaskAction     · "Tomar tarea" de la cola del rol → te asignas tú
 *                         y se limpia assigned_role.
 *
 * Toda mutación pasa moduleEditDenial PRIMERO (SDD-0085): las server actions
 * son invocables directo como un endpoint → validan su propio permiso
 * (support = read-only). Sin soft-delete: el spec no define deleted_at en
 * bitacora_tasks — el ciclo de vida vive en `estado` (DELETE using(false)).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  isBitacoraTaskEstado,
  validateBitacoraTaskInput,
  validateMeetingDraftInput,
  validateConfirmActaInput,
  type BitacoraActionState,
  type ConfirmActaInput,
  type MeetingDraftInput,
} from "@/lib/studio/bitacora/bitacora-types";
import { listAssignableProfiles } from "@/lib/studio/bitacora/bitacora-queries";
import { extractActa } from "@/lib/studio/bitacora/extract";
import { resolveActa, type ResolvedActa } from "@/lib/studio/bitacora/match";
import {
  caracasWeekdayLabel,
  todayCaracasISO,
} from "@/lib/studio/bitacora/dates";

const MODULE_ID = "bitacora";

type StudioClient = Awaited<ReturnType<typeof createClient>>;

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function taskInputFromFormData(formData: FormData) {
  return {
    titulo: strOrNull(formData.get("titulo")) ?? "",
    descripcion: strOrNull(formData.get("descripcion")) ?? "",
    prioridad: strOrNull(formData.get("prioridad")) ?? "",
    tipo: strOrNull(formData.get("tipo")) ?? "",
    due_date: strOrNull(formData.get("due_date")) ?? "",
    assignee_id: strOrNull(formData.get("assignee_id")) ?? "",
    assigned_role: strOrNull(formData.get("assigned_role")) ?? "",
    para_agente: formData.get("para_agente"),
  };
}

async function resolveContext(supabase: StudioClient): Promise<
  | { tenantId: string; userId: string }
  | { error: string }
> {
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Sesión expirada." };
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };
  return { tenantId: link.tenant_id, userId: userResp.user.id };
}

function revalidateBitacora() {
  revalidatePath("/studio/bitacora");
  revalidatePath("/m/erp/bitacora");
  revalidatePath("/m/erp");
}

// ─── Crear tarea manual ──────────────────────────────────────

export async function createTaskAction(
  _prev: BitacoraActionState,
  formData: FormData,
): Promise<BitacoraActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateBitacoraTaskInput(
    taskInputFromFormData(formData),
  );
  if (fieldErrors || !input) return { fieldErrors };

  const ctx = await resolveContext(supabase);
  if ("error" in ctx) return { error: ctx.error };

  const { data: created, error } = await supabase
    .from("bitacora_tasks")
    .insert({
      tenant_id: ctx.tenantId,
      titulo: input.titulo,
      descripcion: input.descripcion,
      prioridad: input.prioridad,
      tipo: input.tipo,
      due_date: input.due_date,
      assigned_role: input.assigned_role,
      para_agente: input.para_agente,
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !created) {
    return { error: `No se pudo crear la tarea: ${error?.message ?? "sin datos"}` };
  }

  // Dueño único (DRI) opcional — el trigger de la DB rechaza cross-tenant.
  if (input.assignee_id) {
    const { error: aErr } = await supabase
      .from("bitacora_task_assignees")
      .insert({
        task_id: created.id,
        user_id: input.assignee_id,
        tenant_id: ctx.tenantId,
        assigned_by: ctx.userId,
      });
    if (aErr) {
      return {
        error: `Tarea creada pero no se pudo asignar el dueño: ${aErr.message}`,
        taskId: created.id,
      };
    }
  }

  // Checklist inicial (plano, 1 nivel).
  const items = formData
    .getAll("checklist_item")
    .map((v) => String(v).trim())
    .filter((v) => v !== "")
    .slice(0, 50);
  if (items.length > 0) {
    const { error: cErr } = await supabase.from("bitacora_task_checklist").insert(
      items.map((texto, i) => ({
        tenant_id: ctx.tenantId,
        task_id: created.id,
        texto: texto.slice(0, 500),
        orden: i,
      })),
    );
    if (cErr) {
      return {
        error: `Tarea creada pero falló el checklist: ${cErr.message}`,
        taskId: created.id,
      };
    }
  }

  revalidateBitacora();
  return { ok: true, taskId: created.id };
}

// ─── Editar tarea (drawer) ───────────────────────────────────

export async function updateTaskAction(
  _prev: BitacoraActionState,
  formData: FormData,
): Promise<BitacoraActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const taskId = strOrNull(formData.get("task_id"));
  if (!taskId) return { error: "Falta el id de la tarea." };

  const { input, fieldErrors } = validateBitacoraTaskInput(
    taskInputFromFormData(formData),
  );
  if (fieldErrors || !input) return { fieldErrors };

  const ctx = await resolveContext(supabase);
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await supabase
    .from("bitacora_tasks")
    .update({
      titulo: input.titulo,
      descripcion: input.descripcion,
      prioridad: input.prioridad,
      tipo: input.tipo,
      due_date: input.due_date,
      assigned_role: input.assigned_role,
      para_agente: input.para_agente,
    })
    .eq("id", taskId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  // Dueño: el form manda el estado FINAL (assignee_id o vacío = sin dueño).
  const reassign = await applyOwner(supabase, {
    taskId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    newOwnerId: input.assignee_id,
  });
  if (reassign) return { error: reassign };

  revalidateBitacora();
  return { ok: true, taskId };
}

/** Deja al dueño indicado como ÚNICO asignado (null = sin dueño). */
async function applyOwner(
  supabase: StudioClient,
  opts: {
    taskId: string;
    tenantId: string;
    userId: string;
    newOwnerId: string | null;
  },
): Promise<string | null> {
  const { data: current } = await supabase
    .from("bitacora_task_assignees")
    .select("user_id")
    .eq("task_id", opts.taskId);
  const currentIds = (current ?? []).map((r: { user_id: string }) => r.user_id);

  if (
    opts.newOwnerId &&
    currentIds.length === 1 &&
    currentIds[0] === opts.newOwnerId
  ) {
    return null; // sin cambio
  }

  if (currentIds.length > 0) {
    const { error } = await supabase
      .from("bitacora_task_assignees")
      .delete()
      .eq("task_id", opts.taskId);
    if (error) return `No se pudo reasignar: ${error.message}`;
  }

  if (opts.newOwnerId) {
    const { error } = await supabase.from("bitacora_task_assignees").insert({
      task_id: opts.taskId,
      user_id: opts.newOwnerId,
      tenant_id: opts.tenantId,
      assigned_by: opts.userId,
    });
    if (error) return `No se pudo asignar el dueño: ${error.message}`;
  }
  return null;
}

// ─── Mover de estado (kanban / botón avanzar) ────────────────

export async function moveTaskAction(
  taskId: string,
  estado: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  if (!isBitacoraTaskEstado(estado)) {
    return { error: "Estado inválido." };
  }

  // Sin máquina de estados server: los 4 estados son alcanzables entre sí.
  // completed_at lo fija/limpia el trigger de la DB (nunca la app).
  const { error } = await supabase
    .from("bitacora_tasks")
    .update({ estado })
    .eq("id", taskId);
  if (error) return { error: `No se pudo mover: ${error.message}` };

  revalidateBitacora();
  return { ok: true };
}

// ─── Checklist ───────────────────────────────────────────────

export async function toggleChecklistItemAction(
  itemId: string,
  done: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const ctx = await resolveContext(supabase);
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await supabase
    .from("bitacora_task_checklist")
    .update(
      done
        ? { done: true, done_by: ctx.userId, done_at: new Date().toISOString() }
        : { done: false, done_by: null, done_at: null },
    )
    .eq("id", itemId);
  if (error) return { error: `No se pudo actualizar el punto: ${error.message}` };

  revalidateBitacora();
  return { ok: true };
}

export async function addChecklistItemAction(
  taskId: string,
  texto: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const clean = texto.trim();
  if (!clean) return { error: "El punto no puede estar vacío." };
  if (clean.length > 500) return { error: "Máximo 500 caracteres." };

  const ctx = await resolveContext(supabase);
  if ("error" in ctx) return { error: ctx.error };

  const { data: last } = await supabase
    .from("bitacora_task_checklist")
    .select("orden")
    .eq("task_id", taskId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle<{ orden: number }>();

  const { error } = await supabase.from("bitacora_task_checklist").insert({
    tenant_id: ctx.tenantId,
    task_id: taskId,
    texto: clean,
    orden: (last?.orden ?? -1) + 1,
  });
  if (error) return { error: `No se pudo agregar el punto: ${error.message}` };

  revalidateBitacora();
  return { ok: true };
}

// ─── Reasignar / tomar de la cola ────────────────────────────

export async function reassignTaskAction(
  taskId: string,
  newOwnerId: string | null,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const ctx = await resolveContext(supabase);
  if ("error" in ctx) return { error: ctx.error };

  const applied = await applyOwner(supabase, {
    taskId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    newOwnerId,
  });
  if (applied) return { error: applied };

  // Con dueño nuevo la tarea sale de la cola del rol.
  if (newOwnerId) {
    const { error } = await supabase
      .from("bitacora_tasks")
      .update({ assigned_role: null })
      .eq("id", taskId);
    if (error) return { error: `No se pudo limpiar la cola: ${error.message}` };
  }

  revalidateBitacora();
  return { ok: true };
}

/** "Tomar tarea" de la cola del rol: te asignas tú y se limpia la cola. */
export async function takeTaskAction(
  taskId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const ctx = await resolveContext(supabase);
  if ("error" in ctx) return { error: ctx.error };

  const { error: aErr } = await supabase
    .from("bitacora_task_assignees")
    .upsert(
      {
        task_id: taskId,
        user_id: ctx.userId,
        tenant_id: ctx.tenantId,
        assigned_by: ctx.userId,
      },
      { onConflict: "task_id,user_id", ignoreDuplicates: true },
    );
  if (aErr) return { error: `No se pudo tomar la tarea: ${aErr.message}` };

  const { error } = await supabase
    .from("bitacora_tasks")
    .update({ assigned_role: null })
    .eq("id", taskId);
  if (error) return { error: `Tomada, pero no salió de la cola: ${error.message}` };

  revalidateBitacora();
  return { ok: true };
}

// ─── Actas con IA (Fase 2) ───────────────────────────────────

export interface AnalyzeActaResult {
  ok?: boolean;
  meetingId?: string;
  resolved?: ResolvedActa;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * CAPTURAR: inserta el borrador de acta, corre extractActa (IA o mock) +
 * resolveActa (determinista) y persiste el acta en el borrador. Devuelve el
 * borrador revisable para que el humano confirme (nada existe en bitacora_tasks
 * todavía — la regla de oro). moduleEditDenial primero.
 */
export async function analyzeActaAction(
  input: MeetingDraftInput,
): Promise<AnalyzeActaResult> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input: draft, fieldErrors } = validateMeetingDraftInput({
    tipo: input?.tipo,
    transcript: input?.transcript,
    client_id: input?.client_id,
    contacto_libre: input?.contacto_libre,
  });
  if (fieldErrors || !draft) return { fieldErrors };

  const ctx = await resolveContext(supabase);
  if ("error" in ctx) return { error: ctx.error };

  // Nombre del cliente (para el prompt/títulos): cliente real o contacto libre.
  let clienteNombre: string | null = draft.contacto_libre;
  if (draft.client_id) {
    const { data: cli } = await supabase
      .from("clients")
      .select("name")
      .eq("id", draft.client_id)
      .maybeSingle<{ name: string }>();
    if (cli?.name) clienteNombre = cli.name;
  }

  const hoyISO = todayCaracasISO();
  const baseTitulo =
    draft.tipo === "cliente"
      ? `Conversación con ${clienteNombre?.trim() || "cliente"} · ${hoyISO}`
      : `Reunión · ${hoyISO}`;

  // Insertar el borrador (created_by = caller; la RLS lo exige).
  const { data: meeting, error: insErr } = await supabase
    .from("bitacora_meetings")
    .insert({
      tenant_id: ctx.tenantId,
      titulo: baseTitulo,
      fecha: hoyISO,
      tipo: draft.tipo,
      client_id: draft.client_id,
      contacto_libre: draft.contacto_libre,
      transcript: draft.transcript,
      estado: "borrador",
      created_by: ctx.userId,
    })
    .select("id")
    .single<{ id: string }>();
  if (insErr || !meeting) {
    return {
      error: `No se pudo crear el borrador: ${insErr?.message ?? "sin datos"}`,
    };
  }

  // Pool del equipo (para nombres del prompt + matching determinista).
  const profiles = await listAssignableProfiles(supabase);
  const teamNames = profiles.map((p) => p.display_name);

  const extracted = await extractActa(draft.transcript, {
    tipo: draft.tipo,
    clienteNombre,
    teamNames,
    hoyISO,
    hoyDia: caracasWeekdayLabel(),
  });
  if ("error" in extracted) {
    return { error: extracted.error, meetingId: meeting.id };
  }

  const resolved = resolveActa(extracted.acta, profiles, {
    tipo: draft.tipo,
    clienteNombre,
    quienRegistroId: ctx.userId,
    fechaISO: hoyISO,
  });

  // Persistir el acta en el borrador (memoria + reanudable). El freeze trigger
  // conserva id/tenant/created_by.
  const { error: updErr } = await supabase
    .from("bitacora_meetings")
    .update({
      titulo: resolved.titulo,
      resumen: resolved.resumen,
      acta: {
        puntos: resolved.puntos,
        hablaron: resolved.hablaron,
        decisiones: resolved.decisiones,
        pendientes: resolved.pendientes,
        proxima_reunion: resolved.proxima_reunion,
      },
    })
    .eq("id", meeting.id);
  if (updErr) {
    return {
      error: `Se analizó pero no se pudo guardar el borrador: ${updErr.message}`,
      meetingId: meeting.id,
    };
  }

  revalidateBitacora();
  return { ok: true, meetingId: meeting.id, resolved };
}

/**
 * CONFIRMAR: el humano autoriza. Llama la RPC transaccional
 * `bitacora_confirm_meeting` (todo-o-nada): patch del acta + inserta
 * tasks+assignees+checklist. Doble-confirm → "ya confirmada". moduleEditDenial
 * primero; la RPC es SECURITY INVOKER (la RLS es la 2.ª capa).
 */
export async function confirmActaAction(
  input: ConfirmActaInput,
): Promise<{ ok?: boolean; meetingId?: string; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input: acta, error: vErr } = validateConfirmActaInput(input);
  if (vErr || !acta) return { error: vErr ?? "Datos inválidos." };

  // Tareas → shape que espera la RPC (assignees = array de uuid strings).
  const pTasks = acta.tasks.map((t) => ({
    titulo: t.titulo,
    descripcion: t.descripcion,
    prioridad: t.prioridad,
    tipo: t.tipo,
    para_agente: t.para_agente,
    due_date: t.due_date,
    responsable_nombre: t.responsable_nombre,
    assignees: t.assignee_user_id ? [t.assignee_user_id] : [],
    checklist: t.checklist,
  }));

  const pMeetingPatch = {
    titulo: acta.titulo,
    resumen: acta.resumen,
    visibilidad: acta.visibilidad,
    acta: acta.acta,
  };

  const { error } = await supabase.rpc("bitacora_confirm_meeting", {
    p_meeting_id: acta.meetingId,
    p_meeting_patch: pMeetingPatch,
    p_tasks: pTasks,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/ya confirmada/i.test(msg)) {
      return { error: "Esta reunión ya fue confirmada." };
    }
    if (/no encontrada/i.test(msg)) {
      return {
        error: "No se encontró la reunión (¿ya fue confirmada o sin acceso?).",
      };
    }
    return { error: `No se pudo confirmar: ${msg || "error desconocido"}` };
  }

  revalidateBitacora();
  return { ok: true, meetingId: acta.meetingId };
}
