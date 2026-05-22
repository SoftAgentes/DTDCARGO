import type { CollectionConfig } from "payload";
import {
  revalidateCollectionAfterChange,
  revalidateCollectionAfterDelete,
} from "../hooks/revalidate";

/**
 * Posts — Blog de noticias (Fase 2).
 *
 * El schema vive desde el día 1 para que se pueda empezar a redactar.
 * Las rutas públicas (/blog, /blog/[slug]) se agregan más adelante.
 */
export const Posts: CollectionConfig = {
  slug: "posts",
  labels: {
    singular: "Noticia",
    plural: "Blog · Noticias",
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "publishedAt", "author", "_status"],
    description:
      "Blog corporativo. Las rutas públicas /blog se activan en Fase 2.",
    listSearchableFields: ["title", "slug", "excerpt"],
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
      revalidateCollectionAfterChange(["/blog"], ["posts"]),
    ],
    afterDelete: [
      revalidateCollectionAfterDelete(["/blog"], ["posts"]),
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
      admin: { position: "sidebar" },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (value) return value;
            const src = (data?.title as string | undefined) ?? "";
            return src
              .toLowerCase()
              .normalize("NFD")
              .replace(/[̀-ͯ]/g, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "");
          },
        ],
      },
    },
    {
      name: "excerpt",
      type: "textarea",
      admin: { description: "Resumen corto para la lista de noticias y meta description." },
    },
    {
      name: "cover",
      type: "upload",
      relationTo: "media",
      admin: { description: "Imagen de portada (también se usa como OG image)." },
    },
    {
      name: "body",
      type: "richText",
      required: true,
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      admin: { position: "sidebar" },
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "tags",
      type: "array",
      fields: [{ name: "tag", type: "text" }],
      admin: { position: "sidebar" },
    },
  ],
};
