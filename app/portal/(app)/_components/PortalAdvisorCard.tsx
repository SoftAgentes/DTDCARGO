import Link from "next/link";
import Image from "next/image";
import { CONTACT, buildWhatsAppLink } from "@/lib/design-tokens";
import { ChatIcon, PhoneIcon, WhatsAppIcon } from "@/components/Icon";
import {
  buildAdvisorCardModel,
  type PortalAdvisor,
  type PortalClient,
} from "@/lib/portal/portal-types";

/**
 * Card "Tu asesor" del Inicio — diseño de Cloud Design (`_norte/portal/app.jsx`,
 * bloque "TU AGENTE" de `PortalHome`): quién te atiende, cómo escribirle y
 * entrada directa al chat de Soporte.
 *
 * Los datos son REALES: sale del asesor asignado al cliente (`clients.advisor_id`
 * vía `getPortalAdvisor`). Si no hay asesor asignado —o si su ficha no tiene
 * teléfono— degrada al contacto público del CRM, igual que la card de Soporte.
 * Nunca inventa un nombre.
 */
export function PortalAdvisorCard({
  client,
  advisor,
}: {
  client: PortalClient;
  advisor: PortalAdvisor | null;
}) {
  const model = buildAdvisorCardModel(advisor, CONTACT.ve.whatsappRaw);
  const greeting = model.isReal
    ? `Hola ${model.name}, soy ${client.name} (${client.markbox}) y tengo una consulta.`
    : `Hola DTD Cargo, soy ${client.name} (${client.markbox}) y tengo una consulta.`;
  const waLink = model.isReal
    ? `https://wa.me/${model.whatsappRaw}?text=${encodeURIComponent(greeting)}`
    : buildWhatsAppLink(greeting);

  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6">
      <div className="eyebrow eyebrow-wine">Tu asesor</div>

      <div className="mt-4 flex items-center gap-3.5">
        {model.avatarUrl ? (
          <Image
            src={model.avatarUrl}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[15px] font-bold"
            style={{
              background: "var(--color-wine)",
              color: "var(--color-on-accent)",
              fontFamily: "var(--font-archivo-black)",
            }}
            aria-hidden
          >
            {initials(model.name)}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-ink truncate">
            {model.name ?? "Equipo DTD Cargo"}
          </div>
          <div className="mt-0.5 text-[11.5px] text-grey-500 truncate">
            {model.positionLabel ??
              (model.isReal ? "Tu asesor asignado" : "Atención al cliente")}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-[10px] bg-grey-100 px-3 py-2.5 transition-colors hover:bg-grey-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="text-wine-text shrink-0">
            <WhatsAppIcon size={16} />
          </span>
          <span className="text-[12.5px] font-bold text-ink">
            {model.isReal ? `Escríbele a ${firstName(model.name)}` : "Escribir por WhatsApp"}
          </span>
        </a>
        <a
          href={`tel:${CONTACT.ve.phoneRaw}`}
          className="flex items-center gap-3 rounded-[10px] bg-grey-100 px-3 py-2.5 transition-colors hover:bg-grey-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="text-wine-text shrink-0">
            <PhoneIcon size={16} />
          </span>
          <span
            className="text-[12.5px] font-bold text-ink truncate"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            {CONTACT.ve.phone}
          </span>
        </a>
      </div>

      <Link
        href="/portal/soporte"
        className="btn btn-ghost mt-3 inline-flex w-full items-center justify-center gap-2"
      >
        <ChatIcon size={15} /> Abrir el chat de soporte
      </Link>
    </div>
  );
}

/** Iniciales (máx 2) para el avatar cuando el asesor no tiene foto. */
function initials(name: string | null): string {
  if (!name) return "DTD";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "DTD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/** Primer nombre, para el copy del botón de WhatsApp. */
function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] ?? "tu asesor";
}
