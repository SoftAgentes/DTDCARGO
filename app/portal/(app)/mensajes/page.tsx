import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient } from "@/lib/portal/portal-queries";
import {
  getPortalThread,
  type PortalThreadMessage,
} from "@/lib/portal/portal-conversation-queries";
import { PortalMessageForm } from "./PortalMessageForm";

export const metadata: Metadata = { title: "Mensajes" };

/**
 * Mensajes del portal (SDD-0056 · Fase 1 · canal Portal).
 *
 * El cliente escribe a su asesor; el mensaje entra a la bandeja del Studio
 * (Conversaciones) como inbound. El hilo se lee con el admin client scopeado por
 * el client_id resuelto por sesión (el cliente no tiene RLS sobre esas tablas).
 */
export default async function PortalMensajesPage() {
  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return null;

  let thread: PortalThreadMessage[] = [];
  try {
    thread = await getPortalThread(createAdminClient(), client.id);
  } catch {
    thread = [];
  }

  return (
    <div className="max-w-[760px]">
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

      {/* Hilo */}
      <div className="mt-7 card-shadow bg-white border border-grey-200 rounded-[18px] p-5 sm:p-7">
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
                        : "bg-wine text-white"
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
          <PortalMessageForm />
        </div>
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
