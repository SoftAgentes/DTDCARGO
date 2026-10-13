import type { AvisoMantenimiento } from "@/lib/runtime/maintenance-notice";

/**
 * Aviso de mantenimiento programado arriba del Portal (SDD-0505 · decisión de
 * Sam 2026-10-13: «pon en el portal del cliente que estamos en mantenimiento, y
 * pon el horario, pero que no le llegue mensaje a cada cliente»).
 *
 * Server component sin JS: el texto lo arma `avisoDeMantenimiento()` con las
 * variables MAINTENANCE_NOTICE_START/END y desaparece solo al pasar el fin.
 * Mismo patrón visual que ProfilePendingBanner: card con borde izquierdo de
 * estado. El estado lo llevan el borde y el punto dorados (aria-hidden); el
 * texto va en ink / grey-700, que cumplen AA en los dos temas (el dorado como
 * texto chico no llega a 4.5:1, ver BRAND.md ♿).
 */
export function PortalMaintenanceNotice({ aviso }: { aviso: AvisoMantenimiento | null }) {
  if (!aviso) return null;
  return (
    <div
      role="status"
      className="mb-6 card-shadow bg-white border border-grey-200 rounded-[16px] border-l-[3px] p-5 sm:p-6"
      style={{ borderLeftColor: "var(--color-status-warning)" }}
    >
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] uppercase text-grey-700">
        <span
          className="block h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: "var(--color-status-warning)" }}
          aria-hidden
        />
        {aviso.titulo}
      </div>
      <p className="mt-1.5 text-[13.5px] text-ink leading-[1.55]">{aviso.texto}</p>
    </div>
  );
}
