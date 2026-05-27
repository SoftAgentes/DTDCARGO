import type { Metadata } from "next";
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
import { ArrowIcon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Noticias y guías",
  description:
    "Tutoriales, novedades operativas y análisis del corredor logístico China-Venezuela. Guías de Incoterms, tiempos de tránsito, regulaciones aduaneras y más.",
  keywords: [
    "blog logística China Venezuela",
    "guía incoterms",
    "tiempos puerto cabello",
    "tutorial importación",
  ],
  alternates: { canonical: "/noticias" },
  openGraph: {
    title: "Noticias y guías · DTD Cargo",
    url: "/noticias",
  },
};

export default function NoticiasPage() {
  // Ordenar por fecha descendente (más reciente primero)
  const sortedPosts = [...NEWS_POSTS].sort((a, b) =>
    a.date < b.date ? 1 : -1,
  );

  return (
    <>
      <Nav />
      <main className="bg-paper">
        {/* Hero */}
        <section className="py-16 lg:py-24">
          <div className="wrap max-w-[1100px]">
            <span className="eyebrow">Noticias · DTD Cargo</span>
            <h1
              className="h-display mt-5"
              style={{ fontSize: "clamp(40px, 5.5vw, 76px)" }}
            >
              Lo que pasa
              <br />
              <span style={{ color: "var(--color-wine)" }}>
                en el corredor.
              </span>
            </h1>
            <p className="lead mt-6 max-w-[58ch]">
              Análisis, tutoriales y novedades sobre el comercio China-Venezuela.
              Cosas que aprendemos en la operación y queremos compartir con
              importadores que recién arrancan o ya tienen oficio.
            </p>
          </div>
        </section>

        {/* Posts grid */}
        <section className="pb-20">
          <div className="wrap max-w-[1100px]">
            {sortedPosts.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedPosts.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA suscripción */}
        <section className="pb-20">
          <div className="wrap max-w-[760px]">
            <div className="card-shadow-dark bg-ink text-white rounded-[18px] p-8 lg:p-10 text-center">
              <span
                className="eyebrow inline-flex"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                No te pierdas nada
              </span>
              <h3
                className="mt-4 text-[24px] lg:text-[28px] leading-[1.15] tracking-[-0.01em] text-white"
                style={{ fontFamily: "var(--font-archivo-black)" }}
              >
                Recibí las novedades por WhatsApp.
              </h3>
              <p className="mt-3 text-[14.5px] text-white/70 leading-[1.55] max-w-[48ch] mx-auto">
                Te avisamos cuando publicamos guías nuevas, cambios en aduana o
                tarifas actualizadas del corredor. Sin spam — solo lo
                importante.
              </p>
              <a
                href={buildWhatsAppLink(
                  "Hola DTD Cargo, quiero recibir las novedades del corredor por WhatsApp.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary mt-6 inline-flex"
              >
                Suscribirme por WhatsApp <ArrowIcon />
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

function PostCard({ post }: { post: NewsPost }) {
  const cat = NEWS_CATEGORIES[post.category];
  const date = new Date(post.date).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const hasBody = post.body && post.body.length > 0;

  return (
    <Link
      href={`/noticias/${post.slug}`}
      className="card-shadow bg-white border border-grey-200 rounded-[18px] overflow-hidden flex flex-col group transition-transform hover:-translate-y-1"
    >
      {/* Cover decorativo — gradient por categoría sin imagen */}
      <div
        className="h-[140px] relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}dd 100%)`,
        }}
      >
        <span className="absolute top-4 left-4 inline-flex px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[10.5px] font-bold tracking-[0.12em] uppercase text-white">
          {cat.label}
        </span>
      </div>

      {/* Contenido */}
      <div className="p-6 lg:p-7 flex flex-col flex-1">
        <h3 className="text-[18px] font-extrabold leading-[1.25] tracking-[-0.01em] text-ink mb-3">
          {post.title}
        </h3>
        <p className="text-[14px] leading-[1.55] text-grey-700 flex-1">
          {post.excerpt}
        </p>
        <div className="mt-5 pt-5 border-t border-grey-200 flex items-center justify-between text-[12px] text-grey-500">
          <time dateTime={post.date}>{date}</time>
          <span>{post.readTimeMin} min lectura</span>
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-wine group-hover:text-wine-deep transition-colors">
          {hasBody ? "Leer artículo" : "Próximamente · Ver detalle"}{" "}
          <ArrowIcon
            size={14}
            className="transition-transform group-hover:translate-x-1"
          />
        </span>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
      <p className="text-[15px] text-grey-700">
        Próximamente nuestros primeros artículos. Mientras tanto,{" "}
        <a
          href="/glosario"
          className="font-semibold text-wine hover:text-wine-deep underline underline-offset-2"
        >
          revisa el glosario
        </a>
        .
      </p>
    </div>
  );
}
