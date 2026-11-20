"use server";

/**
 * La revisión de Sam de un borrador del agente (SDD-0626 Paso 3b, D2 y D4) y el cierre de cada conversación (0558).
 *
 * El control real está en la base: `office_revisar_borrador_v2` y `office_registrar_cierre` (0558) exigen
 * `is_platform_admin()` y el motivo, y guardan quién y cuándo. Aquí se avisa antes (`platformAdminDenial`) y se
 * revisa que el motivo no lleve datos personales (la regla del cable), porque se guarda para siempre (solo se agregan
 * filas). Revisar NO envía nada: el envío lo hace `/api/cron/oficina-envio`, solo de lo aprobado.
 *
 * El formulario dice «marca lo que falló»: por criterio, «Falló» y «No evaluado». Sin marcas = cumple.
 */
import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { detectorDelCable } from "@/lib/studio/oficina/cable-textos";
import {
  CASILLAS,
  type ClaveCasilla,
  type EstadoCriterio,
  estadoDeMarcas,
  etapaActual,
  guardarRevision,
  registrarCierre,
  revisionValida,
} from "@/lib/studio/oficina/revisiones";
import { platformAdminDenial } from "@/lib/studio/platform-admin";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";

const RUTA = "/studio/admin/oficina-virtual";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONVERSACION = /^[0-9a-f-]{1,40}$/;

/**
 * Vuelve a la página con el resultado. SDD-0678: además del código, `c` (la conversación) y `v` (lo guardado) dejan
 * que el aviso diga QUÉ se guardó, y `n` cambia en cada envío para que el aviso se vuelva a mostrar y a enfocar
 * aunque el código se repita (dos cierres seguidos).
 */
function volver(codigo: string, detalle: { c?: string; v?: string } = {}): never {
  const q = new URLSearchParams({ r: codigo });
  if (detalle.c) q.set("c", detalle.c);
  if (detalle.v) q.set("v", detalle.v);
  q.set("n", Date.now().toString(36));
  redirect(`${RUTA}?${q.toString()}`);
}

function motivoDe(formData: FormData, detalle: { c?: string } = {}): string {
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (motivo.length < 1 || motivo.length > 500) volver("sin_motivo", detalle);
  if (detectorDelCable(motivo)) volver("motivo_con_datos", detalle);
  return motivo;
}

export async function revisarBorradorAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  // Dos candados, antes de leer nada: el del módulo admin (la matriz del ERP) y el de superadministrador (D4).
  if (await moduleEditDenial(supabase, "admin")) volver("sin_permiso");
  if (await platformAdminDenial(supabase)) volver("sin_permiso");

  const borradorId = String(formData.get("borrador") ?? "");
  const veredicto = String(formData.get("veredicto") ?? "");
  if (!UUID.test(borradorId) || (veredicto !== "aprobado" && veredicto !== "rechazado")) volver("invalido");
  const motivo = motivoDe(formData);

  const criterios = {} as Record<ClaveCasilla, EstadoCriterio>;
  for (const c of CASILLAS) {
    const estado = estadoDeMarcas(formData.get(`falla_${c.clave}`) === "on", formData.get(`sin_${c.clave}`) === "on");
    if (estado === null) volver("marcas_cruzadas");
    criterios[c.clave] = estado;
  }
  const previa = revisionValida({ veredicto: veredicto as "aprobado" | "rechazado", criterios });
  if (!previa.ok) volver(previa.codigo);

  const r = await guardarRevision(supabase, {
    borradorId,
    veredicto: veredicto as "aprobado" | "rechazado",
    criterios,
    motivo,
    etapa: etapaActual(),
  });
  volver(r.ok ? `ok_${veredicto}` : r.codigo);
}

export async function registrarCierreAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  if (await moduleEditDenial(supabase, "admin")) volver("sin_permiso");
  if (await platformAdminDenial(supabase)) volver("sin_permiso");

  const conversacion = String(formData.get("conversacion") ?? "");
  const cumple = String(formData.get("cumple") ?? "");
  if (!CONVERSACION.test(conversacion) || (cumple !== "si" && cumple !== "no")) volver("invalido");
  const motivo = motivoDe(formData, { c: conversacion });

  const r = await registrarCierre(supabase, { conversacion, cumple: cumple === "si", motivo, etapa: etapaActual() });
  volver(r.ok ? "ok_cierre" : r.codigo, r.ok ? { c: conversacion, v: cumple } : { c: conversacion });
}
