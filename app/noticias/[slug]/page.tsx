import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { NewsDisclaimer } from "@/components/NewsDisclaimer";
import { buildWhatsAppLink, BRAND_ASSETS } from "@/lib/design-tokens";
import {
  NEWS_CATEGORIES_V4,
  gradientToCss,
} from "@/lib/news/categories";
import {
  getPostBySlug,
  getRelatedPosts,
  type NewsPostRow,
} from "@/lib/news/queries";
import { NewsMarkdown } from "@/lib/news/markdown";
import { ArrowIcon } from "@/components/Icon";
import { NewsArticleJsonLd } from "./_components/NewsArticleJsonLd";
import { FaqPageJsonLd } from "./_components/FaqPageJsonLd";

type Props = { params: Promise<{ slug: string }> };

// Sin generateStaticParams: las páginas se SSR-renderizan on-demand y se
// cachean automáticamente. `publishPost` dispara `revalidatePath` para
// invalidar tras nueva publicación. Pre-generación al build queda diferida
// — `createClient()` lee cookies y no es válido en `generateStaticParams`.

/**
 * SEO por post — title + description + canonical individuales.
 * meta_description de la DB tiene preferencia sobre excerpt si está set.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) {
    return {
      title: "Artículo no encontrado",
      robots: { index: false },
    };
  }
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
      authors: [post.author_name],
      images: [BRAND_ASSETS.ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [BRAND_ASSETS.ogImage],
    },
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

  const cat = NEWS_CATEGORIES_V4[post.categoria];
  const date = new Date(post.date).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const hasBody = post.body_markdown && post.body_markdown.trim().length > 0;
  const related = await getRelatedPosts(slug, post.categoria, 2);

  return (
    <>
      {/* JSON-LD schema.org NewsArticle + FAQPage (Plan v5 · Fase D) */}
      <NewsArticleJsonLd post={post} />
      <FaqPageJsonLd bodyMarkdown={post.body_markdown} />
      <Nav />
      <main className="bg-paper">
        <article className="py-16 lg:py-24">
          <div className="wrap max-w-[760px]">
            {/* Volver */}
            <Link
              href="/noticias"
              className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-grey-500 hover:text-wine transition-colors"
            >
              <span className="rotate-180 inline-block">
                <ArrowIcon size={14} />
              </span>
              Volver a noticias
            </Link>

            {/* Header */}
            <header className="mt-8">
              <span
                className="inline-flex px-3 py-1 rounded-full text-[10.5px] font-bold tracking-[0.12em] uppercase text-white"
                style={{ background: gradientToCss(cat.gradient) }}
              >
                {cat.label}
              </span>
              <h1
                className="h-display mt-5"
                style={{ fontSize: "clamp(34px, 4.5vw, 56px)" }}
              >
                {post.title}
              </h1>
              <div className="mt-5 flex items-center gap-3 text-[13px] text-grey-500 flex-wrap">
                <time dateTime={post.date}>{date}</time>
                <span aria-hidden>·</span>
                <span>{post.read_time_min} min lectura</span>
                {post.author_name !== "DTD Cargo" && (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      Por{" "}
                      <strong className="text-ink font-semibold">
                        {post.author_name}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </header>

            {/* Lead */}
            <p
              className="mt-8 text-[18px] lg:text-[19px] leading-[1.6] text-grey-700"
              style={{ fontWeight: 500 }}
            >
              {post.excerpt}
            </p>

            {/* Body o Coming soon */}
            {hasBody ? (
              <div className="mt-10">
                <NewsMarkdown source={post.body_markdown} />
              </div>
            ) : (
              <ComingSoonBlock post={post} />
            )}

            {/* Disclaimer del autor (si aplica) */}
            <NewsDisclaimer
              tipo={post.tipo}
              authorName={post.author_name}
              authorRole={post.author_role}
            />
          </div>
        </article>

        {/* Posts relacionados */}
        {related.length > 0 && (
          <section className="py-16 lg:py-20 border-t border-grey-200">
            <div className="wrap max-w-[1100px]">
              <h2 className="text-[14px] font-bold tracking-[0.14em] uppercase text-wine mb-8">
                Sigue leyendo
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {related.map((p) => (
                  <RelatedPostCard key={p.slug} post={p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

function ComingSoonBlock({ post }: { post: NewsPostRow }) {
  return (
    <div className="mt-10 card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-10">
      <span className="eyebrow inline-flex">Artículo en preparación</span>
      <h2
        className="mt-4 text-[22px] lg:text-[26px] leading-[1.15] tracking-[-0.01em] text-ink"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        Pronto publicamos el artículo completo.
      </h2>
      <p className="mt-3 text-[14.5px] text-grey-700 leading-[1.55] max-w-[52ch]">
        Mientras tanto, si necesitas información sobre este tema para tu
        operación, escríbenos por WhatsApp y un asesor te explica los puntos
        clave en minutos.
      </p>
      <a
        href={buildWhatsAppLink(
          `Hola DTD Cargo, vi el artículo "${post.title}" en su blog y quiero saber más al respecto antes de que lo publiquen.`,
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary mt-6 inline-flex"
      >
        Preguntar por WhatsApp <ArrowIcon />
      </a>
    </div>
  );
}

function RelatedPostCard({ post }: { post: NewsPostRow }) {
  const cat = NEWS_CATEGORIES_V4[post.categoria];
  const date = new Date(post.date).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return (
    <Link
      href={`/noticias/${post.slug}`}
      className="card-shadow bg-white border border-grey-200 rounded-[18px] overflow-hidden flex flex-col group transition-transform hover:-translate-y-1"
    >
      <div
        className="h-[100px] relative overflow-hidden"
        style={{ background: gradientToCss(cat.gradient) }}
      >
        <span className="absolute top-3 left-3 inline-flex px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-[10px] font-bold tracking-[0.12em] uppercase text-white">
          {cat.label}
        </span>
      </div>
      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-[16px] font-extrabold leading-[1.25] tracking-[-0.01em] text-ink mb-2">
          {post.title}
        </h3>
        <p className="text-[13.5px] leading-[1.55] text-grey-500 flex-1">
          {post.excerpt}
        </p>
        <div className="mt-4 pt-3 border-t border-grey-200 flex items-center justify-between text-[11.5px] text-grey-500">
          <time dateTime={post.date}>{date}</time>
          <span className="inline-flex items-center gap-1 font-semibold text-wine group-hover:text-wine-deep">
            Leer{" "}
            <ArrowIcon
              size={12}
              className="transition-transform group-hover:translate-x-1"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
