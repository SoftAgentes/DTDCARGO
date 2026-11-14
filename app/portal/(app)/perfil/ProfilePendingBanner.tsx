import { ArrowIcon } from "@/components/Icon";
import { StatusIcon } from "@/components/StatusIcon";

/**
 * Aviso de pendientes DENTRO de "Mi perfil" (SDD-0151 · pedido founder
 * 2026-07-06). El card `ProfileIncompleteCard` solo vive en el dashboard
 * (`/portal`); al entrar al perfil el cliente perdía la señal de qué le falta
 * y solo quedaba el punto ámbar tenue de la fila de cédula. Este banner
 * reaparece la señal arriba del todo y — clave — cada pendiente es un ancla
 * que baja a su sección (ids `#doc-identidad` / `#direcciones`, sin JS).
 *
 * Se oculta solo cuando el perfil ya está completo (foto + dirección).
 */
export function ProfilePendingBanner({
  hasPhoto,
  hasAddress,
}: {
  hasPhoto: boolean;
  hasAddress: boolean;
}) {
  const items: { label: string; href: string }[] = [];
  if (!hasPhoto)
    items.push({ label: "Foto de tu cédula / RIF", href: "#doc-identidad" });
  if (!hasAddress)
    items.push({ label: "Dirección de entrega", href: "#direcciones" });
  if (items.length === 0) return null;

  return (
    // SDD-0603 · T4e (BD-037): franja plana de información (antes, borde
    // izquierdo en tinta). Pendiente no es riesgo: tono `info`.
    <div className="portal-aviso mt-6 rounded-[16px] p-5 sm:p-6" data-tono="info">
      <span className="portal-aviso-icono">
        <StatusIcon tone="info" size={16} />
      </span>
      <div className="portal-aviso-cuerpo">
        {/* Eyebrow en grey-700 (AA): el ámbar 11px sobre blanco no llega a 4.5:1
            — el estado lo llevan el icono y el punto (aria-hidden). */}
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-700">
          Datos por completar
        </div>
        <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55]">
          Antes de tu primera compra necesitamos esto. Entra a cada punto para
          completarlo — te toma un par de minutos y lo haces una sola vez.
        </p>
        <ul className="mt-4 flex flex-col gap-2 list-none p-0">
          {items.map((it) => (
            <li key={it.href}>
              <a
                href={it.href}
                className="group flex items-center gap-3 rounded-[10px] bg-white border border-grey-500 px-4 py-2.5 hover:border-wine transition-colors"
              >
                <span
                  className="block h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ background: "var(--color-ink)" }}
                  aria-hidden
                />
                <span className="flex-1 text-[13.5px] font-semibold text-ink">
                  {it.label}
                </span>
                <span className="flex-shrink-0 text-[12px] font-bold text-wine-text inline-flex items-center gap-1">
                  Completar
                  <ArrowIcon />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
