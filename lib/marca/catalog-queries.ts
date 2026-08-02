/**
 * Lectura del catálogo de marca (SDD-0238). SOLO SERVIDOR.
 *
 * Usa el admin client a propósito: `/marca` es una página PÚBLICA — el visitante
 * es anónimo, no hay JWT del que colgar RLS. El control de acceso es el gate del
 * código (`lib/marca/access.ts`), que ya corrió antes de llegar acá. La RLS de
 * `brand_assets` sigue protegiendo el camino del ERP, que sí es autenticado.
 *
 * `storagePath` se resuelve del lado del servidor y nunca se manda al navegador:
 * el cliente sólo conoce el `id` del asset y pide `/api/marca/download/<id>`.
 */

import "server-only";
import { createAdminClient } from "@/lib/db/admin";
import {
  isBrandAssetKind,
  isBrandTile,
  type BrandAsset,
  type BrandSection,
} from "./catalog-types";

/** Columnas del catálogo. Una sola lista: las tres consultas leen lo mismo. */
const ASSET_COLUMNS =
  "id, section_id, title, subtitle, kind, mime, bytes, width, height, tile, storage_path, sort_order";

type SectionRow = {
  id: string;
  slug: string;
  title: string;
  intro: string | null;
  sort_order: number;
};

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
  sort_order: number;
};

function toAsset(row: AssetRow): BrandAsset {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    // Un `kind`/`tile` fuera del enum sólo puede venir de un CHECK relajado a
    // mano; degradamos en vez de romper la página entera.
    kind: isBrandAssetKind(row.kind) ? row.kind : "documento",
    mime: row.mime,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    tile: isBrandTile(row.tile) ? row.tile : "auto",
    storagePath: row.storage_path,
  };
}

/**
 * El catálogo completo de un tenant, ya agrupado por sección y ordenado.
 *
 * Devuelve TODAS las secciones activas, incluso las vacías: una sección
 * "Plantillas" sin archivos le dice al diseñador que eso existe y todavía no
 * está cargado — mejor que desaparecer y que lo pida por WhatsApp.
 */
export async function loadBrandCatalog(tenantId: string): Promise<BrandSection[]> {
  const admin = createAdminClient();

  const [{ data: sections }, { data: assets }] = await Promise.all([
    admin
      .from("brand_sections")
      .select("id, slug, title, intro, sort_order")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .returns<SectionRow[]>(),
    admin
      .from("brand_assets")
      .select(ASSET_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .returns<AssetRow[]>(),
  ]);

  const bySection = new Map<string, BrandAsset[]>();
  for (const row of assets ?? []) {
    const list = bySection.get(row.section_id) ?? [];
    list.push(toAsset(row));
    bySection.set(row.section_id, list);
  }

  return (sections ?? []).map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    intro: s.intro,
    assets: bySection.get(s.id) ?? [],
  }));
}

/**
 * Un asset por id, para la descarga individual. `null` si no existe o está de baja.
 *
 * Sin embed de `brand_sections`: el FK a la sección es COMPUESTO
 * (`section_id, tenant_id`), y PostgREST no resuelve solo la relación embebida
 * sobre un FK compuesto. Nadie necesita el slug acá, así que no vale la pena.
 */
export async function findBrandAsset(
  tenantId: string,
  assetId: string,
): Promise<BrandAsset | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("brand_assets")
    .select(ASSET_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", assetId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle<AssetRow>();

  return data ? toAsset(data) : null;
}

/**
 * Los assets de una sección (o de TODAS con `slug = "todo"`), para armar el zip.
 * Devuelve `null` si el slug no corresponde a ninguna sección viva — así el
 * route handler responde 404 en vez de un zip vacío.
 */
export async function assetsForBundle(
  tenantId: string,
  slug: string,
): Promise<{ label: string; assets: BrandAsset[] } | null> {
  const catalog = await loadBrandCatalog(tenantId);

  if (slug === "todo") {
    return {
      label: "kit-de-marca",
      assets: catalog.flatMap((s) => s.assets),
    };
  }

  const section = catalog.find((s) => s.slug === slug);
  if (!section) return null;
  return { label: section.slug, assets: section.assets };
}

/**
 * Los assets de una selección explícita, para el zip que arma el visitante.
 *
 * Filtra por `tenant_id` además de por id: los ids llegan del navegador, y sin
 * eso un id de otro tenant entraría al paquete. También descarta los que no
 * existan o estén de baja en vez de fallar — la página pudo quedar abierta
 * mientras Marketing quitaba un archivo.
 */
export async function assetsByIds(
  tenantId: string,
  ids: string[],
): Promise<BrandAsset[]> {
  if (ids.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("brand_assets")
    .select(ASSET_COLUMNS)
    .eq("tenant_id", tenantId)
    .in("id", ids)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .returns<AssetRow[]>();

  return (data ?? []).map(toAsset);
}
