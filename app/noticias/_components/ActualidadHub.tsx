"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ALL_CATEGORIA_SLUGS,
  getCategoryInfo,
  type NewsCategoria,
} from "@/lib/news/categories";
import {
  CONTENT_KIND_LABELS,
  contentKindOf,
  editorialImageOf,
  matchesEditorialSearch,
} from "@/lib/news/editorial";
import type { NewsPostRow } from "@/lib/news/types";
import { TRACKING_EN_CONSTRUCCION } from "@/lib/portal/tracking-en-construccion";
import { EditorialIcon } from "./EditorialIcon";
import { NewsletterCard } from "./NewsletterCard";

const PAGE_SIZE = 12;
const SEARCH_THRESHOLD = 8;

const CATEGORY_DESCRIPTIONS: Record<NewsCategoria, string> = {
  "importa-sin-perder-plata": "Compra, flete, impuestos y decisiones de costo.",
  "que-se-mueve-en-china": "Productos, proveedores y tendencias en origen.",
  "como-llega-tu-mercancia": "Tránsito, documentos y opciones de envío.",
  "venezuela-y-tu-bolsillo": "Aduana, divisas y costos locales.",
  "historias-reales": "Experiencias de importadores como tú.",
  "novedades-dtd": "Avisos y cambios que afectan tu operación.",
};

