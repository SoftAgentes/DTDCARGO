/**
 * Ficha de un archivo descargable del catálogo (SDD-0238).
 *
 * Server component: no tiene estado. La miniatura sale de
 * `/api/marca/download/<id>?preview=1`, que sólo sirve inline los rasters
 * (PNG/JPG/WEBP/GIF); todo lo demás cae al bloque de extensión, que además es lo
 * que un diseñador quiere ver de un .AI o un .OTF.
 */

import { DownloadIcon } from "@/components/Icon";
import {
  extensionOf,
  formatBytes,
  kindLabel,
  type BrandAsset,
} from "@/lib/marca/catalog-types";

const RASTER = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * Fondo de la miniatura. Un logo en versión clara sobre papel blanco es un
 * cuadro vacío — los que dicen ser inversos/mono-light se muestran sobre navy.
 */
function tileBackground(asset: BrandAsset): string {
  const name = `${asset.title} ${asset.storagePath}`.toLowerCase();
  const onDark = /revers|mono-light|mono light|inverso|blanco|light/.test(name);
  return onDark ? "var(--color-ink)" : "var(--color-paper)";
}

export function AssetCard({ asset }: { asset: BrandAsset }) {
  const ext = extensionOf(asset.storagePath);
  const size = formatBytes(asset.bytes);
  const meta = [ext, size].filter(Boolean).join(" · ");
  const isRaster = asset.mime != null && RASTER.has(asset.mime);

  return (
    <div className="rounded-[16px] border border-grey-200 bg-white overflow-hidden flex flex-col">
      <div
        className="h-[132px] grid place-items-center border-b border-grey-200 p-5"
        style={{ background: tileBackground(asset) }}
      >
        {isRaster ? (
          /* La fuente es una URL firmada que caduca en 60 s: el optimizador de
             next/image la cachearía por más tiempo del que vive, y `remotePatterns`
             sólo habilita los objetos PÚBLICOS de Storage, no los firmados. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/marca/download/${asset.id}?preview=1`}
            alt={asset.title}
            loading="lazy"
            className="max-h-full max-w-full object-contain"
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
