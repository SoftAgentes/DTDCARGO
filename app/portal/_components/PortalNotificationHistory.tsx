import type { PortalNotificationHistoryItem } from "@/lib/studio/notifications/notification-history-queries";

/**
 * "Avisos que te enviamos" (SDD-0156 · Slice C · loose end) — historial read-only
 * de las notificaciones ya despachadas de un envío (email/push). Reusa la piel
 * brand del portal (paper/wine/Archivo, tokens var(--*)). Si no hay avisos, no
 * renderiza nada (el caller decide el hueco).
 */

/** Fecha ISO → "12 jun 2026 · 14:30" en es-VE, o null si no parseable. */
function formatSentAt(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("es-VE", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date} · ${time}`;
  } catch {
    return null;
  }
}

/** Etiqueta corta del canal. */
function channelLabel(channel: "email" | "push" | "both"): string {
  switch (channel) {
    case "email":
      return "Correo";
    case "push":
      return "Notificación";
    case "both":
      return "Correo + notificación";
  }
}

export function PortalNotificationHistory({
  items,
}: {
  items: PortalNotificationHistoryItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
      <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500 mb-1">
        Avisos que te enviamos
      </h2>
      <p className="text-[12px] text-grey-500 mb-6 leading-[1.5]">
        El historial de notificaciones de este envío.
      </p>

      <ul className="flex flex-col gap-4">
        {items.map((item) => {
          const when = formatSentAt(item.sentAt);
          return (
            <li
              key={item.id}
              className="border-l-2 border-wine/30 pl-4 py-0.5"
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="text-[14.5px] font-semibold text-ink">
                  {item.title}
                </span>
                {when ? (
                  <span className="text-[11.5px] font-semibold text-grey-500 shrink-0">
                    {when}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[13px] text-grey-700 leading-[1.5]">
                {item.body}
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-[0.06em] uppercase text-grey-500">
                <span>{item.eventLabel}</span>
                <span aria-hidden>·</span>
                <span>{channelLabel(item.channel)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
