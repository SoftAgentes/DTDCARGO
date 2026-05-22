import type { CollectionConfig } from "payload";
import {
  revalidateCollectionAfterChange,
  revalidateCollectionAfterDelete,
} from "../hooks/revalidate";

/**
 * Services — los 16 servicios de DTD·CARGO agrupados por sede.
 * Fuente original: lib/design-tokens.ts (SERVICES_CN, SERVICES_VE).
 */
export const Services: CollectionConfig = {
  slug: "services",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "location", "featured", "order", "published"],
    description:
      "Servicios que aparecen en /servicios y en el home. Cada uno tiene una sede operativa (CN o VE).",
    listSearchableFields: ["title", "slug", "copy"],
  },
  access: {
    read: ({ req: { user } }) =>
      user
        ? true
        : {
            published: { equals: true },
          },
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  hooks: {
    afterChange: [
      revalidateCollectionAfterChange(["/", "/servicios"], ["services"]),
    ],
    afterDelete: [
      revalidateCollectionAfterDelete(["/", "/servicios"], ["services"]),
    ],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      admin: {
        description: "Nombre del servicio. Ej: 'Consolidación en bodega Yiwu'.",
      },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          "URL-safe slug. Si lo dejás vacío, se autogenera del título.",
        position: "sidebar",
      },
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
      name: "location",
      type: "select",
      required: true,
      defaultValue: "ve",
      options: [
        { label: "China (Yiwu)", value: "cn" },
        { label: "Venezuela (Valencia)", value: "ve" },
        { label: "Ambas sedes", value: "both" },
      ],
      admin: {
        description: "Sede operativa que ejecuta este servicio.",
      },
    },
    {
      name: "copy",
      type: "textarea",
      required: true,
      admin: {
        description: "Descripción corta (1-2 oraciones) que aparece en la card.",
      },
    },
    {
      name: "benefit",
      type: "text",
      required: true,
      admin: {
        description:
          "Frase de beneficio para el cliente. Ej: 'Cero sorpresas a destino'.",
      },
    },
    {
      name: "icon",
      type: "text",
      required: true,
      admin: {
        description:
          "Nombre del icono. Valores válidos: Container, Warehouse, Check, Shield, Cart, Payment, Stamp, Box, Passport, Doc, Truck.",
      },
    },
    {
      name: "details",
      type: "richText",
      admin: {
        description:
          "Descripción larga (futura página de detalle por servicio). Opcional en Fase 1.",
      },
    },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Mostrar destacado en el home y en grids.",
      },
    },
    {
      name: "order",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        description: "Orden de aparición. Menor = primero.",
      },
    },
    {
      name: "published",
      type: "checkbox",
      defaultValue: true,
      admin: {
        position: "sidebar",
        description:
          "Desmarcá para ocultar del público sin borrar. Útil para servicios estacionales.",
      },
    },
    {
      name: "seo",
      type: "group",
      admin: {
        description: "SEO específico de este servicio (para Fase 2).",
      },
      fields: [
        { name: "metaTitle", type: "text" },
        { name: "metaDescription", type: "textarea" },
        { name: "ogImage", type: "upload", relationTo: "media" },
      ],
    },
  ],
};
