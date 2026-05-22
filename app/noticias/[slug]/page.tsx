import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import {
  NEWS_POSTS,
  NEWS_CATEGORIES,
  buildWhatsAppLink,
  type NewsPost,
} from "@/lib/design-tokens";
import { renderBolded } from "@/lib/text";
import { ArrowIcon } from "@/components/Icon";

type Props = { params: Promise<{ slug: string }> };

/**
 * Static params — Next.js pre-genera una página por cada post en NEWS_POSTS.
 * Cuando se agrega un nuevo post al array, queda automáticamente accesible
 * en su slug sin tocar este archivo.
 */
export async function generateStaticParams() {
  return NEWS_POSTS.map((post) => ({ slug: post.slug }));
}

/**
 * SEO por post — title + description individuales.
 * OpenGraph hereda del layout.tsx pero el title específico aplica al share.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = NEWS_POSTS.find((p) => p.slug === slug);
  if (!post) {
    return {
      title: "Artículo no encontrado",
      robots: { index: false },
    };
  }
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.date,
    },
  };
}

export default async function NewsPostPage({ params }: Props) {
  const { slug } = await params;
  const post = NEWS_POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  const cat = NEWS_CATEGORIES[post.category];
  const date = new Date(post.date).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const hasBody = post.body && post.body.length > 0;

  // Posts relacionados: misma categoría primero, luego cualquier otro
  const related = NEWS_POSTS.filter((p) => p.slug !== slug)
    .sort((a, b) => {
      if (a.category === post.category && b.category !== post.category) return -1;
      if (b.category === post.category && a.category !== post.category) return 1;
      return a.date < b.date ? 1 : -1;
    })
    .slice(0, 2);

  return (
    <>
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
                style={{ background: cat.color }}
              >
                {cat.label}
              </span>
              <h1
                className="h-display mt-5"
                style={{ fontSize: "clamp(34px, 4.5vw, 56px)" }}
              >
                {post.title}
              </h1>
              <div className="mt-5 flex items-center gap-3 text-[13px] text-grey-500">
                <time dateTime={post.date}>{date}</time>
                <span aria-hidden>·</span>
                <span>{post.readTimeMin} min lectura</span>
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
              <div className="mt-10 flex flex-col gap-5">
                {post.body!.map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-[16px] leading-[1.7] text-grey-700"
                  >
                    {renderBolded(paragraph)}
                  </p>
                ))}
              </div>
            ) : (
              <ComingSoonBlock post={post} />
            )}
          </div>
        </article>

        {/* Posts relacionados */}
        {related.length > 0 && (
          <section className="py-16 lg:py-20 border-t border-grey-200">
            <div className="wrap max-w-[1100px]">
              <h2
                className="text-[14px] font-bold tracking-[0.14em] uppercase text-wine mb-8"
              >
                Seguí leyendo
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

function ComingSoonBlock({ post }: { post: NewsPost }) {
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
        operación, escribinos por WhatsApp y un asesor te explica los puntos
        clave en minutos.
      </p>
      <a
        href={buildWhatsAppLink(
          `Hola DTD-CARGO, vi el artículo "${post.title}" en su blog y quiero saber más al respecto antes de que lo publiquen.`,
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

function RelatedPostCard({ post }: { post: NewsPost }) {
  const cat = NEWS_CATEGORIES[post.category];
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
        style={{
          background: `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}dd 100%)`,
        }}
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
