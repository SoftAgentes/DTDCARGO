"use client";

/**
 * Ficha de un archivo descargable del catálogo (SDD-0238).
 *
 * TRES COSAS QUE UN DISEÑADOR MIRA ANTES DE BAJAR: qué es (miniatura), en qué
 * formato y a qué tamaño (`SVG · 741 × 764 · 38 KB`), y si le sirve. Por eso la
 * línea técnica va en mono y completa — la versión anterior sólo decía formato y
 * peso, y las dimensiones había que averiguarlas descargando.
 *
 * La miniatura sale de `/api/marca/download/<id>?preview=1`, que sólo sirve
 * inline los rasters; todo lo demás cae al bloque de extensión, que para un .AI
 * o un .OTF es justamente lo informativo.
 *
 * El fondo lo decide `tile` (migr 0335), no el nombre del archivo.
 */

import { DownloadIcon } from "@/components/Icon";
import {
  extensionOf,
  formatBytes,
  formatDimensions,
  kindLabel,
  tileBackground,
  type BrandAsset,
} from "@/lib/marca/catalog-types";

const RASTER = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function AssetCard({
  asset,
  selected,
  onToggle,
}: {
  asset: BrandAsset;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const ext = extensionOf(asset.storagePath);
  const meta = [ext, formatDimensions(asset.width, asset.height), formatBytes(asset.bytes)]
    .filter(Boolean)
    .join(" · ");
  const isRaster = asset.mime != null && RASTER.has(asset.mime);
  const checkboxId = `sel-${asset.id}`;

  return (
    <div
      className="rounded-[16px] border bg-white overflow-hidden flex flex-col transition-colors"
      style={{
        borderColor: selected ? "var(--color-wine)" : "var(--color-grey-200)",
        boxShadow: selected ? "0 0 0 1px var(--color-wine)" : undefined,
      }}
    >
      <div className="relative">
        {/*
          FLEX, no grid. Esto antes era `grid place-items-center` con
          `max-h-full` en el <img> y NO contenía nada: en un grid con las filas
          dimensionadas por contenido, `max-height: 100%` no tiene contra qué
          resolverse y el navegador lo ignora. Medido: recuadro de 132px (92
          útiles) y el isólogo de 741×764 renderizando a 288×297 — 185px de
          desborde que tapaban el título, el detalle y el botón de cada ficha.
          En flex el porcentaje SÍ resuelve contra el content box del contenedor,
          que es definido (132 − 40 de padding = 92).

          `w-auto h-auto` con `max-*` en vez de `w-full h-full object-contain`:
          esto último también contiene, pero AGRANDA lo chico — el favicon de
          32×32 se estiraba a 328×131 y salía borroso. Medido con las tres
          proporciones reales del catálogo (741×764, 1200×630, 32×32).

          `overflow-hidden` es el cinturón por si alguien vuelve a tocar esto.
        */}
        <div
          className="relative h-[132px] overflow-hidden flex items-center justify-center p-5 border-b border-grey-200"
          style={{ background: tileBackground(asset) }}
        >
          {isRaster ? (
            /* URL firmada que caduca en 60 s: el optimizador de next/image la
               cachearía más de lo que vive, y `remotePatterns` sólo habilita los
               objetos PÚBLICOS de Storage, no los firmados. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/marca/download/${asset.id}?preview=1`}
              alt={asset.title}
              loading="lazy"
              className="max-w-full max-h-full w-auto h-auto object-contain"
            />
          ) : (
            <span
              className="text-[26px] font-bold text-grey-500"
              style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
            >
              {ext ?? "?"}
            </span>
          )}
        </div>

        {/* La casilla va SOBRE la miniatura: el objetivo de toque es toda la
            esquina, no un cuadrito de 14px perdido en el pie de la ficha. */}
        <label
          htmlFor={checkboxId}
          className="absolute top-2.5 left-2.5 z-10 flex items-center gap-2 cursor-pointer rounded-[10px] bg-white/95 border border-grey-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink select-none hover:border-ink"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(asset.id)}
            className="w-4 h-4 accent-[var(--color-wine)] cursor-pointer"
          />
          <span className="sr-only sm:not-sr-only">{selected ? "Elegido" : "Elegir"}</span>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 p-4 flex-1">
        <div className="min-w-0">
          <div className="text-[14.5px] font-bold text-ink truncate" title={asset.title}>
            {asset.title}
          </div>
          <div className="text-[12px] text-grey-500 mt-0.5 truncate">
            {asset.subtitle ?? kindLabel(asset.kind)}
          </div>
          {meta && (
            <div
              className="text-[11.5px] text-grey-700 mt-1"
              style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
            >
              {meta}
            </div>
          )}
        </div>

        <a
          href={`/api/marca/download/${asset.id}`}
          className="btn btn-ghost flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          style={{ height: 40, padding: "0 14px", fontSize: 13 }}
          aria-label={`Descargar ${asset.title}`}
        >
          <DownloadIcon size={15} />
        </a>
      </div>
    </div>
  );
}
