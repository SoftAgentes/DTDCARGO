"use client";

/**
 * ConversationsIndicator · icono de Conversaciones en el topbar (SDD-0148).
 *
 * Al lado de la campana: badge con el nº de conversaciones con mensajes SIN LEER
 * del tenant, siempre visible en cada pantalla del ERP → el equipo ve al toque si
 * un cliente escribió. Click = va a la bandeja `/studio/conversaciones`.
 *
 * Calca el patrón de `NotificationBell`: el layout server-fetcha las conversaciones
 * no leídas; `useRealtimeTable` sobre `conversations` (ya en la publicación) las
 * mantiene vivas — al bumpear `unread_count` (nuevo inbound) o reabrirse un hilo
 * resuelto, el upsert del hook lo refleja sin recargar; al leerse (unread→0) deja
 * de contar. Sin estado propio de lectura: la "lectura" ocurre en la bandeja.
 */

import Link from "next/link";
import { Icon } from "../../_components/icons";
import { useRealtimeTable } from "@/lib/studio/hooks/use-realtime-table";

type ConvBadgeRow = { id: string; unread_count: number };

export function ConversationsIndicator({
  tenantId,
  initial,
}: {
  tenantId: string | null;
  initial: ConvBadgeRow[];
}) {
  const { data } = useRealtimeTable<ConvBadgeRow>({
    table: "conversations",
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    initial,
    disabled: !tenantId,
  });

  const count = data.filter((c) => (c.unread_count ?? 0) > 0).length;
  const label = "Conversaciones";

  return (
    <Link
      href="/studio/conversaciones"
      title={label}
      aria-label={
        count > 0 ? `${label} · ${count} sin leer` : label
      }
      className="studio-icono-btn"
      style={{ position: "relative" }}
    >
      {Icon.mail(16)}
      {count > 0 && (
        <span
          aria-hidden="true"
          className="studio-contador-icono"
          data-tono="tinta"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
