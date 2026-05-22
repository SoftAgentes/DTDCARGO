import type { CollectionConfig } from "payload";
import {
  revalidateCollectionAfterChange,
  revalidateCollectionAfterDelete,
} from "../hooks/revalidate";

/**
 * Pages — Páginas dinámicas con URL propia (Fase 2).
 *
 * Permite crear páginas como /aduana, /almacenamiento, /faq sin
 * tocar código. Las rutas públicas (app/[slug]/page.tsx con catch-all)
 * se activan en Fase 2.
 */
export const Pages: CollectionConfig = {
  slug: "pages",
  labels: {
    singular: "Página",
    plural: "Páginas dinámicas",
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "_status"],
    description:
      "Páginas con URL propia. Las rutas públicas se activan en Fase 2.",
  },
  versions: {
    drafts: {
      autosave: { interval: 800 },
    },
  },
  access: {
    read: ({ req: { user } }) =>
      user
        ? true
        : {
            _status: { equals: "published" },
          },
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  hooks: {
    afterChange: [
      revalidateCollectionAfterChange(["/"], ["pages"]),
    ],
    afterDelete: [
      revalidateCollectionAfterDelete(["/"], ["pages"]),
    ],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        position: "sidebar",
        description: "URL relativa. Ej: 'aduana' → dtdcargo.com/aduana",
      },
    },
    {
      name: "body",
      type: "richText",
      required: true,
    },
    {
      name: "seo",
      type: "group",
      fields: [
        { name: "metaTitle", type: "text" },
        { name: "metaDescription", type: "textarea" },
        { name: "ogImage", type: "upload", relationTo: "media" },
      ],
    },
  ],
};
