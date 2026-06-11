import type { Metadata } from "next";
import { ArrowIcon } from "@/components/Icon";
import { InternoBreadcrumb } from "../../../_components/InternoBreadcrumb";

/**
 * WhatsApp Business Services (`/interno/marca/whatsapp`).
 *
 * Lanzador de las 2 herramientas internas de WhatsApp. Los HTML viven en
 * `public/marca/herramientas/` (heredan la CSP relajada de `/marca/*`, que permite
 * html2canvas de cdnjs + Google Fonts) y se embeben acá en iframe same-origin.
 * El "abrir en pantalla completa" los lleva a su URL directa (más cómodo para
 * cargar fotos y descargar).
 */

export const metadata: Metadata = {
  title: "WhatsApp Business Services",
  robots: { index: false, follow: false },
};

const TOOLS = [
  {
    href: "/marca/herramientas/whatsapp-catalogo-plantillas.html",
    title: "Generador de imágenes del catálogo",
    desc: "Cargas la foto de cada servicio y descargas el PNG 1080×1080 con el marco de marca y la metadata. Listo para subir al catálogo de WhatsApp Business.",
    height: "min(82vh, 1000px)",
  },
  {
    href: "/marca/herramientas/whatsapp-business-guia.html",
    title: "Guía de configuración por número",
    desc: "Eliges tu teléfono y la guía te muestra qué le toca, con botón Copiar en cada campo (perfil, catálogo, respuestas rápidas) + descarga de la foto de perfil.",
    height: "min(82vh, 1000px)",
  },
];

export default function WhatsAppToolsPage() {
  return (
    <div className="wrap py-12 lg:py-16">
      <div className="mb-6">
        <InternoBreadcrumb
          items={[
            { href: "/interno", label: "Recursos internos" },
            { href: "/interno/marca", label: "Marca" },
            { label: "WhatsApp Business Services" },
          ]}
        />
      </div>

      <span className="eyebrow">Herramienta interna</span>
      <h1 className="h-section mt-4">WhatsApp Business Services.</h1>
      <p className="lead mt-4 max-w-[60ch]">
        Dos herramientas para dejar el WhatsApp Business de DTD Cargo igual al
        estándar: el generador de imágenes del catálogo y la guía de configuración
        del perfil por número. Funcionan acá embebidas o en pantalla completa.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        {TOOLS.map((t) => (
          <div key={t.href}>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <div>
                <h2 className="text-[20px] text-ink leading-tight" style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.01em" }}>
                  {t.title}
                </h2>
                <p className="text-[13.5px] text-grey-700 leading-[1.5] mt-1 max-w-[64ch]">
                  {t.desc}
                </p>
              </div>
              <a href={t.href} target="_blank" rel="noopener" className="btn btn-ghost flex-shrink-0">
                Abrir en pantalla completa <ArrowIcon />
              </a>
            </div>
            <div className="rounded-[16px] border border-grey-200 overflow-hidden bg-white">
              <iframe
                src={t.href}
                title={t.title}
                loading="lazy"
                style={{ width: "100%", height: t.height, border: 0, display: "block" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
