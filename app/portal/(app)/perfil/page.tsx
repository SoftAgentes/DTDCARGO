import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import {
  getPortalClient,
  getProfileCompleteness,
} from "@/lib/portal/portal-queries";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Completá tu perfil" };

/**
 * "Completá tu perfil" (REGISTRO EXPRESS · founder 2026-06-07). El alta express
 * difiere la foto de cédula + la dirección de entrega; acá el cliente las completa.
 * Se piden antes de la 1ª compra (el asesor revisa la foto antes de operar).
 *
 * El layout `(app)` ya garantizó la sesión del portal (redirect al login si null);
 * acá `client` es defensa extra.
 */
export default async function PortalProfilePage() {
  const supabase = await createClient();

  const client = await getPortalClient(supabase);
  if (!client) return null;

  const completeness = await getProfileCompleteness(supabase);

  return (
    <div>
      <span className="eyebrow">Tu cuenta</span>
      <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
        Completá tu perfil.
      </h1>
      <p className="lead mt-3 max-w-[60ch]">
        Para tu primera compra necesitamos dos cosas: la foto de tu cédula o RIF (para
        verificar tu identidad) y tu dirección de entrega en Venezuela. Lo hacés una
        sola vez.
      </p>

      {completeness.complete && (
        <div
          className="mt-6 rounded-[12px] bg-white border border-grey-200 border-l-[3px] px-5 py-4 max-w-[640px] text-[13.5px] text-grey-700 leading-[1.55]"
          style={{ borderLeftColor: "var(--color-status-success)" }}
        >
          Tu perfil ya está completo. Podés actualizar tu dirección o reemplazar la
          foto cuando quieras.
        </div>
      )}

      <ProfileForm hasPhoto={completeness.hasPhoto} markbox={client.markbox} />
    </div>
  );
}
