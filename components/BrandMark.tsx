import Image from "next/image";
import Link from "next/link";
import { BRAND_ASSETS } from "@/lib/design-tokens";

type Variant = "lockup" | "isotipo" | "wordmark";

type Props = {
  /**
   * Variante de la marca.
   * - `lockup` (default): ícono + wordmark "DTD CARGO". Usado en nav, footer.
   * - `isotipo`: solo el símbolo (sin texto). Usado en favicons, watermarks.
   * - `wordmark`: solo el texto "DTD CARGO" (sin ícono). Usado en places muy compactos.
   */
  variant?: Variant;
  /** Tamaño del ícono en px. Default 38. */
  size?: number;
  /** Si es true, ajusta colores para fondos oscuros. */
  onDark?: boolean;
  /** Si es true, renderiza como link a la home. */
  asLink?: boolean;
  className?: string;
};

/**
 * Marca DTD·CARGO — fuente única de la marca en el sitio.
 *
 * Cuando llegue el logo final, basta con actualizar `BRAND_ASSETS` en
 * `lib/design-tokens.ts` y dejar los archivos en `public/brand/`. Si
 * `logoFull` (SVG con ícono+wordmark integrados) está seteado, este
 * componente lo usa directo. Si es `null`, renderiza el isotipo PNG +
 * el wordmark "DTD" wine + "CARGO" ink como composición CSS.
 */
export function BrandMark({
  variant = "lockup",
  size = 38,
  onDark = false,
  asLink = false,
  className = "",
}: Props) {
  const content = renderVariant({ variant, size, onDark, className });
  if (asLink) {
    return (
      <Link href="/" aria-label="DTD·CARGO — Inicio">
        {content}
      </Link>
    );
  }
  return content;
}

function renderVariant({
  variant,
  size,
  onDark,
  className,
}: Required<Omit<Props, "asLink">>) {
  // 1) LOCKUP — el caso normal: ícono + wordmark
  if (variant === "lockup") {
    // ¿Hay logo lockup pre-armado? úsalo directo
    const lockupSrc = onDark
      ? BRAND_ASSETS.logoFullDark ?? BRAND_ASSETS.logoFull
      : BRAND_ASSETS.logoFull;

    if (lockupSrc) {
      return (
        <Image
          src={lockupSrc}
          alt="DTD CARGO"
          width={size * 4.5}
          height={size}
          priority
          className={className}
          style={{ width: "auto", height: size }}
        />
      );
    }

    // Fallback: isotipo + wordmark CSS
    return (
      <span className={`brand ${className}`}>
        <Isotipo size={size} onDark={onDark} />
        <Wordmark onDark={onDark} />
      </span>
    );
  }

  // 2) ISOTIPO — solo el símbolo
  if (variant === "isotipo") {
    return <Isotipo size={size} onDark={onDark} className={className} />;
  }

  // 3) WORDMARK — solo el texto
  return (
    <span className={`brand ${className}`}>
      <Wordmark onDark={onDark} />
    </span>
  );
}

function Isotipo({
  size,
  onDark,
  className = "",
}: {
  size: number;
  onDark: boolean;
  className?: string;
}) {
  const src = onDark
    ? BRAND_ASSETS.isotipoDark ?? BRAND_ASSETS.isotipo
    : BRAND_ASSETS.isotipo;
  // Si no hay versión dark dedicada, aplicamos filter para invertir el isotipo.
  const needsFilter = onDark && !BRAND_ASSETS.isotipoDark;
  return (
    <Image
      src={src}
      alt="DTD CARGO"
      width={size}
      height={size}
      priority
      className={className}
      style={{
        width: size,
        height: "auto",
        filter: needsFilter ? "brightness(0) invert(0.92)" : undefined,
      }}
    />
  );
}

function Wordmark({ onDark }: { onDark: boolean }) {
  return (
    <span>
      <span className="b-dtd">DTD</span>
      <span
        className="b-cargo"
        style={onDark ? { color: "rgba(255,255,255,0.85)" } : undefined}
      >
        CARGO
      </span>
    </span>
  );
}
