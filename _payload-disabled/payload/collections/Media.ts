import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
  slug: "media",
  admin: {
    description:
      "Imágenes, SVGs y assets editables. Logo final, fotos de blog, OG images, etc.",
  },
  access: {
    read: () => true, // Las imágenes son públicas (las sirve Supabase Storage).
  },
  upload: {
    mimeTypes: ["image/*", "application/pdf"],
    imageSizes: [
      { name: "thumbnail", width: 240, height: 240, position: "centre" },
      { name: "card", width: 720 },
      { name: "feature", width: 1440 },
      { name: "og", width: 1200, height: 630, position: "centre" },
    ],
    adminThumbnail: "thumbnail",
    focalPoint: true,
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: false,
      admin: {
        description:
          "Texto alternativo para accesibilidad y SEO. Si la imagen es decorativa, dejar vacío.",
      },
    },
    {
      name: "caption",
      type: "text",
      required: false,
      admin: {
        description: "Pie de foto opcional (visible solo en blog).",
      },
    },
  ],
};
