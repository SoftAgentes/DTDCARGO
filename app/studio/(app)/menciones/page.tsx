/**
 * /studio/menciones · Bandeja "Menciones" (SDD-0045).
 *
 * Server component:
 *   1. Auth.
 *   2. Carga mis menciones (comment + entidad) via listMyMentions + usuarios del
 *      tenant para resolver autores.
 *   3. Render header + lista. La interacción (click → navegar + marcar leído,
 *      "marcar todas leídas") vive en MentionsInboxClient.
 *
 * La fila de comment_mentions ES la notificación in-app: read_at null = no leída.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getUser } from "@/lib/auth/session";
import {
  listMyMentions,
  loadTenantUsers,
} from "@/lib/studio/comments/comments-queries";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { MentionsInboxClient } from "./_components/MentionsInboxClient";

export const metadata = { title: "Menciones · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function MencionesPage() {
  const user = await getUser();
  if (!user) redirect("/studio/login");

  const supabase = await createClient();
  const users = await loadTenantUsers(supabase);
  const items = await listMyMentions(supabase, user.id, users, { limit: 100 });

  const unread = items.filter((i) => i.read_at === null).length;

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ marginBottom: 24 }}>
        <span className="studio-eyebrow">Sistema · Colaboración</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
        >
          Menciones
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "76ch",
          }}
        >
          {items.length === 0
            ? "Cuando alguien te @mencione en un comentario, aparece acá."
            : `${unread} sin leer · ${items.length} en total. Tocá una mención para ir al registro.`}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          eyebrow="Bandeja vacía"
          title="No tenés menciones"
          description="Cuando un compañero te mencione con @ en un comentario, vas a verlo acá con un enlace directo al registro."
        />
      ) : (
        <MentionsInboxClient items={items} />
      )}
    </div>
  );
}
