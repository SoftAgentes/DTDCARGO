import { redirect } from "next/navigation";

/**
 * SDD-0061 Fase B2.5 — el registro se unificó en `/registro` (público,
 * Supabase-backed). Esta ruta queda solo como REDIRECT para links viejos
 * (CTAs de calculadora con `?est=`, bookmarks, el welcome email). Preserva
 * el `?est=` para no perder el vínculo del estimado.
 */
export default async function PortalRegistroRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const estRaw = Array.isArray(raw.est) ? raw.est[0] : raw.est;
  const est = (estRaw ?? "").trim().slice(0, 40);
  redirect(est ? `/registro?est=${encodeURIComponent(est)}` : "/registro");
}
