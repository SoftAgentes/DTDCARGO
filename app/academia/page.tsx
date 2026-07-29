import type { Metadata } from "next";
import Link from "next/link";
import { socialMeta } from "@/lib/seo-og";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { ACADEMIA_CURSOS, ACADEMIA_LOGROS, type AcademiaCurso } from "@/lib/public/academia";
import { AcademiaLeadForm } from "./_components/AcademiaLeadForm";

const TITLE = "Academia DTD · Aprende a importar de China";
const DESC =
  "Cursos para importar desde China paso a paso, con la operación real de DTD detrás: Yiwu, consolidación y puerta a puerta a Venezuela. Del primer pedido a tu primer contenedor.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/academia" },
  ...socialMeta({ title: `${TITLE} · DTD Cargo`, description: DESC, path: "/academia" }),
};

export default function AcademiaPage() {
  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Academia", path: "/academia" },
        ]}
      />
      {/* Revestido al Norte con la superficie de recursos (`.rp-surface`).
          Esta página NO tiene mockup propio de Cloud Design: se aplica el
          mismo armazón `rp-*` de glosario/FAQ/noticias — banda navy en el
          hero — sin inventar una dirección visual nueva. El resto de las
          secciones queda como está. */}
      <main className="rp-surface" style={{ ["--rp-w" as string]: "var(--maxw)" }}>
        <section className="rp-hero">
          <div className="rp-hero-in">
            <div className="rp-eyebrow">
              <span className="rule" />
              Academia DTD
            </div>
            <h1>
              Aprende a importar de China,{" "}
              <span className="accent">con la operación real detrás.</span>
            </h1>
            <p>
              Te enseñamos a traer tu mercancía tú mismo, paso a paso. Y cuando
              quieras, la traemos por ti — puerta a puerta, con 16 años de
              experiencia importando de China. Con Confianza, de China a tu
              puerta.
            </p>
            <div className="rp-hero-actions">
              <a href="#anotate" className="btn btn-primary">
                Reservar mi cupo
              </a>
              <a href="#cursos" className="btn btn-ghost">
                Ver los cursos
              </a>
            </div>
          </div>
        </section>

        {/* Lo que vas a lograr */}
        <section className="pt-16 lg:pt-20 pb-4 lg:pb-8">
          <div className="wrap">
            <span className="eyebrow">Lo que vas a lograr</span>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
              {ACADEMIA_LOGROS.map((l) => (
                <div
                  key={l.titulo}
                  className="card-shadow-static bg-white border border-grey-200 rounded-[18px] p-7"
                >
                  <h3
                    className="text-[19px] leading-[1.2] tracking-[-0.01em] text-ink"
                    style={{ fontFamily: "var(--font-archivo-black)" }}
                  >
                    {l.titulo}
                  </h3>
                  <p className="text-[14px] text-grey-500 mt-2.5 leading-[1.55]">{l.detalle}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cursos · Próximamente */}
        <section id="cursos" className="py-16 lg:py-24 scroll-mt-24">
          <div className="wrap">
            <span className="eyebrow">Próximamente</span>
            <h2 className="h-display mt-4" style={{ fontSize: "clamp(30px, 4vw, 52px)" }}>
              Del primer pedido a tu primer contenedor.
            </h2>
            <p className="lead mt-5 max-w-[58ch]">
              Cuatro cursos en escalera: empieza gratis y avanza hasta embarcar tu contenedor con
              acompañamiento en vivo.
            </p>
            <div className="mt-9 grid grid-cols-1 md:grid-cols-2 gap-5">
              {ACADEMIA_CURSOS.map((c) => (
                <CursoCard key={c.slug} curso={c} />
              ))}
            </div>
          </div>
        </section>

        {/* Puente al servicio · la ganancia oculta (honesto: hazlo tú mismo) */}
        <section className="pb-16 lg:pb-24">
          <div className="wrap">
            <div className="card-shadow-dark bg-ink text-white rounded-[22px] p-9 lg:p-14">
              <div className="eyebrow text-white/50">La diferencia DTD</div>
              <h2
                className="mt-4 text-[30px] lg:text-[44px] leading-[1.08] tracking-[-0.01em] max-w-[20ch]"
                style={{ fontFamily: "var(--font-archivo-black)" }}
              >
                Hazlo tú mismo. No nos necesitas para aprender.
              </h2>
              <p className="text-[15px] lg:text-[17px] text-white/70 mt-5 leading-[1.6] max-w-[58ch]">
                Pero cuando quieras dedicarte a vender y dejar la logística a alguien con bodega
                propia en Yiwu y oficina en Valencia, nosotros traemos tu carga: consolidación,
                aduana resuelta y entrega puerta a puerta. Lo que aprendes acá, nosotros lo
                ejecutamos.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/servicios"
                  className="btn btn-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                >
                  Ver servicios
                </Link>
                <Link
                  href="/tarifas"
                  className="btn inline-flex border border-white/25 bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                >
                  Calcular mi importación
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Captación de lead */}
        <section id="anotate" className="pb-16 lg:pb-24 scroll-mt-24">
          <div className="wrap grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-12 items-start">
            <div>
              <span className="eyebrow">Sé el primero</span>
              <h2 className="h-display mt-4" style={{ fontSize: "clamp(28px, 3.5vw, 46px)" }}>
                Entra antes que nadie.
              </h2>
              <p className="lead mt-5 max-w-[46ch]">
                Estamos terminando de grabar. Déjanos tus datos y te avisamos en cuanto abran los
                cupos — además te llega gratis el Curso 0.
              </p>
              <ul className="mt-7 flex flex-col gap-3 list-none p-0">
                {[
                  "Curso 0 gratis al abrir",
                  "Cupos limitados en las cohortes en vivo",
                  "Sin spam — te escribimos solo por esto",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[15px] text-ink">
                    <span aria-hidden className="mt-1 text-wine">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 13 4 4L19 7" />
                      </svg>
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <AcademiaLeadForm />
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

function CursoCard({ curso }: { curso: AcademiaCurso }) {
  const chip = curso.gratis
    ? "border-status-success text-status-success"
    : "border-grey-200 text-grey-500";
  return (
    <article className="card-shadow-static bg-white border border-grey-200 rounded-[18px] p-7 lg:p-8 flex flex-col gap-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span
          className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${chip}`}
        >
          {curso.nivel}
        </span>
        {curso.insignia ? (
          <span className="text-[11px] font-bold uppercase tracking-wide text-wine">Insignia</span>
        ) : null}
      </div>
      <h3
        className="text-[20px] lg:text-[22px] leading-[1.15] tracking-[-0.01em] text-ink"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        {curso.titulo}
      </h3>
      <p className="text-[14px] text-grey-500 leading-[1.55]">{curso.gancho}</p>
      <div className="mt-auto pt-2 text-[12.5px] font-semibold text-grey-500">{curso.meta}</div>
    </article>
  );
}
