import { buildWhatsAppLink } from "@/lib/design-tokens";
import { WhatsAppIcon } from "@/components/Icon";

/**
 * Pantalla de espera del portal (SDD-0042 · Fase 5.1 · gate de activación).
 *
 * Se muestra en `/portal` cuando la cuenta del cliente todavía NO está activada
 * (ni aprobada por un asesor, ni con su primera carga). El cliente puede entrar
 * (login OK) pero no ve el dashboard hasta destrabar el gate.
 *
 * Marca del portal (paper/wine + clases del sitio público), sólo tokens `var(--*)`.
 */
export function PortalPending({
  name,
  markbox,
}: {
  name: string;
  markbox: string;
}) {
  const firstName = name.trim().split(/\s+/)[0] || name;
  const waLink = buildWhatsAppLink(
    `Hola DTD Cargo, soy ${name} (${markbox}) y quiero activar mi cuenta del portal.`,
  );

  return (
    <div>
      <span className="eyebrow">Tu cuenta</span>
      <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
        Hola {firstName}.
      </h1>
      <p className="lead mt-3 max-w-[58ch]">
        Tu cuenta ya está creada y tu MARKBOX está listo para marcar tus cajas en
        China.
      </p>

      <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] border-l-[3px] p-7 sm:p-9 max-w-[680px]"
        style={{ borderLeftColor: "var(--color-wine)" }}
      >
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine">
          Cuenta en revisión
        </div>

        {/* MARKBOX prominente — el cliente lo necesita YA para sus cajas */}
        <div className="mt-4 rounded-[12px] bg-paper border border-grey-200 p-5 inline-flex flex-col">
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-grey-500">
            Tu MARKBOX
          </div>
          <div
            className="mt-1.5 text-[28px] sm:text-[32px] leading-none text-ink"
            style={{
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
              letterSpacing: "-0.01em",
            }}
          >
            {markbox}
          </div>
        </div>

        <p className="mt-6 text-[15px] text-grey-700 leading-[1.6]">
          Todavía no puedes ver tu dashboard hasta que un asesor te apruebe o
          realices tu primera carga.
        </p>

        <div className="mt-7 pt-6 border-t border-grey-200">
          <p className="text-[13.5px] text-grey-700 leading-[1.55]">
            ¿Querés que activemos tu cuenta ahora? Escribile a tu asesor y lo
            resolvemos.
          </p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary mt-4 inline-flex items-center gap-2"
          >
            <WhatsAppIcon size={18} /> Escribir a mi asesor
          </a>
        </div>
      </div>
    </div>
  );
}
