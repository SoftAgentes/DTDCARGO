/**
 * Índice de la zona interna del equipo (`/interno`).
 *
 * Grid de herramientas internas. Hoy: Marca. Cada herramienta nueva = una
 * subcarpeta en `app/interno/(app)/` + una tarjeta acá.
 */

import { ToolCard, ToolCardPlaceholder } from "../_components/ToolCard";

const TOOLS = [
  {
    href: "/interno/marca",
    title: "Marca",
    desc: "Brand Book, logos, paleta, tipografía y las herramientas de WhatsApp Business. Todo descargable.",
    meta: "Brand Book · descargables",
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
