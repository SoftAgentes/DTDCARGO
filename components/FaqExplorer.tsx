"use client";

/**
 * FaqExplorer — módulo de preguntas frecuentes "híbrido" (SDD-0063 · UX FAQ):
 * buscador que filtra en vivo + chips por categoría con conteo + acordeón en un
 * solo flujo, con el CTA de WhatsApp fijo en un rail lateral. Reemplaza el
 * listado agrupado por categoría (que apilaba las 5 secciones de corrido).
 *
 * El FAQPage JSON-LD lo sigue emitiendo el server (page.tsx) con TODAS las
 * preguntas en plano — este componente solo maneja el filtrado de la UI, así
 * que el schema para los AI Overviews no depende de este estado de cliente.
 *
 * Marca: solo clases del sistema + tokens `var(--*)`. Acordeón con <details>
 * nativo (accesible, sin JS de apertura); el filtrado decide qué items se
 * renderizan.
 */

import { useEffect, useMemo, useState } from "react";
import type { Faq, FaqCategoria } from "@/lib/faqs";
import { FAQ_CATEGORIAS } from "@/lib/faqs";
import { WhatsAppIcon, ArrowIcon } from "@/components/Icon";
import { ConGlosario } from "@/components/TerminoGlosario";
import { AlibabaAddressGuide } from "@/components/AlibabaAddressGuide";
import { CbmExplicador } from "@/components/CbmExplicador";

type Filtro = "todas" | FaqCategoria;

const catLabel: Record<FaqCategoria, string> = FAQ_CATEGORIAS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.label }),
  {} as Record<FaqCategoria, string>,
);

