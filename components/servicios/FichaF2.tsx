import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { RutaF2, type RutaF2Props } from "@/components/servicios/RutaF2";

/**
 * Ficha de servicio completa (article.f2) — shell reutilizable para las ~17
 * fichas del catálogo. Handoff Cloud Design · Servicios · DTD-Cargo.html.
 *
 * Composición:
 *   <FichaF2 chips={…} hook="…" sub={…} seal={…} route={…}>
 *     <SecF2 title="¿Qué es?"> <p className="f2body">…</p> </SecF2>
 *     <SecF2 title="¿Cómo funciona?"> <StepsF2 steps={[…]} /> </SecF2>
 *     …
 *   </FichaF2>
 *
 * El hero (navy) y la tira de contacto los provee el shell; el cuerpo son las
 * <SecF2> que se le pasan como children.
 */
export function FichaF2({
  chips,
  hook,
  sub,
  seal,
  route,
  capa,
  hookAs = "h1",
  children,
}: {
  chips: ReactNode;
  hook: string;
  sub: ReactNode;
  seal?: { top: string; sub: string };
  route?: RutaF2Props;
  /**
   * Capa/momento del viaje → hero CLARO (en vez del navy por defecto):
   * "llegada" (borde wine), "origen" (borde navy), "tramites" (borde navy punteado).
   * Sin capa = hero navy (servicios principales de transporte).
   */
  capa?: "llegada" | "origen" | "tramites";
  /** Nivel del titular: h1 en páginas propias, h2 en el hub (una sola h1 por página). */
  hookAs?: "h1" | "h2";
  children: ReactNode;
}) {
  const Hook = hookAs;
  // Hero claro (capa) → logo primary; hero navy → logo reverse.
  const heroLogo = capa ? "primary" : "reverse";
  return (
    <article className={capa ? `f2 capa-${capa}` : "f2"}>
      <div className="f2-hero">
        <div className="top">
          <BrandMark variant={heroLogo} size={38} />
          <div className="chips">{chips}</div>
        </div>
        <Hook className="hook">{hook}</Hook>
        <p className="sub">{sub}</p>
        {seal && (
          <div className="f2seal">
            <b>{seal.top}</b>
            <span>{seal.sub}</span>
          </div>
        )}
      </div>
      {route && <RutaF2 {...route} />}
      {children}
      <div className="f2-contact">
        <BrandMark variant="reverse" size={30} isologoOnly />
        <div className="ln">
          <span>WhatsApp +58 412 166 8021</span>
          <span className="dv">·</span>
          <span>dtdcargo.com</span>
          <span className="dv">·</span>
          <span>@doortudoor_</span>
        </div>
        <span className="tagl">Con Confianza, de China a tu puerta.</span>
      </div>
    </article>
  );
}

/** Bloque de sección (f2-sec) con título en versalitas wine. */
export function SecF2({
  title,
  children,
  price,
}: {
  title: string;
  children: ReactNode;
  /** Aplica el fondo elevado de la sección de precio (f2-price). */
  price?: boolean;
}) {
  return (
    <div className={price ? "f2-sec f2-price" : "f2-sec"}>
      <h4>{title}</h4>
      {children}
    </div>
  );
}

/** Lista de pasos numerados (f2steps). */
export function StepsF2({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="f2steps">
      {steps.map((s, i) => (
        <li key={i}>
          <span className="tx">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** Lista de beneficios con check (f2benes). */
export function BenesF2({ items }: { items: ReactNode[] }) {
  return (
    <ul className="f2benes">
      {items.map((it, i) => (
        <li key={i}>
          <CheckSvg />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** Lista de reglas/condiciones (f2rules). */
export function RulesF2({ items }: { items: ReactNode[] }) {
  return (
    <ul className="f2rules">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/** Fila de precio con CTA(s) (f2price-row). Usar dentro de <SecF2 price>. */
export function PriceF2({
  text,
  sub,
  ctaLabel,
  ctaHref,
  secondary,
}: {
  text: ReactNode;
  sub?: string;
  ctaLabel: string;
  ctaHref: string;
  /** CTA secundaria opcional (ej. "Cotizar con tu asesor"). */
  secondary?: { label: string; href: string };
}) {
  return (
    <div className="f2price-row">
      <div className="tx">
        {text}
        {sub && <small>{sub}</small>}
      </div>
      {secondary ? (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <CtaF2 label={ctaLabel} href={ctaHref} />
          <CtaF2 label={secondary.label} href={secondary.href} ghost />
        </div>
      ) : (
        <CtaF2 label={ctaLabel} href={ctaHref} />
      )}
    </div>
  );
}

export function CtaF2({
  label,
  href,
  ghost,
}: {
  label: string;
  href: string;
  ghost?: boolean;
}) {
  const external = href.startsWith("http");
  return (
    <a
      className={ghost ? "f2cta ghost" : "f2cta"}
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {label}
      {!ghost && <ArrowSvg />}
    </a>
  );
}

/** Callout de referencia cruzada a otro servicio (f2xref). */
export function XrefF2({ children }: { children: ReactNode }) {
  return (
    <div className="f2xref">
      <InfoSvg />
      <span className="tx">{children}</span>
    </div>
  );
}

/** Grid de dos tarjetas de contraste (f2versus). */
export function VersusF2({ children }: { children: ReactNode }) {
  return <div className="f2versus">{children}</div>;
}

/** Tarjeta de contraste (vscard). `hero` = destacada wine. */
export function VscardF2({
  hero,
  icon,
  tag,
  title,
  children,
}: {
  hero?: boolean;
  /** Ícono opcional a la izquierda del título. */
  icon?: ReactNode;
  /** Etiqueta tipo "MOD A" antes del título. */
  tag?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={hero ? "vscard hero" : "vscard"}>
      <div className="k">
        {tag && <span className="modtag">{tag}</span>}
        {icon}
        {title}
      </div>
      <div className="d">{children}</div>
    </div>
  );
}

/** Mock visual de un reporte DTD (repmock). `score` muestra un puntaje /100. */
export function RepmockF2({
  title,
  sub,
  score,
}: {
  title: string;
  sub: string;
  score?: boolean;
}) {
  return (
    <div className="repmock">
      {/* repmock va sobre fondo claro (--bg-base) → isólogo primary (navy+wine). */}
      <BrandMark variant="primary" size={26} isologoOnly />
      <div className="rl">
        <div className="rt">{title}</div>
        <div className="rs">{sub}</div>
        <div className="lines">
          <span className="ln" />
          <span className="ln w70" />
          {!score && <span className="ln w45" />}
        </div>
      </div>
      {score && (
        <div className="score">
          <b>/100</b>puntaje
        </div>
      )}
    </div>
  );
}

// ── SVGs (trazados exactos del mockup) ───────────────────────────────
function ArrowSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

function InfoSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.5M12 11.5V16" />
    </svg>
  );
}
