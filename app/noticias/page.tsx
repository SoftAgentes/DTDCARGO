import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo-og";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import {
  getCategoryInfo,
  gradientToCss,
} from "@/lib/news/categories";
import { listPublishedPosts, type NewsPostRow } from "@/lib/news/queries";
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
  ...socialMeta({
    title: "Noticias y guías · DTD Cargo",
    description:
      "Tutoriales, novedades operativas y análisis del corredor logístico China-Venezuela. Guías de Incoterms, tiempos de tránsito, regulaciones aduaneras y más.",
    path: "/noticias",
  }),
};

export default async function NoticiasPage() {
  // Plan v4 · Phase F — posts vienen de la tabla news_posts (anon SELECT
  // permite leer published=true gracias a la policy news_posts_public_select).
  const posts = await listPublishedPosts();

  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Noticias", path: "/noticias" },
        ]}
      />
      {/* Revestido al Norte (`Noticias · DTD-Cargo.html`): hero navy `rp-*` +
          cuerpo sobre papel. El grid de tarjetas se conserva (el mockup solo
          dibuja el estado vacío) y el estado vacío sí se copia tal cual. */}
      <main className="rp-surface" style={{ ["--rp-w" as string]: "1100px" }}>
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Recursos
            </div>
            <h1>
              Lo que pasa <span className="accent">en el corredor.</span>
            </h1>
            <p>
              Novedades y avisos de DTD Cargo: cambios de tarifa, feriados que
              afectan tránsito y anuncios del servicio. Más lo que aprendemos en
              la operación y queremos compartir con importadores.
            </p>
          </div>
        </section>

        <div className="rp-body">
          {posts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </div>

        {/* CTA suscripción */}
        <div className="rp-sec" style={{ ["--rp-w" as string]: "760px" }}>
          <div className="rp-cta">
            <p className="rp-kicker">
              <span className="rule" />
              No te pierdas nada
            </p>
            <h2>Recibe las novedades por WhatsApp.</h2>
            <p>
              Te avisamos cuando publicamos guías nuevas, cambios en aduana o
              tarifas actualizadas del corredor. Sin spam — solo lo importante.
            </p>
            <a
              href={buildWhatsAppLink(
                "Hola DTD Cargo, quiero recibir las novedades del corredor por WhatsApp.",
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Suscribirme por WhatsApp <ArrowIcon />
            </a>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

function PostCard({ post }: { post: NewsPostRow }) {
  const cat = getCategoryInfo(post.categoria);
  const date = new Date(post.date).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const hasBody = post.body_markdown && post.body_markdown.trim().length > 0;

  return (
    <Link
      href={`/noticias/${post.slug}`}
      className="card-shadow bg-white border border-grey-200 rounded-[18px] overflow-hidden flex flex-col group transition-transform hover:-translate-y-1"
    >
      {/* Cover decorativo — gradient v4 from→to por categoría */}
      <div
        className="h-[140px] relative overflow-hidden"
        style={{ background: gradientToCss(cat.gradient) }}
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
          <span>{post.read_time_min} min lectura</span>
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

/* Estado vacío copiado del mockup `Noticias · DTD-Cargo.html` (`.nw-empty`):
   ícono de periódico en tinte wine + titular + salida a WhatsApp. Se conserva
   el puente al glosario que ya tenía producción. */
function EmptyState() {
  return (
    <div className="nw-empty">
      <div className="ic">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 5h13v14H6a2 2 0 0 1-2-2z" />
          <path d="M17 8h3v9a2 2 0 0 1-2 2" />
          <path d="M7 8.5h7M7 12h7M7 15.5h4" />
        </svg>
      </div>
      <h2>Aún no hay publicaciones</h2>
      <p>
        Cuando tengamos novedades — cambios de tarifa, feriados o avisos del
        servicio — las vas a encontrar acá. Mientras tanto,{" "}
        <Link href="/glosario">revisa el glosario</Link>.
      </p>
      <a
        href={buildWhatsAppLink(
          "Hola DTD Cargo, quiero recibir los avisos del corredor por WhatsApp.",
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
      >
        Recibir avisos por WhatsApp
      </a>
    </div>
  );
}
