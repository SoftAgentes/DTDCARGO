/**
 * Set de íconos SVG portados del Brand Book DTD (sección iconografía).
 * Stroke 1.6, viewBox 32×32 (líneas) o 24×24 (UI).
 */

type IconProps = { className?: string; size?: number };

// `aria-hidden` por defecto: los iconos son decorativos y van junto a texto;
// los pocos icon-only viven dentro de botones/enlaces con su propio aria-label.
const base = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export function ArrowIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={2} className={className}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

/** Bucle / ciclo continuo (dos flechas en círculo). Para el badge del hero y
 *  el cierre de "Cómo trabajamos" — "de China a tu puerta, una y otra vez". */
export function LoopIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={2} className={className} aria-hidden>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8" />
      <path d="M20 3.5v4.5h-4.5" />
      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 16" />
      <path d="M4 20.5V16h4.5" />
    </svg>
  );
}

export function DownloadIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={2} className={className}>
      <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
    </svg>
  );
}

/** Play (triángulo) — botón de video-ayuda (SDD-0098). */
export function PlayIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={2} className={className}>
      <path d="M7 5.5v13l11-6.5z" />
    </svg>
  );
}

export function CloseIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={2.2} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Chevron hacia abajo — acordeones (gira con group-open:rotate-180). */
export function ChevronDownIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={2.2} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PinIcon({ className, size = 18 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={1.8} className={className}>
      <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

export function SearchIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={2} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function ShipIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <path d="M4 22l2 5h20l2-5" />
      <path d="M6 22V14h20v8" />
      <path d="M10 14V8h12v6" />
      <path d="M16 4v4" />
    </svg>
  );
}

export function PlaneIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <path d="M3 18l11-3 4-9 3 1-2 9 8-1 1 3-8 3 1 6-3 1-3-5-9 3z" />
    </svg>
  );
}

export function TruckIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <rect x="3" y="9" width="16" height="12" />
      <path d="M19 13h6l4 4v4h-10z" />
      <circle cx="9" cy="24" r="3" />
      <circle cx="23" cy="24" r="3" />
    </svg>
  );
}

export function WarningIcon({ className, size = 18 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={2} className={className}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function BoxIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <path d="M16 4 4 10v12l12 6 12-6V10z" />
      <path d="m4 10 12 6 12-6" />
      <path d="M16 16v12" />
      <path d="m10 7 12 6" />
    </svg>
  );
}

export function CartIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <path d="M4 5h4l3 16h14l2-11H10" />
      <circle cx="13" cy="26" r="2" />
      <circle cx="24" cy="26" r="2" />
    </svg>
  );
}

export function ShieldIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <path d="M16 3 5 7v10c0 7 5 11 11 13 6-2 11-6 11-13V7Z" />
      <path d="m11 16 4 4 7-8" />
    </svg>
  );
}

/** Persona — cabeza + hombros. Para el selector persona natural / empresa del
 *  registro (par con ShieldIcon). */
export function UserIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <circle cx="16" cy="11" r="5" />
      <path d="M7 27c0-5 4-8 9-8s9 3 9 8" />
    </svg>
  );
}

export function StampIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <path d="M9 4h14v10l-3 6H12l-3-6Z" />
      <rect x="6" y="22" width="20" height="3" />
      <rect x="4" y="26" width="24" height="2" />
    </svg>
  );
}

export function PassportIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <rect x="6" y="3" width="20" height="26" rx="2" />
      <circle cx="16" cy="13" r="4" />
      <path d="M11 22h10M13 25h6" />
    </svg>
  );
}

export function ContainerIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <rect x="3" y="9" width="26" height="16" rx="1" />
      <path d="M8 9v16M12 9v16M16 9v16M20 9v16M24 9v16" />
    </svg>
  );
}

export function WarehouseIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <path d="M4 13 16 5l12 8v14H4z" />
      <path d="M9 27v-9h14v9" />
      <path d="M9 22h14" />
    </svg>
  );
}

export function CheckIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.8} className={className}>
      <circle cx="16" cy="16" r="12" />
      <path d="m10 16 4 4 8-8" />
    </svg>
  );
}

export function PaymentIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <rect x="3" y="8" width="26" height="17" rx="2" />
      <path d="M3 14h26" />
      <path d="M8 20h6" />
    </svg>
  );
}

