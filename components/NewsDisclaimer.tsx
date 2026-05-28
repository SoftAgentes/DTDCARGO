/**
 * NewsDisclaimer · Plan v4 · Phase F
 *
 * Bloque al pie de un artículo público que aclara la autoría externa cuando
 * aplica. No se renderiza si:
 *  - El post fue escrito directamente por DTD Cargo (author = "DTD Cargo")
 *  - El tipo es "especial" (Anuncios DTD)
 *  - No hay author_role (legacy seed manual sin disclaimer)
 *
 * El texto del disclaimer se deriva del tipo + nombre vía `getDisclaimer()`
 * en lib/news/writers.ts (single source of truth — el mismo helper lo usa
 * el PublishModal del Studio para preview).
 */

import React from "react";
import { getDisclaimer } from "@/lib/news/writers";
import type { NewsTipo } from "@/lib/news/categories";

interface Props {
  tipo: NewsTipo;
  authorName: string;
  authorRole: string | null;
}

export function NewsDisclaimer({ tipo, authorName, authorRole }: Props) {
  // Sin disclaimer cuando es DTD Cargo directo o especial
  if (!authorRole || authorName === "DTD Cargo") return null;

  const text = getDisclaimer(tipo, authorName);
  if (!text) return null;

  return (
    <aside
      aria-label="Disclaimer del autor"
      className="mt-12 border-t border-grey-200 pt-8"
    >
      <div className="card-shadow bg-white border border-grey-200 rounded-[14px] p-6 lg:p-7">
        <div className="flex items-start gap-4">
          <span
            className="flex-shrink-0 w-10 h-10 rounded-full grid place-items-center text-white font-bold text-[14px]"
            style={{ background: "var(--color-wine, #7F0F1A)" }}
            aria-hidden
          >
            {authorName
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0])
              .join("")
              .toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-wine">
                {authorRole}
              </span>
              <span
                className="text-[16px] font-extrabold text-ink leading-tight"
              >
                {authorName}
              </span>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.6] text-grey-700 italic">
              {text}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
