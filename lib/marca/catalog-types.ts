/**
 * Tipos del catálogo de marca (SDD-0238).
 *
 * Puro: sin dependencias de servidor. Lo consumen tanto la página pública
 * `/marca` como la administración en Studio › Marketing.
 */

/** Los tipos de archivo que reconoce el catálogo (espeja el CHECK de migr 0334). */
export const BRAND_ASSET_KINDS = [
  "logo",
  "tipografia",
  "fuente",
  "plantilla",
  "fondo",
  "icono",
  "foto",
  "documento",
  "color",
] as const;

export type BrandAssetKind = (typeof BRAND_ASSET_KINDS)[number];

export type BrandAsset = {
  id: string;
  title: string;
  subtitle: string | null;
  kind: BrandAssetKind;
  mime: string | null;
  bytes: number | null;
  /** Clave dentro del bucket. NUNCA se manda al navegador. */
  storagePath: string;
};

export type BrandSection = {
  id: string;
  slug: string;
  title: string;
  intro: string | null;
  assets: BrandAsset[];
};

/** Etiqueta en español para el badge de cada asset. */
export function kindLabel(kind: BrandAssetKind): string {
  const map: Record<BrandAssetKind, string> = {
    logo: "Logo",
    tipografia: "Tipografía",
    fuente: "Fuente",
    plantilla: "Plantilla",
    fondo: "Fondo",
    icono: "Ícono",
    foto: "Foto",
    documento: "Documento",
    color: "Color",
  };
  return map[kind] ?? "Archivo";
}

export function isBrandAssetKind(value: unknown): value is BrandAssetKind {
  return (
    typeof value === "string" &&
    (BRAND_ASSET_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Tamaño legible. En español venezolano el separador decimal es la coma:
 * "1,4 MB", no "1.4 MB".
 */
export function formatBytes(bytes: number | null): string | null {
  if (bytes == null || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0).replace(".", ",")} MB`;
}

/**
 * La extensión que se le muestra al usuario, sacada del nombre del archivo.
 * Es lo primero que mira un diseñador: quiere saber si hay .svg o sólo .png.
 */
export function extensionOf(storagePath: string): string | null {
  const name = storagePath.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toUpperCase();
}
