/**
 * /studio/admin/oficina-virtual · La revisión de Sam de los borradores del agente (SDD-0626 Paso 3b, D2 y D4).
 *
 * SOLO para el superadministrador (`is_platform_admin`): lo exige el layout y, otra vez, la base en cada función
 * de la 0549. El borrador y el motivo se muestran SIEMPRE como texto plano: React los escapa y aquí no hay HTML
 * ni Markdown renderizado (nada de `dangerouslySetInnerHTML`). Aprobar no envía al momento: el envío lo hace
 * `/api/cron/oficina-envio` (apagado por defecto), solo a la bandeja de prueba.
 */
import Link from "next/link";

import { createClient } from "@/lib/db/server";
import { vistaActiva } from "@/lib/studio/oficina/config";
import { etapaActual, leerConteo, leerPendientes, leerPorCerrar } from "@/lib/studio/oficina/revisiones";
import { requireModuleView } from "@/lib/studio/rbac-guard";

import { AvisoResultado } from "./_components/AvisoResultado";
import { detalleDelCierre, tonoDelResultado } from "./_components/resultado";
import { TarjetaBorrador, estiloTextoPlano as texto } from "./_components/TarjetaBorrador";
import { TarjetaCierre } from "./_components/TarjetaCierre";
import { registrarCierreAction, revisarBorradorAction } from "./actions";

export const metadata = { title: "Oficina_Virtual · revisión" };
export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  ok_aprobado: "Aprobado. Se envía en el próximo minuto si el envío está encendido; si no, queda esperando.",
  ok_rechazado: "Rechazado. No se envía nada.",
  sin_permiso: "Solo el superadministrador revisa borradores.",
  sin_motivo: "Falta el motivo (de 1 a 500 caracteres).",
  motivo_con_datos: "El motivo parece llevar datos personales (correo, teléfono, cédula…). Escríbelo sin ellos.",
  ya_revisado: "Ese borrador ya tenía su revisión.",
  no_en_aprobacion: "Esa tarea ya no está esperando revisión.",
  no_aprobable:
    "No se aprueba un envío sin evaluar, o con datos inventados o datos personales repetidos: «Cero datos inventados» y «No repite datos personales» tienen que cumplir. Si fallaron, recházalo.",
  rechazo_sin_fallo: "Para rechazar, marca «Falló» en al menos un criterio.",
  marcas_cruzadas: "Un criterio no puede estar a la vez en «Falló» y en «No evaluado».",
  ok_cierre: "Cierre registrado.",
  ya_cerrada: "Esa conversación ya tenía su cierre.",
  sin_0558: "Falta la migración 0558 en esta base: todavía no se puede revisar ni cerrar con la regla nueva.",
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
  const [pendientes, conteo, porCerrar, sp] = await Promise.all([
    leerPendientes(supabase),
    leerConteo(supabase, etapa),
    leerPorCerrar(supabase, etapa),
    searchParams,
  ]);
  const uno = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const r = uno("r");
  // SDD-0678: el aviso dice qué se guardó (o de qué conversación era el error) y se repite en cada envío (`n`).
  // Solo un número de conversación (la misma forma que valida la acción): nada de texto libre desde la URL.
  const c = uno("c");
  const conversacionDelAviso = c && /^[0-9a-f-]{1,40}$/.test(c) ? c : null;
  const detalle = r === "ok_cierre" ? detalleDelCierre(conversacionDelAviso, uno("v")) : null;
  // Con la 0549 y sin la 0558, office_conteo_revisiones es todavía el de la 0549 (la regla vieja): se avisa junto al
  // conteo. La señal es la misma que da la sección de cierres: office_conversaciones_por_cerrar (0558) no existe.
  const sin0558 = conteo.ok && !porCerrar.ok && porCerrar.motivo === "sin_migracion";

  return (
    <div style={{ maxWidth: 920 }}>
      <span className="studio-eyebrow" style={{ display: "block" }}>
        <span style={{ textTransform: "none" }}>Oficina_Virtual</span> · SDD-0626 · etapa {etapa}
      </span>
      <h1 className="studio-display" style={{ fontSize: 30, margin: "8px 0", color: "var(--ink)" }}>
        Revisión de borradores
      </h1>
      <p style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "0 0 16px", maxWidth: "76ch" }}>
        Lo que redactó el agente soporte-chatwoot. Nada se envía sin tu aprobación, y solo a la bandeja de prueba.
      </p>
      {vistaActiva() ? (
        <p style={{ font: "400 13px/1.4 var(--f-sans)", margin: "0 0 16px" }}>
          <Link href="/studio/admin/oficina-virtual/vista" style={{ color: "var(--ink)" }}>
            Ver la cola, los eventos y la bitácora del cable (solo lectura) →
          </Link>
        </p>
      ) : null}
      {r && AVISOS[r] ? (
        <AvisoResultado key={uno("n") ?? r} tono={tonoDelResultado(r)}>
          {detalle ??
            (conversacionDelAviso && !r.startsWith("ok_")
              ? `Conversación ${conversacionDelAviso}: no se guardó el cierre. ${AVISOS[r]}`
              : AVISOS[r])}
        </AvisoResultado>
      ) : null}
      {conteo.ok ? (
        <p style={{ font: "400 13px/1.4 var(--f-sans)", margin: "0 0 16px" }}>
          Conteo de la etapa {conteo.datos.etapa}: {conteo.datos.conversaciones} de {conteo.datos.minimo} conversaciones,{" "}
          {conteo.datos.correctas} correctas (hacen falta {conteo.datos.minimoCorrectas}), {conteo.datos.conInventados} con datos
          inventados. {conteo.datos.cumple ? "Cumple el conteo (Sam firma el paso)." : "Todavía no cumple."}
          {sin0558 ? ` ${AVISOS.sin_0558} Este conteo usa la regla vieja de la 0549.` : null}
        </p>
      ) : null}
      {!pendientes.ok ? (
        <p style={texto}>{AVISOS[pendientes.motivo] ?? AVISOS.error}</p>
      ) : pendientes.datos.length === 0 ? (
        <p style={texto}>No hay borradores pendientes.</p>
      ) : (
        pendientes.datos.map((b) => <TarjetaBorrador key={b.borradorId} b={b} accion={revisarBorradorAction} />)
      )}
      <h2 className="studio-display" style={{ fontSize: 20, margin: "24px 0 8px", color: "var(--ink)" }}>
        Conversaciones por cerrar
      </h2>
      <p style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "0 0 16px", maxWidth: "76ch" }}>
        Cuando una conversación revisada se cierra o se escala, registra una vez si cerró o escaló en 3 intercambios o
        menos. {etapa === 2 ? "En la etapa 2 solo cuentan las conversaciones con su cierre." : "En la etapa 1 un cierre que falló hace incorrecta la conversación."}
      </p>
      {!porCerrar.ok ? (
        <p style={texto}>{porCerrar.motivo === "sin_migracion" ? AVISOS.sin_0558 : (AVISOS[porCerrar.motivo] ?? AVISOS.error)}</p>
      ) : porCerrar.datos.length === 0 ? (
        <p style={texto}>No hay conversaciones por cerrar.</p>
      ) : (
        porCerrar.datos.map((c) => <TarjetaCierre key={c.conversacion} c={c} accion={registrarCierreAction} />)
      )}
    </div>
  );
}
