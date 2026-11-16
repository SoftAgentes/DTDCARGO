/**
 * /studio/admin/oficina · La revisión de Sam de los borradores del agente (SDD-0626 Paso 3b, D2 y D4).
 *
 * SOLO para el superadministrador (`is_platform_admin`): lo exige el layout y, otra vez, la base en cada función
 * de la 0549. El borrador y el motivo se muestran SIEMPRE como texto plano: React los escapa y aquí no hay HTML
 * ni Markdown renderizado (nada de `dangerouslySetInnerHTML`). Aprobar no envía al momento: el envío lo hace
 * `/api/cron/oficina-envio` (apagado por defecto), solo a la bandeja de prueba.
 */
import Link from "next/link";

import { createClient } from "@/lib/db/server";
import { etapaActual, leerConteo, leerPendientes } from "@/lib/studio/oficina/revisiones";
import { requireModuleView } from "@/lib/studio/rbac-guard";

import { TarjetaBorrador, estiloTextoPlano as texto } from "./_components/TarjetaBorrador";
import { revisarBorradorAction } from "./actions";

export const metadata = { title: "Oficina · revisión · DTD Studio" };
export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  ok_aprobado: "Aprobado. Se envía en el próximo minuto si el envío está encendido; si no, queda esperando.",
  ok_rechazado: "Rechazado. No se envía nada.",
  sin_permiso: "Solo el superadministrador revisa borradores.",
  sin_motivo: "Falta el motivo (de 1 a 500 caracteres).",
  motivo_con_datos: "El motivo parece llevar datos personales (correo, teléfono, cédula…). Escríbelo sin ellos.",
  ya_revisado: "Ese borrador ya tenía su revisión.",
  no_en_aprobacion: "Esa tarea ya no está esperando revisión.",
  no_aprobable: "No se aprueba un envío con datos inventados o datos personales repetidos: márcalo como rechazado.",
  invalido: "La revisión llegó incompleta. Vuelve a intentarlo.",
  sin_migracion: "Falta la migración 0549 en esta base: todavía no se puede revisar.",
  error: "No se pudo guardar la revisión. Intenta de nuevo.",
};

export default async function OficinaRevisionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // SDD-0624: el gate va también en la página (el layout no se vuelve a ejecutar en la navegación parcial).
  await requireModuleView("admin");
  const supabase = await createClient();
  const etapa = etapaActual();
  const [pendientes, conteo, sp] = await Promise.all([leerPendientes(supabase), leerConteo(supabase, etapa), searchParams]);
  const r = typeof sp.r === "string" ? sp.r : null;

  return (
    <div style={{ maxWidth: 920 }}>
      <Link href="/studio/admin" style={{ font: "500 12px/1 var(--font-sans, 'Archivo')", color: "var(--ink-soft)", textDecoration: "none" }}>
        ← Volver a Administración
      </Link>
      <span className="studio-eyebrow" style={{ display: "block", marginTop: 12 }}>
        Oficina · SDD-0626 · etapa {etapa}
      </span>
      <h1 className="studio-display" style={{ fontSize: 30, margin: "8px 0", color: "var(--ink)" }}>
        Revisión de borradores
      </h1>
      <p style={{ font: "400 13px/1.4 var(--font-sans, 'Archivo')", color: "var(--ink-soft)", margin: "0 0 16px", maxWidth: "76ch" }}>
        Lo que redactó el agente soporte-chatwoot. Nada se envía sin tu aprobación, y solo a la bandeja de prueba.
      </p>
      {r && AVISOS[r] ? (
        <p role="status" style={{ ...texto, marginBottom: 16 }}>
          {AVISOS[r]}
        </p>
      ) : null}
      {conteo.ok ? (
        <p style={{ font: "400 13px/1.4 var(--font-sans, 'Archivo')", margin: "0 0 16px" }}>
          Conteo de la etapa {conteo.datos.etapa}: {conteo.datos.conversaciones} de {conteo.datos.minimo} conversaciones,{" "}
          {conteo.datos.correctas} correctas (hacen falta {conteo.datos.minimoCorrectas}), {conteo.datos.conInventados} con datos
          inventados. {conteo.datos.cumple ? "Cumple el conteo (Sam firma el paso)." : "Todavía no cumple."}
        </p>
      ) : null}
      {!pendientes.ok ? (
        <p style={texto}>{AVISOS[pendientes.motivo] ?? AVISOS.error}</p>
      ) : pendientes.datos.length === 0 ? (
        <p style={texto}>No hay borradores pendientes.</p>
      ) : (
        pendientes.datos.map((b) => <TarjetaBorrador key={b.borradorId} b={b} accion={revisarBorradorAction} />)
      )}
    </div>
  );
}
