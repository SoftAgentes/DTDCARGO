import Image from "next/image";
import Link from "next/link";

/**
 * Sistema oficial de marca DTD Cargo.
 * Fuente de verdad: el Brand Book vigente del Norte — el de mayor versión en
 * docs/design/studio/_norte/ (hoy "Brand Book DTD v4.6.html"; el book es UNO solo).
 *
 * Cambios vs v2.x:
 * - Wordmark pasa de "DTDCARGO" (1 palabra, todo mayúsculas) a "DTD Cargo"
 *   (2 palabras separadas, "Cargo" capitalizado, no all-caps).
 * - 4 variantes oficiales del isólogo según fondo: primary, reverse,
 *   mono-light, mono-dark.
 * - Gap entre DTD y Cargo: 0.15em vía inline-block span (no margin).
 * - Letter-spacing: -0.02em (era -0.01em).
 * - `wine-soft` se prohibió para el wordmark — sigue siendo decorativo.
 */

type Variant = "primary" | "reverse" | "mono-light" | "mono-dark";

const VARIANT_CONFIG: Record<
  Variant,
  { file: string; dtd: string; cargo: string }
> = {
  primary: {
    file: "/brand/dtdcargo-isologo-primary.png",
    dtd: "#7F0F1A", // wine
    cargo: "#0F1E3D", // ink/navy
  },
  reverse: {
    file: "/brand/dtdcargo-isologo-reverse.png",
    dtd: "#7F0F1A", // wine sólido (NO wine-soft, regla del brand book)
    cargo: "#FBFAF7", // cream
  },
  "mono-light": {
    file: "/brand/dtdcargo-isologo-mono-light.png",
    dtd: "#FBFAF7",
    cargo: "#FBFAF7",
  },
  "mono-dark": {
    file: "/brand/dtdcargo-isologo-mono-dark.png",
    dtd: "#0F1E3D",
    cargo: "#0F1E3D",
  },
};

type Props = {
  /**
   * Variante oficial del isólogo según fondo:
   * - `primary` (default): isólogo navy+wine sobre fondos claros (paper, white).
   * - `reverse`: isólogo cream+wine sobre fondos oscuros (navy, sidebar).
   * - `mono-light`: cream sólido sobre wine (CTAs, alertas).
   * - `mono-dark`: navy sólido B&W (impresión, sello).
   */
  variant?: Variant;
  /**
   * Tamaño del isólogo (default 38). Acepta un número en px o una longitud CSS
   * —`clamp()`, `var(--x)`— para que el lockup cambie de tamaño por media query
   * sin duplicar el nodo en el DOM. El wordmark escala automático.
   */
  size?: number | string;
  /**
   * Legacy alias de v2.x: `onDark={true}` equivale a `variant="reverse"`.
   * Mantenido para no romper imports existentes. `variant` tiene precedencia.
   */
  onDark?: boolean;
  /** Si true, renderiza como `<Link href="/">` para uso en navbar. */
  asLink?: boolean;
  /** Si true, oculta el wordmark (solo isólogo — favicons, watermarks). */
  isologoOnly?: boolean;
  className?: string;
};

/**
 * Lockup oficial DTD Cargo.
 *
 * - Nav (fondo claro): `<BrandMark asLink />` → variant primary
 * - Footer (fondo ink oscuro): `<BrandMark onDark size={48} />` → variant reverse
 * - CTA sobre wine: `<BrandMark variant="mono-light" />`
 * - Sello B&W: `<BrandMark variant="mono-dark" />`
 */
export function BrandMark({
  variant,
  size = 38,
  onDark = false,
  asLink = false,
  isologoOnly = false,
  className = "",
}: Props) {
  // Resolve variant: prop `variant` > legacy `onDark` shortcut > primary default
  const resolved: Variant = variant ?? (onDark ? "reverse" : "primary");
  const cfg = VARIANT_CONFIG[resolved];

  // Wordmark font-size ratio sobre el ancho del isologo. Iteración 4.
  // Histórico ajustando contra feedback visual del founder:
  //   - 0.34 (commit inicial del lockup):  too small, more chico que nav links
  //   - 0.55 (commit 52e56e5):       todavía sub-brand
  //   - 1.43 (commit fb121e9):       overshoot, montaba sobre "Rastrear"
  //   - 1.00 (commit af0d2db):       todavía un toque grande
  //   - 0.80 (actual):               punto medio entre 0.55 y 1.00, wordmark
  //     ~22% más grande que el ratio "natural" sin invadir nav links
  //
  // BRAND-EXCEPTION 2026-05-27 autorizada por founder — diverge de la spec
  // canónica del brand book (0.31-0.60), pero la 0.80 vuelve cerca del
  // límite superior de la spec sin overshootear.
  //
  // Con `size` fluido (string) los derivados salen por `calc()` en vez de
  // redondearse en JS. La rama numérica queda idéntica a como estaba —mismos
  // redondeos, mismos px— así que ninguno de los call sites cambia de pixel.
  const fluid = typeof size === "string";
  const sizeCss = fluid ? size : `${size}px`;
  const markFontSize = fluid
    ? `calc(${size} * 0.8)`
    : `${Math.round(size * 0.8)}px`;
  // Gap horizontal entre isólogo y wordmark ~18% del alto del isólogo.
  const gap = fluid ? `calc(${size} * 0.18)` : `${Math.round(size * 0.18)}px`;

  // Isólogo es 741×764 → aspect ratio 0.97. Mantenemos width fijo y dejamos
  // que la altura se ajuste vía aspect-ratio del Image.
  const isologoHeight = fluid
    ? `calc(${size} * ${764 / 741})`
    : `${Math.round(size * (764 / 741))}px`;
  // next/image exige width/height numéricos: son la pista de intrínsecas para el
  // optimizador, no el tamaño pintado (que lo fija el `style` de abajo, como ya
  // hacía la rama numérica). Con tamaño fluido no hay un número real → default.
  const intrinsicWidth = fluid ? 38 : size;
  const intrinsicHeight = Math.round(intrinsicWidth * (764 / 741));

  const content = (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap,
        lineHeight: 1,
      }}
    >
      <Image
        src={cfg.file}
        alt="DTD Cargo"
        width={intrinsicWidth}
        height={intrinsicHeight}
        priority
        style={{
          width: sizeCss,
          height: isologoHeight,
          objectFit: "contain",
          display: "block",
        }}
      />
      {!isologoOnly && (
        <span
          style={{
            // Token de marca (Archivo Black) — NO `--font-archivo-black`, que el
            // portal redefine a Sora. El logo corporativo es capa branding y debe
            // quedar en Archivo Black en toda la app (regla del Norte).
            fontFamily: "var(--font-brand-display)",
            fontWeight: 900,
            fontSize: markFontSize,
            letterSpacing: "-0.02em",
            lineHeight: 0.9,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: cfg.dtd }}>DTD</span>
          {/* Gap entre palabras vía inline-block (no espacio HTML).
              Spec del brand book: width: 0.15em. */}
          <span
            aria-hidden
            style={{ display: "inline-block", width: "0.15em" }}
          />
          <span style={{ color: cfg.cargo }}>Cargo</span>
        </span>
      )}
    </span>
  );

  if (asLink) {
    return (
      <Link href="/" aria-label="DTD Cargo — Inicio">
        {content}
      </Link>
    );
  }
  return content;
}