export function FaqExplorer({ faqs, waHref }: { faqs: Faq[]; waHref: string }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  /**
   * Ancla que llegó por el hash (`/faq#cbm`) — mantiene esa pregunta abierta.
   * Se limpia cuando el visitante la cierra a mano, para no re-abrirla en el
   * siguiente render.
   */
  const [anclaAbierta, setAnclaAbierta] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Deep-link: /faq#bodega-china-shipping-mark preselecciona esa categoría.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;

      // El hash puede ser una CATEGORÍA (filtra el listado)…
      if (FAQ_CATEGORIAS.some((c) => c.id === hash)) {
        setFiltro(hash as FaqCategoria);
        return;
      }

      // …o el ANCLA de una pregunta concreta (`/faq#cbm`).
      if (faqs.some((f) => f.ancla === hash)) setAnclaAbierta(hash);
    });
    return () => {
      cancelled = true;
    };
  }, [faqs]);

  // Una vez abierta la pregunta del ancla, llevarla a la vista: el navegador
  // ya saltó al #hash con el acordeón cerrado, cuando el destino estaba en
  // otra posición de la página.
  useEffect(() => {
    if (!anclaAbierta) return;
    document
      .getElementById(anclaAbierta)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [anclaAbierta]);

  const counts = useMemo(() => {
    const m = new Map<Filtro, number>([["todas", faqs.length]]);
    for (const f of faqs) m.set(f.categoria, (m.get(f.categoria) ?? 0) + 1);
    return m;
  }, [faqs]);

  const term = query.trim().toLowerCase();
  const visibles = useMemo(
    () =>
      faqs.filter((f) => {
        const okCat = filtro === "todas" || f.categoria === filtro;
        const okTerm =
          !term || `${f.pregunta} ${f.respuesta}`.toLowerCase().includes(term);
        return okCat && okTerm;
      }),
    [faqs, filtro, term],
  );

  const chips: { id: Filtro; label: string }[] = [
    { id: "todas", label: "Todas" },
    ...FAQ_CATEGORIAS.map((c) => ({ id: c.id as Filtro, label: c.label })),
  ];

  return (
    <div className="wrap max-w-[1080px]">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 lg:gap-12 items-start">
        {/* Rail: buscador + categorías + CTA (fijo en desktop) */}
        <aside className="lg:sticky lg:top-24 flex flex-col gap-5">
          <div>
            <span className="eyebrow">Todas las preguntas</span>
            <p className="mt-2 text-[13.5px] leading-[1.55] text-grey-700 max-w-[34ch]">
              Busca por palabra o filtra por tema. Si no está aquí, te
              respondemos por WhatsApp.
            </p>
          </div>

          {/* Buscador */}
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-grey-700"
            >
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar: aduana, baterías…"
              aria-label="Buscar en preguntas frecuentes"
              autoComplete="off"
              className="h-12 w-full rounded-[11px] border border-grey-200 bg-white pl-11 pr-3.5 text-[15px] font-medium text-ink outline-none placeholder:text-grey-700/60 focus:border-wine focus-visible:ring-2 focus-visible:ring-wine-soft"
            />
          </div>

          {/* Chips de categoría con conteo */}
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrar por categoría"
          >
            {chips.map((c) => {
              const active = filtro === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFiltro(c.id)}
                  className={`inline-flex items-center gap-1.5 h-8 rounded-full border px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft ${
                    active
                      ? "border-wine text-white"
                      : "border-grey-200 bg-white text-grey-700 hover:border-wine hover:text-wine"
                  }`}
                  style={active ? { background: "var(--color-wine)" } : undefined}
                >
                  {c.label}
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ fontFamily: "var(--font-mono)", opacity: 0.75 }}
                  >
                    {counts.get(c.id) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* CTA fijo */}
          <div className="card-shadow rounded-[16px] bg-ink text-white p-5">
            <p className="text-[14px] leading-[1.45] text-white/80">
              <strong className="font-bold text-white">
                ¿No encuentras tu respuesta?
              </strong>{" "}
              Un asesor te ayuda con tu envío, tu Shipping Mark o tu cotización.
            </p>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary mt-4 w-full justify-center"
            >
              <WhatsAppIcon size={18} /> Escríbenos por WhatsApp
            </a>
            <a
              href="/tarifas"
              className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-white/85 hover:text-white underline underline-offset-4 decoration-1"
            >
              Calcular mi envío <ArrowIcon size={15} />
            </a>
          </div>
        </aside>

        {/* Acordeón filtrado */}
        <section>
          <p className="mb-3 pl-0.5 text-[12.5px] font-semibold text-grey-700">
            <span className="text-ink tabular-nums">{visibles.length}</span>{" "}
            {visibles.length === 1 ? "pregunta" : "preguntas"}
            {(filtro !== "todas" || term) && " · filtrado"}
          </p>

          {visibles.length === 0 ? (
            <div className="rounded-[14px] border border-grey-200 bg-white px-5 py-10 text-center text-[14.5px] leading-[1.6] text-grey-700 card-shadow">
              No hay preguntas que coincidan con tu búsqueda. Prueba con otra
              palabra o escríbenos por WhatsApp.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visibles.map((f) => (
                <details
                  key={f.pregunta}
                  id={f.ancla}
                  open={f.ancla && f.ancla === anclaAbierta ? true : undefined}
                  onToggle={(e) => {
                    // Sin esto el <details> quedaría clavado abierto: `open`
                    // está controlado mientras dure el ancla, así que cerrarlo
                    // a mano tiene que soltar el estado.
                    if (
                      f.ancla &&
                      f.ancla === anclaAbierta &&
                      !e.currentTarget.open
                    ) {
                      setAnclaAbierta(null);
                    }
                  }}
                  className="group rounded-[14px] border border-grey-200 bg-white px-5 card-shadow scroll-mt-24"
                >
                  <summary className="flex items-start justify-between gap-4 cursor-pointer list-none py-5 rounded-[14px] [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine-soft">
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-wine-text mb-1.5">
                        {catLabel[f.categoria]}
                      </span>
                      <span className="block text-[16px] lg:text-[17px] font-extrabold leading-[1.35] text-ink">
                        {f.pregunta}
                      </span>
                    </span>
                    <span className="mt-0.5 flex-shrink-0 text-[22px] leading-none text-wine transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  {f.widget === "alibaba-guide" ? (
                    <div className="-mt-1 pb-5">
                      <AlibabaAddressGuide />
                    </div>
                  ) : f.widget === "cbm-explicador" ? (
                    <CbmExplicador />
                  ) : f.bloques ? (
                    <div className="-mt-1 flex flex-col gap-3 pb-5 text-[14.5px] leading-[1.65] text-grey-700">
                      {f.bloques.map((b, bi) =>
                        b.tipo === "lista" ? (
                          <ul key={bi} className="flex flex-col gap-1.5">
                            {b.items.map((it) => (
                              <li key={it} className="flex gap-2.5">
                                <span
                                  aria-hidden
                                  className="mt-[8px] h-[5px] w-[5px] flex-shrink-0 rounded-full"
                                  style={{ background: "var(--color-wine)" }}
                                />
                                <span>{it}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p key={bi}>
                            <ConGlosario>{b.texto}</ConGlosario>
                          </p>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="-mt-1 pb-5 text-[14.5px] leading-[1.65] text-grey-700">
                      <ConGlosario>{f.respuesta}</ConGlosario>
                    </p>
                  )}
                </details>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
