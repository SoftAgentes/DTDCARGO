import Link from "next/link";

/**
 * Momentos del viaje (svp-moments) — 4 columnas de la portada /servicios.
 * Handoff Cloud Design · Servicios · DTD-Cargo.html.
 *
 * Cada item enlaza a su ficha. Los servicios "Próximamente" (soon) se
 * renderizan DESHABILITADOS y NO clicables (instrucción founder 2026-07-19):
 * no son <a>, no navegan, cursor default, aria-disabled.
 */
export type SvpItem = {
  nm: string;
  /** Línea chica bajo el nombre (ej. "Sin costo — es tu orden"). */
  small?: string;
  /** Destino: ruta real (`/servicios/...`) o ancla provisional (`#svc/...`). */
  href?: string;
  /** Servicio aún no disponible → deshabilitado, no clicable. */
  soon?: boolean;
};

export type SvpMoment = {
  /** Número de momento ("01".."04"). */
  n: string;
  /** Título (ej. "Origen"). */
  t: string;
  /** Ubicación/contexto (ej. "China · antes del embarque"). */
  loc: string;
  items: SvpItem[];
};

export function SvpMoments({ moments }: { moments: SvpMoment[] }) {
  return (
    <div className="svp-moments">
      {moments.map((m) => (
        <div className="svp-mom" key={m.n}>
          <div className="svp-mom-h">
            <span className="n">{m.n}</span>
            <div className="t">{m.t}</div>
            <div className="loc">{m.loc}</div>
          </div>
          <ul className="svp-list">
            {m.items.map((it, i) => (
              <li key={i}>
                <ItemBody item={it} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ItemBody({ item }: { item: SvpItem }) {
  const name = (
    <span className="nm">
      {item.nm}
      {item.small && <small>{item.small}</small>}
    </span>
  );

  // "Próximamente" → deshabilitado, no clicable (no <a>).
  if (item.soon) {
    return (
      <span className="svp-it dis" aria-disabled="true">
        {name}
        <span className="svp-soon">Próximamente</span>
      </span>
    );
  }

  const arrow = (
    <span className="arrow">
      <ArrowSvg />
    </span>
  );

  // Ruta real → Next Link; ancla provisional (#svc/...) → <a>.
  // TODO(próxima pasada): reemplazar las anclas `#svc/...` por rutas reales
  // conforme se construyan las fichas restantes.
  if (item.href?.startsWith("/")) {
    return (
      <Link className="svp-it" href={item.href}>
        {name}
        {arrow}
      </Link>
    );
  }
  return (
    <a className="svp-it" href={item.href}>
      {name}
      {arrow}
    </a>
  );
}

function ArrowSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
