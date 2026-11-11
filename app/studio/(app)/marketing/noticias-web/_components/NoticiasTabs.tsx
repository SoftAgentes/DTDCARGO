/**
 * SDD-0625 · Pestañas de Noticias web: «Nueva noticia» (el generador) y
 * «Publicadas» (corregir, retirar y volver a publicar). Son enlaces: cada
 * pestaña es una ruta, así el enlace de retiro del aviso de Discord y el botón
 * Atrás del navegador funcionan sin estado en el cliente.
 */
import Link from "next/link";

type Pestana = "nueva" | "publicadas";

const PESTANAS: Array<{ id: Pestana; label: string; href: string }> = [
  { id: "nueva", label: "Nueva noticia", href: "/studio/marketing/noticias-web" },
  { id: "publicadas", label: "Publicadas", href: "/studio/marketing/noticias-web/publicadas" },
];

export function NoticiasTabs({ activa }: { activa: Pestana }) {
  return (
    <nav aria-label="Noticias web" style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--color-grey-200, #E5E2DC)" }}>
      {PESTANAS.map((p) => {
        const actual = p.id === activa;
        return (
          <Link
            key={p.id}
            href={p.href}
            aria-current={actual ? "page" : undefined}
            style={{
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: actual ? 700 : 500,
              color: actual ? "var(--color-wine-text, #7F0F1A)" : "var(--color-grey-700, #3D3D3D)",
              borderBottom: actual ? "2px solid var(--color-wine, #7F0F1A)" : "2px solid transparent",
              marginBottom: -1,
              textDecoration: "none",
              minHeight: 32,
            }}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
