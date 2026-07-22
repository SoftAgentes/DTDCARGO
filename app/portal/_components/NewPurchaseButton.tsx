import Link from "next/link";

/**
 * Disparador "Nueva compra" del portal (SDD-0057 · terminología compra↔prealerta).
 *
 * Patrón decidido con el founder + ui-ux: la palabra ANCLA es "compra" (Archivo,
 * lo que el cliente entiende); "prealerta" es la TRADUCCIÓN técnica (JetBrains
 * Mono, gris, más chica) — el término que el importador veterano del modelo EE.UU.
 * ya conoce. Los dos términos viajan SIEMPRE juntos en el mismo control.
 *
 * Compacto (~40px, ghost bordeado en vino) en vez del bloque vino lleno de 48px:
 * baja el peso visual (el vino lleno queda para "Registrar compra" dentro de
 * la pantalla completa, que es el commit real) y es IDÉNTICO en todo el
 * portal (sidebar, dashboard, /proveedores, /compras, hub de alertas —
 * mismo control, siempre lleva a `/portal/compras/nueva`).
 */
export function NewPurchaseButton({ href }: { href: string }) {
  const inner = (
    <>
      <span
        className="grid place-items-center rounded-full flex-shrink-0 text-[15px] font-bold leading-none"
        style={{ width: 22, height: 22, background: "var(--color-wine)", color: "var(--color-on-accent)" }}
        aria-hidden
      >
        +
      </span>
      <span className="flex flex-col items-start leading-none gap-1 text-left">
        <span className="text-[14px] font-bold text-ink">Nueva compra</span>
        <span
          className="text-[10.5px] uppercase tracking-[0.1em] text-grey-700"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        >
          = prealerta
        </span>
      </span>
    </>
  );

  const className =
    "btn btn-ghost inline-flex items-center gap-2.5 flex-shrink-0";
  const style = {
    height: 40,
    padding: "0 14px",
    borderColor: "var(--color-wine)",
  } as const;
  const ariaLabel = "Registrar una nueva compra (prealerta)";

  return (
    <Link href={href} aria-label={ariaLabel} className={className} style={style}>
      {inner}
    </Link>
  );
}
