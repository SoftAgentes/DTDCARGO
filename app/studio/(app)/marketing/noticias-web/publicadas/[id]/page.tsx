/**
 * /studio/marketing/noticias-web/publicadas/[id] · SDD-0625 — corregir una noticia publicada.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarNoticiaPublicada } from "@/lib/studio/news-publicadas-queries";
import { NoticiasShell } from "../../_components/NoticiasShell";
import { NoticiasTabs } from "../../_components/NoticiasTabs";
import { EditarNoticiaForm } from "../_components/EditarNoticiaForm";
import { puertaNoticiasAdmin } from "../_gate";

export const metadata = { title: "Corregir noticia · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function EditarNoticiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, tenantId } = await puertaNoticiasAdmin();
  const noticia = await cargarNoticiaPublicada(supabase, tenantId, id);
  if (!noticia) notFound();

  return (
    <NoticiasShell
      arriba={<NoticiasTabs activa="publicadas" />}
      eyebrow="Marketing · Noticias Web · Corregir"
      titulo="Corregir noticia publicada"
      descripcion={
        <>
          El enlace <code>/noticias/{noticia.slug}</code> no cambia. Al guardar queda registrado quién y cuándo
          corrigió; en el sitio el cambio se ve en hasta 5 minutos.{" "}
          <Link href="/studio/marketing/noticias-web/publicadas" style={{ color: "var(--color-wine-text, #7F0F1A)" }}>
            Volver a Publicadas
          </Link>
        </>
      }
    >
      <EditarNoticiaForm noticia={noticia} />
    </NoticiasShell>
  );
}
