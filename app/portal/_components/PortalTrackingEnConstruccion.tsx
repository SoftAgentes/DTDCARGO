import Link from "next/link";
import { ArrowIcon, RadarIcon } from "@/components/Icon";
import { TRACKING_EN_CONSTRUCCION } from "@/lib/portal/tracking-en-construccion";

/**
 * Aviso «Seguimiento en construcción» (SDD-0514 · pedido de Sam 2026-10-14:
 * «quiero que en el portal del cliente diga que esto está en construcción y que
 * pronto lo tendremos disponible»).
 *
 * Va sólo donde hoy falta información porque el almacén de China todavía
 * registra en Excel: portada, Envíos (lista y Seguimiento total), detalle de un
 * envío y detalle de una compra. No va en el layout: no es un aviso de todo el
 * Portal.
 *
 * Se apaga con `TRACKING_EN_CONSTRUCCION` en `lib/portal/tracking-en-construccion.ts`;
 * este componente es el único que lo lee.
 *
 * El aviso se SUMA a la pantalla y no reemplaza nada: si un envío o una compra
 * ya tiene hitos, recepciones o datos de naviera, se siguen mostrando debajo.
 *
 * Tono «información» de BRAND.md (estados, 2026-09-05): no es un riesgo ni un
 * error, así que no va en dorado ni en rojo. Mismo armazón que
 * `PortalMaintenanceNotice` y `ProfilePendingBanner` (card con borde izquierdo
 * de estado); el borde y el ícono van en `--portal-info` (tinta neutra por
 * tema) y el texto en ink / grey-700, que pasan AA en claro y oscuro.
 *
 * Sin JS propio: se puede montar desde un server component o desde el hub de
 * Envíos, que es cliente.
 */
export function PortalTrackingEnConstruccion({
  className = "",
}: {
  /** Margen exterior según la pantalla (ej. `mt-6`). */
  className?: string;
}) {
  if (!TRACKING_EN_CONSTRUCCION) return null;
  return (
    <div
      role="status"
      className={`card-shadow bg-white border border-grey-200 rounded-[16px] border-l-[3px] p-5 sm:p-6 ${className}`}
      style={{ borderLeftColor: "var(--portal-info, var(--color-ink))" }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0"
          style={{ color: "var(--portal-info, var(--color-ink))" }}
        >
          <RadarIcon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-ink leading-[1.3]">
            Seguimiento en construcción
          </p>
          <p className="mt-2 text-[13.5px] text-grey-700 leading-[1.55] max-w-[65ch]">
            Estamos activando el registro de tu mercancía en nuestra bodega de
            China. Muy pronto vas a ver aquí cada paso de tu carga. Tus
            pre-alertas quedan guardadas y nuestro equipo las recibe.
          </p>
          <Link
            href="/portal/soporte"
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded text-[13px] font-bold text-ink underline underline-offset-4 transition-colors hover:text-wine-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            ¿Dudas? Escríbenos en Soporte <ArrowIcon size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
