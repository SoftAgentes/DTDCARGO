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

/** Fondo sobre el que se previsualiza el archivo (migr 0335). */
export const BRAND_TILES = ["auto", "light", "dark", "checker"] as const;
export type BrandTile = (typeof BRAND_TILES)[number];

export type BrandAsset = {
  id: string;
  title: string;
  subtitle: string | null;
  kind: BrandAssetKind;
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  tile: BrandTile;
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

export function isBrandTile(value: unknown): value is BrandTile {
  return (
    typeof value === "string" && (BRAND_TILES as readonly string[]).includes(value)
  );
}

export function tileLabel(tile: BrandTile): string {
  const map: Record<BrandTile, string> = {
    auto: "Automático",
    light: "Fondo claro",
    dark: "Fondo oscuro",
    checker: "Transparencia",
  };
  return map[tile];
}

/**
 * El CSS del fondo de la miniatura.
 *
 * `auto` mantiene la heurística por nombre que había antes de la migr 0335 —
 * frágil (un archivo llamado "logo para fondo oscuro.png" no matchea y el logo
 * blanco queda invisible sobre papel blanco), pero es lo que aplica a las filas
 * viejas que nadie clasificó. Lo que se sube de ahora en adelante trae `tile`
 * elegido a mano y no pasa por acá.
 */
export function tileBackground(asset: BrandAsset): string {
  const tile =
    asset.tile !== "auto"
      ? asset.tile
      : /revers|mono-light|mono light|inverso|blanco|light|oscuro|dark/i.test(
            `${asset.title} ${asset.storagePath}`,
          )
        ? "dark"
        : "light";

  if (tile === "dark") return "var(--color-ink)";
  if (tile === "checker") {
    // Cuadrícula de transparencia dibujada con gradientes: sin imagen de fondo,
    // sobrevive a la CSP estricta y no pesa nada.
    return (
      "repeating-conic-gradient(var(--color-grey-200) 0% 25%, " +
      "var(--color-white) 0% 50%) 50% / 16px 16px"
    );
  }
  return "var(--color-paper)";
}

/** "741 × 764" o `null` si no se pudieron leer las dos. */
export function formatDimensions(
  width: number | null,
  height: number | null,
): string | null {
  if (width == null || height == null) return null;
  return `${width} × ${height}`;
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
