import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient, getPortalAdvisor } from "@/lib/portal/portal-queries";
import {
  buildAdvisorCardModel,
  type PortalAdvisor,
  type PortalClient,
} from "@/lib/portal/portal-types";
import {
  getPortalThread,
  type PortalThreadMessage,
} from "@/lib/portal/portal-conversation-queries";
import { PortalMessageForm } from "./PortalMessageForm";
import { SoporteHubTabs } from "../../_components/PortalHubTabs";
import { CONTACT } from "@/lib/design-tokens";
import { WhatsAppIcon, MailIcon, PhoneIcon } from "@/components/Icon";

export const metadata: Metadata = { title: "Mensajes" };

/**
 * Mensajes del portal (SDD-0056 · Fase 1 · canal Portal).
 *
 * El cliente escribe a su asesor; el mensaje entra a la bandeja del Studio
 * (Conversaciones) como inbound. El hilo se lee con el admin client scopeado por
 * el client_id resuelto por sesión (el cliente no tiene RLS sobre esas tablas).
 */
export default async function PortalMensajesPage({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string }>;
}) {
  // Prefill del chat cuando el cliente llega desde "Actualizar mis datos" (Mi
  // perfil): abre la caja con la consulta ya escrita para que solo complete.
  const { tema } = await searchParams;
  const prefill =
    tema === "datos"
      ? "Hola, quiero actualizar unos datos de mi cuenta: "
      : undefined;

  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return null;

  const admin = createAdminClient();

  let thread: PortalThreadMessage[] = [];
  try {
    thread = await getPortalThread(admin, client.id);
  } catch {
    thread = [];
  }

  // Asesor asignado (ERP→Norte · clients.advisor_id). Si no hay → la card degrada
  // al contacto público (CRM). El cliente del portal no tiene RLS sobre los perfiles
  // del equipo, por eso se resuelve con el admin client (igual que el hilo).
  let advisor: PortalAdvisor | null = null;
  try {
    advisor = await getPortalAdvisor(admin, client.id);
  } catch {
    advisor = null;
  }

  return (
    <div>
      <SoporteHubTabs />
      <span className="eyebrow">Atención al cliente</span>
      <h1
        className="mt-2 text-[30px] sm:text-[36px] leading-none text-ink"
        style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
      >
        Mensajes
      </h1>
      <p className="mt-3 text-[14px] text-grey-700 leading-[1.55] max-w-[60ch]">
        Escríbele a tu asesor de DTD Cargo. Te respondemos por acá y, si tienes
        email registrado, también te llega por correo.
      </p>

      <div className="mt-7 grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-6 items-start">
        {/* Hilo + formulario */}
        <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-5 sm:p-7">
          {thread.length === 0 ? (
            <p className="text-[13.5px] text-grey-500 leading-[1.5] py-4 text-center">
              Todavía no hay mensajes. Escríbenos abajo y un asesor te responde.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {thread.map((m) => {
                const out = m.direction === "out"; // out = DTD hacia el cliente
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col gap-1 ${out ? "items-start" : "items-end"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-[14px] px-4 py-2.5 text-[13.5px] leading-[1.5] whitespace-pre-wrap break-words ${
                        out
                          ? "bg-grey-100 text-ink"
                          : "bg-wine text-[color:var(--color-on-accent)]"
                      }`}
                    >
                      {m.body}
                    </div>
                    <span className="text-[11px] text-grey-500 px-1">
                      {out ? `${m.authorName ?? "DTD Cargo"} · ` : "Tú · "}
                      {fmtDate(m.sentAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-grey-200">
            <PortalMessageForm prefill={prefill} />
          </div>
        </div>

        {/* Asesor por WhatsApp — mudado desde el dashboard (founder 2026-06-20):
            el contacto del asesor vive acá, en Atención al cliente. */}
        <div className="flex flex-col gap-6">
          <AsesorCard client={client} advisor={advisor} />
          <OtrosCanalesCard />
        </div>
      </div>
    </div>
  );
}

/** Iniciales (máx 2) del nombre del asesor para el avatar de la card. */
function advisorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Tarjeta "Tu asesor" — contacto por WhatsApp. Mudada desde el dashboard (founder
 * 2026-06-20). ERP→Norte: si el cliente tiene un asesor ASIGNADO (clients.advisor_id)
 * muestra su nombre/cargo y el WhatsApp va directo a su número; si no, degrada al
 * contacto público (CRM). El mensaje se precarga con el nombre + código del cliente.
 */
function AsesorCard({
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
  const waLink = `https://wa.me/${model.whatsappRaw}?text=${encodeURIComponent(greeting)}`;

  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6">
      <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
        Tu asesor
      </div>

      {model.isReal && model.name ? (
        <div className="mt-4 flex items-center gap-3">
          <div
            className="flex shrink-0 items-center justify-center rounded-full bg-wine text-[color:var(--color-on-accent)]"
            style={{
              width: 44,
              height: 44,
              fontFamily: "var(--font-archivo-black)",
              fontSize: 15,
              letterSpacing: "0.02em",
            }}
          >
            {advisorInitials(model.name)}
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-ink leading-tight truncate">
              {model.name}
            </div>
            <div className="text-[12.5px] text-grey-600 leading-tight">
              {model.positionLabel ?? "Tu asesor en DTD Cargo"}
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-[13.5px] text-grey-700 leading-[1.55]">
        {model.isReal
          ? "Escríbele directo por WhatsApp para cotizar, prealertar una compra o resolver cualquier duda."
          : "¿Prefieres WhatsApp? Escríbele directo a tu asesor de DTD para cotizar, prealertar una compra o resolver cualquier duda."}
      </p>

      {!model.isReal && (
        <div
          className="mt-4 text-[13px] text-grey-700"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        >
          {CONTACT.ve.whatsapp}
        </div>
      )}

      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost mt-4 inline-flex w-full justify-center items-center gap-2"
      >
        <WhatsAppIcon size={18} /> Escribir por WhatsApp
      </a>
    </div>
  );
}

/**
 * "Otros canales" (Norte · PortalSupport) — vías alternas al chat/WhatsApp del
 * asesor: correo y teléfono fijo. Datos desde `CONTACT.ve` (fuente única de NAP).
 */
function OtrosCanalesCard() {
  const mono = {
    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
  } as const;
  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6">
      <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
        Otros canales
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <a
          href={`mailto:${CONTACT.ve.email}`}
          className="flex items-center gap-3 rounded-[10px] bg-grey-100 px-3 py-2.5 transition-colors hover:bg-grey-200"
        >
          <span className="text-wine shrink-0">
            <MailIcon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold text-ink">Email</span>
            <span className="block text-[11.5px] text-grey-700 truncate" style={mono}>
              {CONTACT.ve.email}
            </span>
          </span>
        </a>
        <a
          href={`tel:${CONTACT.ve.phoneRaw}`}
          className="flex items-center gap-3 rounded-[10px] bg-grey-100 px-3 py-2.5 transition-colors hover:bg-grey-200"
        >
          <span className="text-wine shrink-0">
            <PhoneIcon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold text-ink">Teléfono</span>
            <span className="block text-[11.5px] text-grey-700 truncate" style={mono}>
              {CONTACT.ve.phone}
            </span>
          </span>
        </a>
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
