"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Router hash del hub /servicios (patrón hub-and-spoke del mockup Cloud Design).
 *
 * TODAS las fichas quedan renderizadas en el DOM (server-rendered → SEO/GEO: los
 * crawlers y las IA leen el copy completo en el HTML). Solo se MUESTRA la activa,
 * según `#svc/<slug>`; sin hash (o hash desconocido) → se ve la portada "el viaje".
 * El toggle es puro `hidden` sobre wrappers; los nodos server no se re-renderizan.
 */
export function HubRouter({
  portada,
  fichas,
}: {
  portada: ReactNode;
  fichas: { slug: string; node: ReactNode }[];
}) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const slugs = new Set(fichas.map((f) => f.slug));
    const read = (scroll: boolean) => {
      const m = location.hash.match(/^#svc\/(.+)$/);
      const slug = m ? decodeURIComponent(m[1]) : null;
      const next = slug && slugs.has(slug) ? slug : null;
      setActive(next);
      if (next && scroll) window.scrollTo(0, 0);
    };
    read(false); // estado inicial (deep-link): no forzar scroll
    const onHash = () => read(true);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [fichas]);

  const volver = () => {
    // Limpia el hash sin recargar y vuelve a la portada.
    history.pushState(null, "", location.pathname + location.search);
    setActive(null);
    window.scrollTo(0, 0);
  };

  return (
    <div className="svc-surface">
      <div hidden={active !== null}>{portada}</div>
      {fichas.map((f) => (
        <section key={f.slug} hidden={active !== f.slug} className="py-16 lg:py-24 bg-paper">
          <div className="wrap">
            <button type="button" className="svc-back" onClick={volver}>
              ← Todos los servicios
            </button>
            {f.node}
          </div>
        </section>
      ))}
    </div>
  );
}
