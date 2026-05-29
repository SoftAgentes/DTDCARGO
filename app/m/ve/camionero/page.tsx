/**
 * /m/ve/camionero — Home del camionero VE (SDD-0030).
 *
 * Server component:
 *  1. Valida sesión + role
 *  2. Fetch ODs `lista` o `en_ruta` asignadas al driver via FK explícito
 *     `operario.tms_driver_id` (Sprint 0 fix — antes era match por nombre)
 *  3. Render CamioneroClient con ruta del día
 */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { listOdsForCamionero } from "@/lib/studio/dispatch-mobile-queries";
import { CamioneroClient } from "./_components/CamioneroClient";

const FACADE_BUCKET = "client-facades";
const SIGNED_URL_TTL_SEC = 600; // 10 min

export const metadata = { title: "Despacho · Camionero" };
export const dynamic = "force-dynamic";

export default async function CamioneroHomePage() {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/ve/login");
  if (operario.region !== "ve") redirect("/m/ve/login");

  // Sprint D · multi-rol: si tiene > 1 modo y no eligió hoy, al selector
  if (operario.roles.length > 1 && !operario.current_mode) {
    redirect("/m/ve/modos");
  }
  // Si el modo activo NO es camionero, redirigir al modo correcto
  const activeMode = operario.current_mode ?? operario.role;
  if (activeMode !== "camionero" && activeMode !== "supervisor") {
    redirect("/m/ve/bodeguero");
  }

  const admin = createAdminClient();
  const ods = await listOdsForCamionero(
    admin,
    operario.tenant_id,
    operario.tms_driver_id,
  );

  // Sprint 3 · generar signed URLs (10min) para fotos de fachada del bucket
  // privado client-facades. Map markbox → URL para que CamioneroClient
  // pueda render <img src>. Si no hay path o el sign falla, queda null y
  // la UI rendea el CTA "Tomar foto fachada".
  const facadePaths: { markbox: string; path: string }[] = [];
  for (const od of ods) {
    for (const p of od.packages) {
      if (p.client_facade_photo_url && p.markbox) {
        facadePaths.push({ markbox: p.markbox, path: p.client_facade_photo_url });
      }
    }
  }
  const facadeSignedUrls: Record<string, string> = {};
  // Dedup by path (mismo cliente puede aparecer en N paquetes)
  const uniquePaths = Array.from(new Set(facadePaths.map((f) => f.path)));
  if (uniquePaths.length > 0) {
    const { data: signed } = await admin.storage
      .from(FACADE_BUCKET)
      .createSignedUrls(uniquePaths, SIGNED_URL_TTL_SEC);
    if (signed) {
      for (let i = 0; i < signed.length; i++) {
        const path = uniquePaths[i]!;
        const item = signed[i];
        if (item && !item.error && item.signedUrl) {
          // Atar a TODOS los markboxes que comparten ese path
          for (const f of facadePaths) {
            if (f.path === path) facadeSignedUrls[f.markbox] = item.signedUrl;
          }
        }
      }
    }
  }

  const firstName = operario.display_name.split(/\s+/)[0] ?? operario.display_name;
  const initials =
    operario.display_name
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("") || "??";

  return (
    <CamioneroClient
      operario={{
        operario_id: operario.operario_id,
        displayName: operario.display_name,
        firstName,
        initials,
        roles: operario.roles,
      }}
      ods={ods}
      tenantId={operario.tenant_id}
      facadeSignedUrls={facadeSignedUrls}
    />
  );
}
