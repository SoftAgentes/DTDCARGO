/**
 * Pestaña «Embudos» del CRM (SDD-0587 · paso 6.3). Server component: resuelve
 * permisos, lee el tablero y entrega los datos ya ubicados a `CrmEmbudosClient`.
 * Va dentro de un `<Suspense>` en la página, con `CrmEmbudosCargando` mientras
 * lee.
 *
 * Desde SDD-0614 S0 las pestañas de Kommo están ocultas: Embudos es la pestaña
 * por defecto del CRM hasta que llegue Resumen (S3).
 */

import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { getStudioAccess, moduleEditDenial } from "@/lib/studio/rbac-guard";
import { listTenantAdvisors } from "@/lib/studio/user-queries";
import { rolUsaCrm, type CrmTablero } from "@/lib/studio/crm-tablero";
import { cargarTableroCrm } from "@/lib/studio/crm-tablero-queries";
import { CrmEmbudosClient } from "./CrmEmbudosClient";

export async function CrmEmbudosSlot({ tableroInicial }: { tableroInicial: CrmTablero }) {
  const supabase = await createClient();
  const access = await getStudioAccess(supabase);

  // La RLS de la 0506 solo deja pasar a admin y commercial: un permiso extra
  // del módulo no abre las tablas, así que se dice aquí y no con un error.
  if (!rolUsaCrm(access.role) || !access.tenantId) {
    return (
      <EmptyState
        eyebrow="CRM propio"
        title="Tu rol no usa el CRM propio."
        description="Los embudos de Leads y Clientes los usan administración y comercial."
      />
    );
  }

  const canEdit = (await moduleEditDenial(supabase, "kommo")) === null;
  const equipo = await listTenantAdvisors(createAdminClient(), access.tenantId);
  const asesores = new Map<string, string>();
  for (const m of equipo) if (m.name) asesores.set(m.userId, m.name);

  const datos = await cargarTableroCrm(supabase, { asesores });
  if (!datos.ok) {
    return datos.motivo === "sin_modelo" ? (
      <EmptyState
        eyebrow="CRM propio"
        title="Los embudos todavía no están activos."
        description="Falta aplicar la migración 0506 en esta base."
      />
    ) : (
      <EmptyState
        eyebrow="CRM propio"
        title="No se pudo cargar el tablero."
        description="Puede ser un corte momentáneo. Vuelve a intentarlo; si sigue, avisa a soporte."
        action={
          <a href={`/studio/crm?tab=embudos&embudo=${tableroInicial}`} className="studio-btn studio-btn-ghost studio-btn-sm">
            Reintentar
          </a>
        }
      />
    );
  }

  return (
    <CrmEmbudosClient
      etapas={datos.etapas}
      tarjetas={datos.tarjetas}
      ocultas={datos.ocultas}
      recortado={datos.recortado}
      canEdit={canEdit}
      tableroInicial={tableroInicial}
    />
  );
}

/** Lo que se ve mientras el tablero se lee. */
export function CrmEmbudosCargando() {
  return (
    <div role="status" aria-live="polite">
      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
        }}
      >
        Cargando el tablero…
      </span>
      <div aria-hidden style={{ display: "flex", gap: "var(--s-3)", overflow: "hidden" }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: "0 0 268px",
              height: 260,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              opacity: 1 - i * 0.18,
            }}
          />
        ))}
      </div>
    </div>
  );
}
