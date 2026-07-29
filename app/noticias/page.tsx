import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WhatsAppFAB } from "@/components/WhatsAppFAB";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { socialMeta } from "@/lib/seo-og";
import { listPublishedPosts } from "@/lib/public/news-queries";
import { ActualidadHub } from "./_components/ActualidadHub";

export const metadata: Metadata = {
  title: "Actualidad, guía y noticias",
  description:
    "Guías, noticias y análisis para comprar, enviar y recibir mercancía de China a Venezuela con información clara y experiencia logística real.",
  keywords: [
    "importar de China a Venezuela",
    "guías de importación",
    "noticias logística China Venezuela",
    "carga marítima Venezuela",
  ],
  alternates: { canonical: "/noticias" },
  ...socialMeta({
    title: "Actualidad, guía y noticias · DTD Cargo",
    description:
      "Información clara para comprar, enviar y recibir mercancía de China a Venezuela.",
    path: "/noticias",
  }),
};

export default async function NoticiasPage() {
  const posts = await listPublishedPosts();

  return (
    <>
      <Nav />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Actualidad", path: "/noticias" },
        ]}
      />
      <ActualidadHub posts={posts} />
      <Footer />
      <WhatsAppFAB />
    </>
  );
}
