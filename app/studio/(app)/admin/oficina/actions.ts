"use server";

/**
 * La revisión de Sam de un borrador del agente (SDD-0626 Paso 3b, D2 y D4).
 *
 * El control real está en la base: `office_revisar_borrador` (0549) exige `is_platform_admin()`, las 5 casillas
 * y el motivo, y guarda quién y cuándo. Aquí se avisa antes (`platformAdminDenial`) y se revisa que el motivo no
 * lleve datos personales (la regla del cable), porque la revisión se guarda para siempre (solo se agregan filas).
 * Revisar NO envía nada: el envío lo hace `/api/cron/oficina-envio`, solo de lo aprobado.
 */
import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { detectorDelCable } from "@/lib/studio/oficina/cable-textos";
import { CASILLAS, type ClaveCasilla, etapaActual, guardarRevision } from "@/lib/studio/oficina/revisiones";
import { platformAdminDenial } from "@/lib/studio/platform-admin";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";

const RUTA = "/studio/admin/oficina";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function volver(codigo: string): never {
  redirect(`${RUTA}?r=${encodeURIComponent(codigo)}`);
}

export async function revisarBorradorAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  // Dos candados, antes de leer nada: el del módulo admin (la matriz del ERP) y el de superadministrador (D4).
  if (await moduleEditDenial(supabase, "admin")) volver("sin_permiso");
  if (await platformAdminDenial(supabase)) volver("sin_permiso");

  const borradorId = String(formData.get("borrador") ?? "");
  const veredicto = String(formData.get("veredicto") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!UUID.test(borradorId) || (veredicto !== "aprobado" && veredicto !== "rechazado")) volver("invalido");
  if (motivo.length < 1 || motivo.length > 500) volver("sin_motivo");
  if (detectorDelCable(motivo)) volver("motivo_con_datos");

  const casillas = Object.fromEntries(CASILLAS.map((c) => [c.clave, formData.get(c.clave) === "on"])) as Record<
    ClaveCasilla,
    boolean
  >;
  const r = await guardarRevision(supabase, {
    borradorId,
    veredicto: veredicto as "aprobado" | "rechazado",
    casillas,
    motivo,
    etapa: etapaActual(),
  });
  volver(r.ok ? `ok_${veredicto}` : r.codigo);
}
