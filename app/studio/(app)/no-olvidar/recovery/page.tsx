/**
 * /studio/no-olvidar/recovery — solicitud de recuperación custodial (SDD-0025 §4.6).
 *
 * Accesible SIN unlock (es justo para cuando perdiste el acceso). El empleado
 * explica el motivo; dos admins deben aprobar (M-of-N) antes de que un admin
 * ejecute el reset desde /admin. Muestra el estado de sus propios pedidos.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { listRecoveryRequests } from "@/lib/studio/no-olvidar-queries";
import { RecoveryClient } from "./_components/RecoveryClient";

export const metadata = { title: "No-Olvidar · Recuperación" };

export default async function NoOlvidarRecoveryPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/studio");

  const requests = await listRecoveryRequests(supabase, { limit: 20 });

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 22 }}>
        <span className="studio-eyebrow">No-Olvidar · Recuperación</span>
        <h1 className="studio-display" style={{ fontSize: 28, margin: "8px 0 8px", color: "var(--ink)" }}>
          Recuperar acceso
        </h1>
        <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0, maxWidth: "68ch" }}>
          Si perdiste tu master password o tu 2FA, solicita una recuperación. Dos
          administradores deben aprobarla antes de restablecer tu acceso. Explica
          bien el motivo: es lo que ellos revisan para aprobar.
        </p>
      </div>

      <RecoveryClient requests={requests} />
    </div>
  );
}
