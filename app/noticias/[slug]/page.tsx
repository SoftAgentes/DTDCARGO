import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { NewsDisclaimer } from "@/components/NewsDisclaimer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { getCategoryInfo } from "@/lib/news/categories";
import {
  CONTENT_KIND_LABELS,
  contentKindOf,
  editorialImageOf,
} from "@/lib/news/editorial";
import { extractNewsHeadings, NewsMarkdown } from "@/lib/news/markdown";
import type { NewsPostRow } from "@/lib/news/types";
import { getPostBySlug, getRelatedPosts } from "@/lib/public/news-queries";
import { EditorialIcon } from "../_components/EditorialIcon";
import { NewsletterCard } from "../_components/NewsletterCard";
import { NewsArticleJsonLd } from "./_components/NewsArticleJsonLd";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Contenido no encontrado", robots: { index: false } };

  const description = post.meta_description || post.excerpt;
  return {
    title: { absolute: post.title },
    description,
    alternates: { canonical: `/noticias/${slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url: `/noticias/${slug}`,
      publishedTime: post.date,
      modifiedTime: post.updated_at || undefined,
      authors: [post.author_name],
      section: getCategoryInfo(post.categoria).label,
    },
    twitter: { card: "summary_large_image", title: post.title, description },
    keywords: [
      ...(post.focus_keyword ? [post.focus_keyword] : []),
      ...post.secondary_keywords,
    ],
  };
}

export default async function NewsPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const category = getCategoryInfo(post.categoria);
  const kind = contentKindOf(post);
  const image = editorialImageOf(post);
  const headings = extractNewsHeadings(post.body_markdown);
  const related = await getRelatedPosts(slug, post.categoria, 3);
  const hasBody = post.body_markdown.trim().length > 0;

  return (
    <>
      <NewsArticleJsonLd post={post} />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Actualidad", path: "/noticias" },
          { name: post.title, path: `/noticias/${slug}` },
        ]}
      />
      <Nav />
      <main className="rp-surface actualidad-surface actual-article-surface">
        <header className="actual-article-header">
          <div className="actual-article-wrap">
            <Link className="actual-back-link" href="/noticias">← Volver a Actualidad</Link>
            <div className="actual-article-kickers">
              <span>{CONTENT_KIND_LABELS[kind]}</span>
              <span>{category.label}</span>
            </div>
            <h1>{post.title}</h1>
            <p>{post.excerpt}</p>
            <ArticleMeta post={post} />
          </div>
        </header>

        <div className="actual-article-wrap actual-cover">
          <Image src={image.src} alt={image.alt} fill loading="eager" sizes="(max-width: 900px) 100vw, 980px" />
        </div>

        <div className="actual-article-wrap actual-article-grid">
          {headings.length > 1 && <ArticleToc headings={headings} />}
          <article className="actual-article-body">
            <section className="actual-answer" aria-labelledby="respuesta-directa">
              <p className="actual-section-label">Respuesta directa</p>
              <h2 id="respuesta-directa" className="sr-only">Respuesta directa</h2>
              <p>{post.excerpt}</p>
            </section>

            {headings.length > 1 && (
              <details className="actual-mobile-toc">
                <summary>En esta guía</summary>
                <ol>{headings.map((heading) => <li key={heading.id} className={heading.level === 3 ? "is-child" : ""}><a href={`#${heading.id}`}>{heading.text}</a></li>)}</ol>
              </details>
            )}

            {hasBody ? <NewsMarkdown source={post.body_markdown} /> : <ComingSoonBlock post={post} />}

            <NewsDisclaimer tipo={post.tipo} authorName={post.author_name} authorRole={post.author_role} />
            <NewsletterCard compact />
          </article>
        </div>

        {related.length > 0 && (
          <section className="actual-article-wrap actual-related" aria-labelledby="related-title">
            <h2 id="related-title" className="actual-section-label">Sigue leyendo</h2>
            <div>{related.map((item) => <RelatedCard key={item.id} post={item} />)}</div>
          </section>
        )}
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

function ArticleMeta({ post }: { post: NewsPostRow }) {
  const published = formatLongDate(post.date);
  const updated = post.updated_at ? formatLongDate(post.updated_at) : null;
  return (
    <div className="actual-article-meta">
      <span>Publicado el <time dateTime={post.date}>{published}</time></span>
      {updated && updated !== published && <span>Actualizado el <time dateTime={post.updated_at ?? undefined}>{updated}</time></span>}
      <span>{post.read_time_min} min de lectura</span>
      <span>Por {post.author_name}{post.author_role ? ` · ${post.author_role}` : ""}</span>
      {post.reviewer_name && <span>Revisado por {post.reviewer_name}{post.reviewer_role ? ` · ${post.reviewer_role}` : ""}</span>}
    </div>
  );
}

function ArticleToc({ headings }: { headings: ReturnType<typeof extractNewsHeadings> }) {
  return (
    <aside className="actual-desktop-toc" aria-labelledby="toc-title">
      <h2 id="toc-title">En este contenido</h2>
      <ol>{headings.map((heading) => <li key={heading.id} className={heading.level === 3 ? "is-child" : ""}><a href={`#${heading.id}`}>{heading.text}</a></li>)}</ol>
    </aside>
  );
}

function ComingSoonBlock({ post }: { post: NewsPostRow }) {
  return (
    <div className="actual-coming-soon">
      <p className="actual-section-label">Contenido en preparación</p>
      <h2>Pronto publicaremos la guía completa.</h2>
      <p>Si necesitas esta información para una operación activa, un asesor puede orientarte por WhatsApp.</p>
      <a href={buildWhatsAppLink(`Hola DTD Cargo, quiero consultar sobre "${post.title}".`)} target="_blank" rel="noopener noreferrer">
        Consultar por WhatsApp <EditorialIcon name="arrow" />
      </a>
    </div>
  );
}

function RelatedCard({ post }: { post: NewsPostRow }) {
  const image = editorialImageOf(post);
  return (
    <Link href={`/noticias/${post.slug}`} className="actual-related-card">
      <span className="actual-related-image"><Image src={image.src} alt="" fill sizes="(max-width: 700px) 100vw, 33vw" /></span>
      <span><em>{CONTENT_KIND_LABELS[contentKindOf(post)]}</em><strong>{post.title}</strong><small>{post.read_time_min} min de lectura</small></span>
    </Link>
  );
}

function formatLongDate(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  return new Date(normalized).toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Caracas" });
}
