/**
 * Marketing · HUB de marca — administración del centro de marca (SDD-0238).
 *
 * QUÉ CAMBIÓ. Esta página listaba 4 PNG hardcodeados en el propio .tsx y tres
 * tarjetas "Próximamente" (fondos, plantillas, herramientas) que llevaban dos
 * meses sin contenido, porque agregar un archivo exigía un commit y un deploy.
 * Ahora es la ADMINISTRACIÓN del catálogo real: se sube un archivo y aparece al
 * instante en `/marca`, que es el link que se le pasa a diseño.
 *
 * Las dos cosas que se hacen acá:
 *   1. Poner el código de acceso de `/marca` (lo que pidió el founder) y copiar
 *      el link para mandarlo.
 *   2. Subir, ver y quitar los archivos del catálogo, por sección.
 *
 * Guard: `requireModuleView("marketing")` (RBAC SDD-0085) + `moduleEditDenial`
 * dentro de cada action.
 *
 * Se lee con el cliente del USUARIO (no admin) a propósito: acá sí hay sesión,
 * y así la RLS de `brand_sections`/`brand_assets` es la que decide. El admin
 * client queda reservado para `/marca`, que es anónima.
 */

import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { Icon } from "@/app/studio/_components/icons";
import { BRAND_BOOK_VERSION } from "@/lib/marca/brand-book";
import {
  isBrandAssetKind,
  isBrandTile,
  type BrandSection,
} from "@/lib/marca/catalog-types";
import { BrandAccessPanel } from "./_components/BrandAccessPanel";
import { BrandInternalPanel } from "./_components/BrandInternalPanel";
import { BrandCatalogManager } from "./_components/BrandCatalogManager";

export const metadata = { title: "HUB de marca · Marketing · DTD Studio" };
export const dynamic = "force-dynamic";

type SectionRow = { id: string; slug: string; title: string; intro: string | null };
type AssetRow = {
  id: string;
  section_id: string;
  title: string;
  subtitle: string | null;
  kind: string;
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  tile: string | null;
  storage_path: string;
};

export default async function MarketingHubPage() {
  await requireModuleView("marketing");
  const supabase = await createClient();

  const [{ data: sectionRows }, { data: assetRows }, { data: access }] =
    await Promise.all([
      supabase
        .from("brand_sections")
        .select("id, slug, title, intro")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .returns<SectionRow[]>(),
      supabase
        .from("brand_assets")
        .select(
          "id, section_id, title, subtitle, kind, mime, bytes, width, height, tile, storage_path",
        )
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .returns<AssetRow[]>(),
      supabase
        .from("brand_access")
        .select("code_hash, internal_code_hash, session_days, updated_at")
        .maybeSingle<{
          code_hash: string | null;
          internal_code_hash: string | null;
          session_days: number;
          updated_at: string | null;
        }>(),
    ]);

  const bySection = new Map<string, BrandSection["assets"]>();
  for (const row of assetRows ?? []) {
    const list = bySection.get(row.section_id) ?? [];
    list.push({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      kind: isBrandAssetKind(row.kind) ? row.kind : "documento",
      mime: row.mime,
      bytes: row.bytes,
      width: row.width,
      height: row.height,
      tile: isBrandTile(row.tile) ? row.tile : "auto",
      storagePath: row.storage_path,
    });
    bySection.set(row.section_id, list);
  }

  const sections: BrandSection[] = (sectionRows ?? []).map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    intro: s.intro,
    assets: bySection.get(s.id) ?? [],
  }));

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com").replace(
    /\/$/,
    "",
  );

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/studio/marketing"
          style={{
            font: "600 13px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            textDecoration: "none",
          }}
        >
          ← Marketing
        </Link>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div
          className="studio-eyebrow"
          style={{ marginBottom: 10, color: "var(--wine-text)" }}
        >
          Marketing · HUB
        </div>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "0 0 var(--s-2)", color: "var(--ink)" }}
        >
          HUB de marca
        </h1>
        <p
          style={{
            font: "400 14px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "68ch",
          }}
        >
          Lo que cargues acá es lo que ve quien abra el centro de marca. Brand
          Book {BRAND_BOOK_VERSION}.{" "}
          <a
            href="/marca"
            target="_blank"
            rel="noreferrer"
            style={{
              color: "var(--wine-text)",
              fontWeight: 600,
              display: "inline-flex",
              gap: 4,
              alignItems: "center",
            }}
          >
            Ver /marca {Icon.external(13)}
          </a>
        </p>
      </div>

      <BrandAccessPanel
        isOpen={Boolean(access?.code_hash)}
        updatedAt={access?.updated_at ?? null}
        sessionDays={access?.session_days ?? 30}
        shareUrl={`${siteUrl}/marca`}
      />

      <BrandInternalPanel isOpen={Boolean(access?.internal_code_hash)} />

      {sections.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: 14,
            padding: "28px 24px",
            background: "var(--bg-surface)",
          }}
        >
          <p style={{ font: "600 14px/1.4 var(--f-sans)", color: "var(--ink)", margin: 0 }}>
            No hay secciones todavía
          </p>
          <p
            style={{
              font: "400 13px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "var(--s-1) 0 0",
              maxWidth: "64ch",
            }}
          >
            Las siembra la migración 0334. Si esta lista está vacía, esa migración
            no se aplicó en este entorno.
          </p>
        </div>
      ) : (
        <BrandCatalogManager sections={sections} />
      )}
    </div>
  );
}
