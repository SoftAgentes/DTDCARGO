/**
 * /studio/marketing/noticias-web · Generador de Noticias Web (Studio · Marketing).
 *
 * Plan v4 · Phase C — folder moved from /studio/seo-generator.
 *
 * Server Component:
 *  1. Auth + redirect login si no hay user.
 *  2. Verifica tenant + rol admin (mismo patrón que mailing/page.tsx).
 *  3. Renderiza shell + cliente del generador en LIGHT theme scope.
 *
 * Importante: el Generator vive en un `data-theme="light"` wrapper porque
 * los componentes usan Tailwind classes brand-light (text-ink #0F1E3D,
 * bg-paper #FBFAF7) que son invisibles cuando el Studio tiene
 * data-theme="dark" activo. Forzar light en este scope mantiene el chrome
 * dark de Studio (sidebar/topbar) pero el contenido del generador en light.
 *
 * NOTA: en Phase C solo se mueve el folder y se renombra el header. La
 * extensión a 10 categorías + 4 tipos + Step 0 + AI auto-detect + modo
 * dual viene en Phase D-F.
 *
 * Llamadas a Claude vía server actions en `./actions.ts` (no expone API
 * key al cliente, sin CORS, modelo claude-sonnet-4-6).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { NoticiasWebClient } from "./_components/NoticiasWebClient";

export const metadata = { title: "Noticias Web · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function NoticiasWebPage() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();

  if (!link?.tenant_id) {
    return (
      <EmptyState
        eyebrow="Sin tenant"
        title="Tu cuenta no está vinculada a ningún tenant"
        description="Pediles a un admin que te agregue al equipo."
      />
    );
  }
  if (link.role !== "admin") {
    redirect("/studio/dashboard");
  }

  // Route guard: el flag `marketing_news` queda OFF por default hasta que
  // las migrations 0053-0056 (seo_drafts, news_writers, news_posts, seed)
  // se apliquen a prod. Si alguien navega por URL directa con el flag
  // off, redirige al dashboard (mismo patrón que role-guard arriba).
  const flags = await listFeatureFlags(supabase);
  if (!flags.marketing_news) {
    redirect("/studio/dashboard");
  }

  return (
    <div
      data-theme="light"
      style={{
        background: "var(--color-paper)",
        color: "var(--color-ink)",
        borderRadius: 16,
        padding: "32px 28px 48px",
        boxShadow: "var(--shadow-pop)",
        maxWidth: 1480,
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <span
          className="eyebrow"
          style={{ color: "var(--color-grey-500, #6B6B6B)" }}
        >
          Marketing · Noticias Web
        </span>
        <h1
          style={{
            fontFamily: "var(--font-archivo-black)",
            fontSize: 34,
            margin: "12px 0 10px",
            color: "var(--color-ink, #0F1E3D)",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            fontWeight: 900,
          }}
        >
          Generar nueva{" "}
          <span style={{ color: "var(--color-wine, #7F0F1A)" }}>noticia</span>
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--color-grey-500, #6B6B6B)",
            margin: 0,
            maxWidth: "76ch",
          }}
        >
          Genera artículos SEO paso a paso para publicar en /noticias del
          sitio: tipo editorial → titular → estructura en secciones →
          artículo Markdown 800-1200 palabras.
        </p>
      </div>

      <NoticiasWebClient />
    </div>
  );
}
