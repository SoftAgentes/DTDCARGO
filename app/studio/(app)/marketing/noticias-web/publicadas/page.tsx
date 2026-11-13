/**
 * /studio/marketing/noticias-web/publicadas · SDD-0625.
 *
 * Lista de lo que está en /noticias (para corregir o retirar) y de lo retirado
 * (para volver a publicar). Solo admin activo con `marketing_news` encendido.
 */
import { listarNoticiasDelSitio } from "@/lib/studio/news-publicadas-queries";
import { NoticiasShell } from "../_components/NoticiasShell";
import { NoticiasTabs } from "../_components/NoticiasTabs";
import { PublicadasClient } from "./_components/PublicadasClient";
import { puertaNoticiasAdmin } from "./_gate";

export const metadata = { title: "Noticias publicadas · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function NoticiasPublicadasPage() {
  const { supabase, tenantId } = await puertaNoticiasAdmin();
  const { publicadas, retiradas, error } = await listarNoticiasDelSitio(supabase, tenantId);

  return (
    <NoticiasShell
      arriba={<NoticiasTabs activa="publicadas" />}
      eyebrow="Marketing · Noticias Web"
      titulo={
        <>
          Noticias <span style={{ color: "var(--color-wine, #7F0F1A)" }}>publicadas</span>
        </>
      }
      descripcion="Corrige un dato, retira una noticia con su motivo o vuelve a publicar una retirada. El enlace de cada noticia no cambia. En el sitio, el cambio se ve en hasta 5 minutos."
    >
      <PublicadasClient publicadas={publicadas} retiradas={retiradas} error={error} />
    </NoticiasShell>
  );
}
