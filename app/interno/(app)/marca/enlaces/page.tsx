import type { Metadata } from "next";
import { ArrowIcon } from "@/components/Icon";
import { InternoBreadcrumb } from "../../../_components/InternoBreadcrumb";
import { CONTACT } from "@/lib/design-tokens";

/**
 * Link-in-bio de Instagram (`/interno/marca/enlaces`).
 *
 * Guía interna para el equipo: cómo poner `dtdcargo.com/enlaces` en la bio,
 * los botones nativos de la cuenta profesional, la atribución y cómo editar
 * los enlaces. Embebe el propio `/enlaces` (ruta pública, same-origin) como
 * preview en vivo — no duplica el HTML; la fuente es la ruta real.
 *
 * La versión imprimible/compartible vive en docs/marketing/link-in-bio.md
 * (+ assets/link-in-bio-guia.html).
 */

export const metadata: Metadata = {
  title: "Link-in-bio · Instagram",
  robots: { index: false, follow: false },
};

const ENLACES_URL = "https://dtdcargo.com/enlaces";

const STEPS = [
  {
    n: "1",
    title: "Ponerlo en la bio de Instagram",
    body: (
      <>
        Perfil → <b>Editar perfil</b> → <b>Enlaces</b> (en cuentas viejas dice
        “Sitio web”) → <b>Agregar enlace externo</b> → pega{" "}
        <code>dtdcargo.com/enlaces</code>. Título opcional: “Enlaces DTD”.
        <br />
        <span className="text-grey-500">
          El link en el texto de la bio no es clickeable — va sí o sí en el campo
          Enlaces.
        </span>
      </>
    ),
  },
  {
    n: "2",
    title: "Botones nativos (cuenta profesional)",
    body: (
      <>
        Editar perfil → <b>Botones de acción</b>. Activa WhatsApp (
        <code>{CONTACT.ve.whatsapp}</code>), Cómo llegar (oficina Valencia) y
        Correo (<code>{CONTACT.emailGeneral}</code>). Conviven con el link de la
        bio y le dan más superficie de contacto.
      </>
    ),
  },
  {
    n: "3",
    title: "Mismo link en TikTok y YouTube",
    body: (
      <>
        La misma URL sirve como link de perfil en TikTok ({CONTACT.tiktok.handle})
        y YouTube ({CONTACT.youtube.handle}). Un solo destino.
      </>
    ),
  },
  {
    n: "4",
    title: "Atribución (ya integrada)",
    body: (
      <>
        Los enlaces web llevan UTM <code>utm_campaign=enlaces</code> → se ven en
        GA4. Los de WhatsApp agregan “(Vía: …/enlaces · origen)” al mensaje → el
        CRM sabe de qué botón vino. Cómo llegar abre mapas nativos (Apple Maps en
        iPhone, Google Maps en el resto).
      </>
    ),
  },
  {
    n: "5",
    title: "Editar los enlaces",
    body: (
      <>
        En <code>app/enlaces/page.tsx</code>: <code>PRIMARY</code> (CTA),{" "}
        <code>LINKS[]</code> (accesos), <code>SOCIAL[]</code> (redes). Los datos
        de contacto salen de <code>CONTACT</code> en{" "}
        <code>lib/design-tokens.ts</code>.
      </>
    ),
  },
];

export default function EnlacesGuiaPage() {
  return (
    <div className="wrap py-12 lg:py-16">
      <div className="mb-6">
        <InternoBreadcrumb
          items={[
            { href: "/interno", label: "Recursos internos" },
            { href: "/interno/marca", label: "Marca" },
            { label: "Link-in-bio · Instagram" },
          ]}
        />
      </div>

      <span className="eyebrow">Herramienta interna</span>
      <h1 className="h-section mt-4">Link-in-bio de Instagram.</h1>
      <p className="lead mt-4 max-w-[60ch]">
        La página <b>dtdcargo.com/enlaces</b> es nuestro link de la bio: agrupa
        todos los enlaces bajo una sola URL y mide clics, sin marca de terceros ni
        costo recurrente. Acá va cómo ponerla y cómo se edita.
      </p>

      {/* URL + acción */}
      <div className="mt-8 bg-ink rounded-[16px] p-6 lg:p-7 flex flex-wrap items-center justify-between gap-5">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-[0.5px] text-white/55">
            La URL que va en la bio
          </div>
          <div
            className="mt-1.5 text-[18px] lg:text-[20px] text-white"
            style={{
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            }}
          >
            dtdcargo.com/enlaces
          </div>
        </div>
        <a
          href={ENLACES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary flex-shrink-0"
        >
          Abrir /enlaces <ArrowIcon />
        </a>
      </div>

      {/* Pasos */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="rounded-[16px] border border-grey-200 bg-white p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="grid place-items-center w-7 h-7 rounded-full bg-ink text-white text-[13px] font-bold flex-shrink-0">
                {s.n}
              </span>
              <h2
                className="text-[17px] text-ink leading-tight"
                style={{
                  fontFamily: "var(--font-archivo-black)",
                  letterSpacing: "-0.01em",
                }}
              >
                {s.title}
              </h2>
            </div>
            <p className="text-[14px] text-grey-700 leading-[1.55]">{s.body}</p>
          </div>
        ))}
      </div>

      {/* Preview en vivo del /enlaces real (same-origin, no duplica el HTML) */}
      <div className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <span className="eyebrow">Preview en vivo</span>
            <h2 className="h-card mt-3 text-ink">Así se ve el link-in-bio.</h2>
          </div>
          <a
            href={ENLACES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost flex-shrink-0"
          >
            Abrir en pantalla completa <ArrowIcon />
          </a>
        </div>
        <div className="rounded-[16px] border border-grey-200 overflow-hidden bg-white grid place-items-center py-8">
          <iframe
            src="/enlaces"
            title="Preview de dtdcargo.com/enlaces"
            loading="lazy"
            style={{
              width: 390,
              maxWidth: "100%",
              height: "min(80vh, 780px)",
              border: 0,
              display: "block",
              borderRadius: 12,
            }}
          />
        </div>
      </div>
    </div>
  );
}