export function DocIcon({ className, size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} {...base} strokeWidth={1.6} className={className}>
      <path d="M8 4h12l6 6v18H8z" />
      <path d="M20 4v6h6" />
      <path d="M12 16h12M12 20h12M12 24h8" />
    </svg>
  );
}

export function QuoteIcon({ className, size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="currentColor" className={className} aria-hidden>
      <path d="M9 9c-3 0-5 2.5-5 5.5S6 20 9 20c-1 4-4 5-4 5l1 2c2-1 8-3 8-12.5 0-3.5-2-5.5-5-5.5zm14 0c-3 0-5 2.5-5 5.5s2 5.5 5 5.5c-1 4-4 5-4 5l1 2c2-1 8-3 8-12.5 0-3.5-2-5.5-5-5.5z" />
    </svg>
  );
}

export function InstagramIcon({ className, size = 22 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function PhoneIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function MailIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

export function MapPinIcon({ className, size = 14 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function StarIcon({ className, size = 22 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.3l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94z" />
    </svg>
  );
}

export function WhatsAppIcon({ className, size = 22 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden>
      <path d="M17.5 14.4c-.3-.15-1.78-.88-2.06-.98-.27-.1-.47-.15-.67.15-.2.3-.77.98-.95 1.18-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.21 5.09 4.5.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.17-1.43-.08-.13-.27-.2-.57-.35zM12.05 21.5h-.03c-1.84 0-3.65-.49-5.23-1.43L6.4 20l-3.85 1.01 1.03-3.76-.25-.4a8.45 8.45 0 0 1-1.3-4.5c0-4.67 3.8-8.47 8.48-8.47 2.27 0 4.4.88 6 2.49 1.6 1.6 2.48 3.73 2.48 6-.01 4.67-3.8 8.47-8.49 8.47zm7.22-15.7A10.1 10.1 0 0 0 12.05 3C6.46 3 1.9 7.55 1.9 13.13c0 1.78.47 3.52 1.35 5.06L1.83 23l4.92-1.29a10.13 10.13 0 0 0 4.84 1.23h.01c5.6 0 10.15-4.55 10.15-10.13 0-2.7-1.05-5.25-2.97-7.16z" />
    </svg>
  );
}

/**
 * Banderas de país — chips pequeños para indicar origen/destino del envío.
 * Diseño simplificado para legibilidad a ~22px de ancho. Aspect ratio 3:2.
 * `size` = ancho en px (height se computa automáticamente como 2/3).
 *
 * Colores oficiales:
 * - China:     PRC red #EE1C25 + amarillo #FFFF00 (single star simplified)
 * - Venezuela: amarillo #FCD116 + azul #00247D + rojo #CF142B (CIA Factbook)
 */
export function FlagCN({ className, size = 22 }: IconProps) {
  const h = Math.round((size * 2) / 3);
  return (
    <svg
      viewBox="0 0 30 20"
      width={size}
      height={h}
      className={className}
      aria-hidden
    >
      <rect width="30" height="20" rx="2.5" fill="#EE1C25" />
      <path
        d="M 7.5 4.2 L 8.93 8.6 L 13.55 8.6 L 9.81 11.32 L 11.24 15.72 L 7.5 13 L 3.76 15.72 L 5.19 11.32 L 1.45 8.6 L 6.07 8.6 Z"
        fill="#FFFF00"
      />
    </svg>
  );
}

export function FlagVE({ className, size = 22 }: IconProps) {
  const h = Math.round((size * 2) / 3);
  return (
    <svg
      viewBox="0 0 30 20"
      width={size}
      height={h}
      className={className}
      aria-hidden
    >
      <rect width="30" height="20" rx="2.5" fill="#00247D" />
      <rect width="30" height="6.67" fill="#FCD116" />
      <rect y="13.33" width="30" height="6.67" fill="#CF142B" />
      {/* 8 estrellas oficiales simplificadas a 3 puntos blancos en el arco azul */}
      <circle cx="11" cy="10" r="0.65" fill="#FFFFFF" />
      <circle cx="15" cy="9.4" r="0.65" fill="#FFFFFF" />
      <circle cx="19" cy="10" r="0.65" fill="#FFFFFF" />
    </svg>
  );
}