const QUICK_ACTIONS = [
  // SDD-0521 · mientras el seguimiento esté en construcción (SDD-0514), el
  // acceso lleva al mismo lugar sin prometer rastreo.
  {
    href: "/entrar",
    label: TRACKING_EN_CONSTRUCCION ? "Entrar a mi portal" : "Rastrear un envío",
  },
  { href: "/fcl", label: "Ver referencia FCL" },
  { href: "/servicios/lcl", label: "Elegir LCL o FCL" },
  { href: "/servicios/inspeccion", label: "Verificar proveedor" },
];

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ActualidadHub({ posts }: { posts: NewsPostRow[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<NewsCategoria | "all">("all");
  const [page, setPage] = useState(1);
  const searchRef = useRef<HTMLInputElement>(null);

  const visibleCategories = useMemo(
    () => ALL_CATEGORIA_SLUGS.filter((slug) => posts.some((post) => post.categoria === slug)),
    [posts],
  );

  const filtered = useMemo(
    () =>
      posts.filter(
        (post) =>
          (category === "all" || post.categoria === category) &&
          matchesEditorialSearch(post, query),
      ),
    [category, posts, query],
  );

  const featured = filtered.find((post) => post.featured) ?? filtered[0] ?? null;
  const remaining = featured ? filtered.filter((post) => post.id !== featured.id) : filtered;
  const latest = remaining.slice(0, 3);
  const archive = remaining.slice(3);
  const pageCount = Math.max(1, Math.ceil(archive.length / PAGE_SIZE));
  const pagedArchive = archive.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtersActive = Boolean(query.trim()) || category !== "all";

  function selectCategory(next: NewsCategoria) {
    setCategory((current) => (current === next ? "all" : next));
    setPage(1);
    document.querySelector("#contenido")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setPage(1);
  }

  return (
    <main className="rp-surface actualidad-surface">
      <section className="actual-hero" aria-labelledby="actualidad-title">
        <div className="actual-wrap">
          <p className="actual-eyebrow"><span />Recursos para importar</p>
          <h1 id="actualidad-title">Actualidad, guía y noticias</h1>
          <p className="actual-hero-copy">
            Información clara para comprar, enviar y recibir mercancía de China a Venezuela.
          </p>

          {posts.length >= SEARCH_THRESHOLD && (
            <form className="actual-search" role="search" onSubmit={(event) => event.preventDefault()}>
              <EditorialIcon name="search" />
              <label className="sr-only" htmlFor="actualidad-search">Buscar en Actualidad</label>
              <input
                ref={searchRef}
                id="actualidad-search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                placeholder="Busca costos, tiempos, proveedores o rastreo"
              />
              <button type="submit">Buscar</button>
            </form>
          )}

          <div className="actual-quick-actions" aria-label="Accesos rápidos">
            <span>También puedes:</span>
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.href} href={action.href}>{action.label}</Link>
            ))}
          </div>
        </div>
      </section>

      {visibleCategories.length > 0 && (
        <nav className="actual-category-band" aria-label="Categorías editoriales">
          <div className="actual-wrap actual-category-scroll">
            {visibleCategories.map((slug) => {
              const info = getCategoryInfo(slug);
              const active = category === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  className={active ? "is-active" : ""}
                  aria-pressed={active}
                  onClick={() => selectCategory(slug)}
                >
                  <EditorialIcon category={slug} />
                  <span><strong>{info.label}</strong><small>{CATEGORY_DESCRIPTIONS[slug]}</small></span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <section id="contenido" className="actual-wrap actual-content" aria-live="polite">
        {filtersActive && (
          <div className="actual-filter-summary">
            <p>{filtered.length ? `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}` : "No encontramos resultados"}{query && <> para <strong>“{query}”</strong></>}</p>
            <button type="button" onClick={clearFilters}>Limpiar filtros</button>
          </div>
        )}

        {!featured ? (
          <div className="actual-empty">
            <EditorialIcon name="search" />
            <h2>{posts.length ? "Prueba con otra búsqueda" : "Pronto encontrarás contenido aquí"}</h2>
            <p>{posts.length ? "Busca por costos, tiempos, proveedores, rastreo o elige otra categoría." : "Estamos preparando guías y noticias útiles para tus próximas importaciones."}</p>
            {filtersActive && <button type="button" onClick={() => { clearFilters(); searchRef.current?.focus(); }}>Ver todo el contenido</button>}
          </div>
        ) : (
          <>
            <div className="actual-top-grid">
              <section aria-labelledby="actual-feature-label">
                <p id="actual-feature-label" className="actual-section-label">Recomendado para empezar</p>
                <FeatureCard post={featured} />
              </section>
              <aside aria-labelledby="actual-latest-label">
                <h2 id="actual-latest-label" className="actual-section-label">Últimas del corredor</h2>
                {latest.length ? <div className="actual-latest-list">{latest.map((post) => <LatestRow key={post.id} post={post} />)}</div> : <p className="actual-compact-empty">Publicaremos nuevas actualizaciones aquí.</p>}
              </aside>
            </div>

            <div className="actual-lower-grid">
              <section aria-labelledby="actual-archive-label">
                <h2 id="actual-archive-label" className="actual-section-label">Explora el contenido</h2>
                {pagedArchive.length ? <div className="actual-archive-list">{pagedArchive.map((post) => <ArchiveRow key={post.id} post={post} />)}</div> : <p className="actual-compact-empty">Las siguientes publicaciones aparecerán aquí.</p>}
                {pageCount > 1 && (
                  <nav className="actual-pagination" aria-label="Paginación del archivo">
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                      <button key={number} type="button" aria-current={page === number ? "page" : undefined} onClick={() => setPage(number)}>{number}</button>
                    ))}
                  </nav>
                )}
              </section>
              <NewsletterCard />
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function FeatureCard({ post }: { post: NewsPostRow }) {
  const image = editorialImageOf(post);
  return (
    <article className="actual-feature-card">
      <Link href={`/noticias/${post.slug}`} className="actual-feature-image" tabIndex={-1} aria-hidden="true">
        <Image src={image.src} alt="" fill loading="eager" sizes="(max-width: 900px) 100vw, 58vw" />
      </Link>
      <div className="actual-feature-copy">
        <span className="actual-kind">{CONTENT_KIND_LABELS[contentKindOf(post)]}</span>
        <h2><Link href={`/noticias/${post.slug}`}>{post.title}</Link></h2>
        <p>{post.excerpt}</p>
        <Meta post={post} />
        <Link className="actual-text-link" href={`/noticias/${post.slug}`}>Leer contenido <EditorialIcon name="arrow" /></Link>
      </div>
    </article>
  );
}

function LatestRow({ post }: { post: NewsPostRow }) {
  return (
    <Link className="actual-latest-row" href={`/noticias/${post.slug}`}>
      <span><em>{CONTENT_KIND_LABELS[contentKindOf(post)]}</em><strong>{post.title}</strong><small>{dateLabel(post.date)}<i />{post.read_time_min} min</small></span>
      <EditorialIcon name="arrow" />
    </Link>
  );
}

function ArchiveRow({ post }: { post: NewsPostRow }) {
  const image = editorialImageOf(post);
  return (
    <Link className="actual-archive-row" href={`/noticias/${post.slug}`}>
      <Image src={image.src} alt="" width={160} height={104} />
      <span className="actual-archive-copy">
        <em>{CONTENT_KIND_LABELS[contentKindOf(post)]} · {getCategoryInfo(post.categoria).label}</em>
        <strong>{post.title}</strong>
        <small>{post.excerpt}</small>
        <b>{post.read_time_min} min de lectura <EditorialIcon name="arrow" /></b>
      </span>
    </Link>
  );
}

function Meta({ post }: { post: NewsPostRow }) {
  return (
    <div className="actual-meta">
      <span><EditorialIcon name="calendar" />{dateLabel(post.date)}</span>
      <span><EditorialIcon name="clock" />{post.read_time_min} min de lectura</span>
    </div>
  );
}
