/**
 * Índice de la zona interna del equipo (`/interno`).
 *
 * Grid de herramientas internas. Cada herramienta nueva = una subcarpeta en
 * `app/interno/(app)/` + una tarjeta acá.
 *
 * SDD-0238: el hub de marca se mudó a `/marca` (con código de acceso, para poder
 * compartirlo con diseño externo) y `/interno/marca` quedó como redirect. Las
 * herramientas de WhatsApp y del link-in-bio colgaban de ese hub, así que
 * subieron acá — si no, quedaban sin ninguna puerta de entrada.
 */

import { ToolCard, ToolCardPlaceholder } from "../_components/ToolCard";

const TOOLS = [
  {
    // El centro de marca se mudó a /marca (SDD-0238): misma experiencia, pero
    // abierta con código para poder compartirla con diseño externo. Se apunta
    // directo al destino en vez de al redirect.
    href: "/marca",
    title: "Marca",
    desc: "Brand Book, logos, paleta, tipografía y plantillas. Todo descargable, y con un link que le puedes pasar a diseño.",
    meta: "Brand Book · descargables",
  },
  {
    href: "/interno/marca/whatsapp",
    title: "WhatsApp Business",
    desc: "Genera las imágenes del catálogo y configura el perfil de cada número con la guía paso a paso.",
    meta: "Generador + guía",
  },
  {
    href: "/interno/marca/enlaces",
    title: "Link-in-bio · Instagram",
    desc: "La página dtdcargo.com/enlaces que va en la bio: cómo ponerla y cómo editar los enlaces.",
    meta: "Guía + preview",
  },
];

export default function InternoIndexPage() {
  return (
    <div className="wrap py-14 lg:py-20">
      <span className="eyebrow">Equipo · DTD Cargo</span>
      <h1 className="h-display mt-4" style={{ fontSize: "clamp(34px, 4.5vw, 56px)" }}>
        Recursos internos.
      </h1>
      <p className="lead mt-5 max-w-[58ch]">
        Las herramientas y materiales del equipo, en un solo lugar y siempre con
        la última versión. Acceso solo para el personal de DTD Cargo.
      </p>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {TOOLS.map((t) => (
          <ToolCard key={t.href} {...t} />
        ))}
        <ToolCardPlaceholder>
          Más herramientas del equipo van a vivir acá — cada una con su propia
          página de descargas.
        </ToolCardPlaceholder>
      </div>
    </div>
  );
}
