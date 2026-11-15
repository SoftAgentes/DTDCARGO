import Link from "next/link";
import { ArrowIcon } from "@/components/Icon";
import { StatusIcon } from "@/components/StatusIcon";

/**
 * Aviso del dashboard: el perfil está incompleto (REGISTRO EXPRESS · founder
 * 2026-06-07). El alta express difiere foto + dirección; este card recuerda al
 * cliente completarlas antes de su primera compra. Lista exactamente lo que
 * falta y se oculta cuando el perfil ya está completo.
 *
 * Destino del CTA: TODO vive en `/portal/perfil` — "Mi perfil" unificado
 * (SDD-0145): la foto de cédula/RIF es la fila de documento pendiente y las
 * direcciones son PortalAddresses (SDD-0138, múltiples con predeterminada).
 */
export function ProfileIncompleteCard({
  hasPhoto,
  hasAddress,
}: {
  hasPhoto: boolean;
  hasAddress: boolean;
}) {
  const missing: string[] = [];
  if (!hasPhoto) missing.push("la foto de tu cédula / RIF");
  if (!hasAddress) missing.push("tu dirección de entrega");
  const missingText =
    missing.length === 2 ? `${missing[0]} y ${missing[1]}` : missing[0];
  const onlyAddress = hasPhoto && !hasAddress;
  const ctaHref = "/portal/perfil";
  const ctaLabel = onlyAddress ? "Agregar dirección" : "Completar ahora";

  return (
    // SDD-0603 · T4e (BD-037): franja plana de atención; color en `claridad.css`.
    <div className="portal-aviso rounded-[16px] p-5 sm:p-6" data-tono="atencion">
      <span className="portal-aviso-icono">
        <StatusIcon tone="warning" size={16} />
      </span>
      <div className="portal-aviso-cuerpo">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="min-w-0">
            {/* Eyebrow en grey-700 (AA): el ámbar a 11px sobre card mide 3.14:1
                — el estado lo llevan el icono de atención y el copy. SDD-0176. */}
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-700">
              Completa tu perfil
            </div>
            <p className="mt-1.5 text-[14px] text-grey-700 leading-[1.55]">
              Antes de tu primera compra necesitamos {missingText}. Te toma un par de
              minutos y lo haces una sola vez.
            </p>
          </div>
          <Link
            href={ctaHref}
            className="btn btn-primary flex-shrink-0 inline-flex items-center gap-2 whitespace-nowrap"
          >
            {ctaLabel} <ArrowIcon />
          </Link>
        </div>
      </div>
    </div>
  );
}
