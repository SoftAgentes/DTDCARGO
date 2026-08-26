"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowIcon, SearchIcon } from "@/components/Icon";
import {
  buildTypeChips,
  filterDocs,
  type PortalDocView,
} from "@/lib/portal/documentos-filter";

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

/**
 * Grilla de Documentos con **chips por tipo** (con conteo) y **buscador**
 * (SDD-0171 · Norte `PortalDocuments`). Antes era una grilla pelada: con 30
 * documentos de 8 envíos, encontrar un BL concreto era ir a ojo.
 *
 * La lógica de filtrado vive pura en `lib/portal/documentos-filter`; acá solo
 * estado de interfaz. El servidor manda las filas ya aplanadas (etiquetas, meta
 * y signed URL resueltas) para no arrastrar tipos de `lib/studio` al cliente.
 */
export function DocumentsClient({ docs }: { docs: PortalDocView[] }) {
  const [type, setType] = useState("todos");
  const [query, setQuery] = useState("");

  const chips = useMemo(() => buildTypeChips(docs), [docs]);
  const list = useMemo(() => filterDocs(docs, { type, query }), [docs, type, query]);

  return (
    <div>
      {/* Chips por tipo + buscador */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-paper border border-grey-200">
          {chips.map((c) => {
            const on = type === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setType(c.key)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  on ? "bg-white text-wine-text card-shadow" : "text-grey-500 hover:text-ink"
                }`}
              >
                {c.label}
                <span
                  className={`text-[10.5px] ${on ? "text-wine-text" : "text-grey-500"}`}
                  style={{ fontFamily: MONO }}
                >
                  {c.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* SDD-0306 · desde que entran los packing lists el buscador también
            acepta el código de la COMPRA (`filterDocs` mira `purchaseCode`).
            El placeholder decía sólo "envío" y escondía la mitad de lo que la
            búsqueda ya sabe hacer. */}
        <label className="relative flex-1 min-w-[200px] max-w-[320px]">
          <span className="sr-only">Buscar documentos</span>
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-grey-500"
          >
            <SearchIcon size={15} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por tipo, envío o compra…"
            className="w-full h-10 pl-9 pr-3 rounded-full bg-white border border-grey-200 text-[13px] text-ink placeholder:text-grey-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
        </label>
      </div>

      {list.length === 0 ? (
        <div className="mt-6 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
          <div className="text-[15px] font-bold text-ink">
            Ningún documento coincide.
          </div>
          <p className="mt-2 text-[13.5px] text-grey-700">
            Prueba con otro tipo o borra la búsqueda.
          </p>
        </div>
      ) : (
        <div
          className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          aria-live="polite"
        >
          {list.map((doc) => (
            <DocCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocCard({ doc }: { doc: PortalDocView }) {
  // Un documento cuelga de un envío o de una compra, nunca de los dos. El
  // subtítulo lo dice con todas las letras: "Compra PRE-…" no es "Envío
  // DTD-…", y el cliente busca por uno o por el otro.
  const abre = doc.kind === "abrir";
  const contexto = doc.purchaseCode
    ? `Compra ${doc.purchaseCode}`
    : doc.shipmentCode
      ? `Envío ${doc.shipmentCode}`
      : null;
  const etiquetaAccesible = `${abre ? "Ver" : "Descargar"} ${doc.typeLabel}${
    contexto ? ` · ${contexto}` : ""
  }`;

  const body = (
    <>
      <div className="flex items-center gap-3">
        <span
          className="text-[10px] font-bold tracking-wide text-wine-text bg-paper border border-grey-200 rounded-md px-2 py-1 flex-shrink-0"
          style={{ fontFamily: MONO }}
        >
          {doc.typeShort}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-ink truncate">
            {doc.typeLabel}
          </div>
          {contexto && (
            <div
              className="text-[12px] text-grey-500 truncate"
              style={{ fontFamily: MONO }}
            >
              {contexto}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-grey-200 flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-grey-500">{doc.meta}</span>
        {doc.url ? (
          <span className="text-[12.5px] font-semibold text-wine-text inline-flex items-center gap-1">
            {abre ? "Ver" : "Descargar"}{" "}
            <ArrowIcon
              size={13}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </span>
        ) : (
          <span className="text-[12px] text-grey-500">No se pudo abrir</span>
        )}
      </div>
    </>
  );

  if (!doc.url) {
    return (
      <div className="bg-white border border-grey-200 rounded-[16px] p-5 opacity-70">
        {body}
      </div>
    );
  }

  const clase =
    "card-link group block bg-white border border-grey-200 rounded-[16px] p-5 transition-colors hover:border-ink focus-visible:border-ink";

  // SDD-0306 · un documento que vive DENTRO del portal (hoy el packing list del
  // proveedor) no se descarga: se abre. Sacarlo en pestaña nueva con `<a
  // target="_blank">` lo trataría como un archivo externo — perdería la
  // navegación del portal y le mentiría al cliente sobre lo que va a pasar.
  if (abre) {
    return (
      <Link href={doc.url} className={clase} aria-label={etiquetaAccesible}>
        {body}
      </Link>
    );
  }

  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      className={clase}
      aria-label={etiquetaAccesible}
    >
      {body}
    </a>
  );
}
