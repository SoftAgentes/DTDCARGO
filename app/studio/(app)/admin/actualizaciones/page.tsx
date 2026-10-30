/**
 * /studio/admin/actualizaciones · Versiones de Chatwoot (SDD-0588, paso 3.3).
 *
 * Qué versión de Chatwoot está instalada en chat.dtdcargo.com, cuál está
 * publicada, qué traen las versiones pendientes y quién pidió subir. El botón
 * «Pedir actualización» deja un registro y «Analizar con IA» (paso 3.4) deja un
 * informe: ninguno instala nada (E3-D1). La subida
 * sigue docs/runbooks/chatwoot-versiones.md con el OK nominal de Sam.
 *
 * Admin-only por el `layout.tsx` (requireModuleView("admin")). Las server
 * actions revalidan su propio gate.
 */

import { createClient } from "@/lib/db/server";
import { tenantAdminGate } from "@/lib/studio/rbac-guard";
import { listarPedidos, ultimaRevision } from "@/lib/studio/chatwoot/versiones-queries";
import { ultimoAnalisis } from "@/lib/studio/chatwoot/analisis-queries";
import { ActualizacionesPanel } from "./_components/ActualizacionesPanel";

export const metadata = {
  title: "Actualizaciones · DTD Studio",
};

export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Caracas" });
const DIA = new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeZone: "America/Caracas" });

function formatear(iso: string, formato: Intl.DateTimeFormat): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "—" : formato.format(fecha);
}

export default async function ActualizacionesPage() {
  const supabase = await createClient();
  const gate = await tenantAdminGate(supabase);
  const revision = gate.ok ? await ultimaRevision(supabase, gate.tenantId) : null;
  const pedidos = gate.ok ? await listarPedidos(supabase, gate.tenantId, gate.userId) : [];
  const analisis =
    gate.ok && revision?.estado === "hay_nueva" && revision.instalada && revision.disponible
      ? await ultimoAnalisis(supabase, gate.tenantId, revision.instalada, revision.disponible)
      : null;

  return (
    <div style={{ maxWidth: 860 }}>
      <span className="studio-eyebrow">Administración</span>
      <h1 className="studio-display" style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-3)", color: "var(--ink)" }}>
        Actualizaciones de Chatwoot.
      </h1>
      <p style={{ font: "400 14px/1.6 var(--f-sans)", color: "var(--ink-soft)", margin: "0 0 var(--s-8)", maxWidth: 640 }}>
        Studio revisa una vez al día la versión de la Bandeja contra las que publica Chatwoot. Cuando hay una nueva,
        puedes pedir la actualización: queda registrada para Sam y la dirección técnica, que la instalan con respaldo,
        prueba en copia y verificación.
      </p>

      <ActualizacionesPanel
        revision={
          revision
            ? {
                ...revision,
                revisadaTexto: formatear(revision.revisada, FECHA),
                pendientes: revision.pendientes.map((p) => ({ ...p, publicadaTexto: p.publicada ? formatear(p.publicada, DIA) : "—" })),
              }
            : null
        }
        pedidos={pedidos.map((p) => ({ ...p, pedidoTexto: formatear(p.pedido, FECHA) }))}
        analisis={
          analisis
            ? {
                motor: analisis.motor,
                modelo: analisis.modelo,
                recomendacion: analisis.informe.recomendacion,
                resumen: analisis.informe.resumen,
                piezas: analisis.informe.piezas,
                archivos: analisis.archivos,
                recortado: analisis.recortado,
                creadoTexto: formatear(analisis.creado, FECHA),
              }
            : null
        }
      />
    </div>
  );
}
