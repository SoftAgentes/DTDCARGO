/**
 * /studio/admin/feature-flags · Toggle de feature flags per-tenant.
 *
 * Tier 1.2 portado de Claude Design v1.7
 * (nuevo/feature-flags.jsx + admin.jsx SectionFeatures).
 *
 * Solo admin del tenant puede entrar (redirect si no). RLS adicional en
 * la tabla `feature_flags` bloquea UPDATE a no-admins como defensa
 * profundidad.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { FeatureFlagsClient } from "./_components/FeatureFlagsClient";

export const metadata = { title: "Feature flags · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();

  if (!link?.tenant_id) redirect("/studio/dashboard");
  if (link.role !== "admin") redirect("/studio/admin");

  const flags = await listFeatureFlags(supabase);

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/studio/admin"
          style={{
            font: "500 12px/1 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 12,
          }}
        >
          ← Volver a Administración
        </Link>
        <span className="studio-eyebrow">Sistema · Casos de uso</span>
        <h1
          className="studio-display"
          style={{
            fontSize: 30,
            margin: "8px 0 8px",
            color: "var(--ink)",
          }}
        >
          Feature flags
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "76ch",
          }}
        >
          Enciende/apaga módulos del Studio sin tocar código. Los flags se
          aplican inmediatamente al sidebar de todo el equipo. Cambios
          son atómicos y persisten en la base de datos.
        </p>
      </div>

      <FeatureFlagsClient flags={flags} />
    </div>
  );
}
