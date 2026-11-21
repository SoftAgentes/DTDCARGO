/**
 * /studio/marketing/noticias-web/retirar/[id] · SDD-0625.
 *
 * La pantalla de retiro de SDD-0611 §4.5: el aviso de `#noticias` ya enlaza a
 * esta ruta (`lib/studio/news/autopublicar.ts`). Lista de motivos de §4.11,
 * motivo obligatorio, nota obligatoria con «Otro». Solo admin activo.
 */
import Link from "next/link";
import { cargarNoticiaPublicada } from "@/lib/studio/news-publicadas-queries";
import { NoticiasShell } from "../../_components/NoticiasShell";
import { NoticiasTabs } from "../../_components/NoticiasTabs";
import { RetiroForm } from "../../publicadas/_components/RetiroForm";
import { puertaNoticiasAdmin } from "../../publicadas/_gate";

export const metadata = { title: "Retirar noticia · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function RetirarNoticiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, tenantId } = await puertaNoticiasAdmin();
  const noticia = await cargarNoticiaPublicada(supabase, tenantId, id);

  return (
    <NoticiasShell
      arriba={<NoticiasTabs activa="publicadas" />}
      eyebrow="Marketing · Noticias Web · Retirar"
      titulo="Retirar del sitio"
      descripcion="La noticia sale de /noticias y del mapa del sitio. No se borra: queda en Retiradas y se puede volver a publicar. El motivo vuelve a quienes la escribieron y la revisaron."
    >
      {noticia ? (
        <RetiroForm id={noticia.id} titulo={noticia.title} slug={noticia.slug} />
      ) : (
        <p style={{ fontSize: 14 }}>
          Esa noticia no está publicada (puede que ya la hayan retirado).{" "}
          <Link href="/studio/marketing/noticias-web/publicadas" style={{ color: "var(--color-wine-text, #7F0F1A)" }}>
            Ver Publicadas y Retiradas
          </Link>
        </p>
      )}
    </NoticiasShell>
  );
}
