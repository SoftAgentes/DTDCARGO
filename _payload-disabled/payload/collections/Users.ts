import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "role", "updatedAt"],
    description: "Usuarios del admin. Solo los 'admin' pueden crear/eliminar otros usuarios.",
  },
  auth: {
    tokenExpiration: 7 * 24 * 60 * 60,
    cookies: {
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
  access: {
    create: ({ req: { user } }) => user?.role === "admin",
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user }, id }) =>
      user?.role === "admin" || String(user?.id) === String(id),
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: false,
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      options: [
        { label: "Admin (control total)", value: "admin" },
        { label: "Editor (solo contenido)", value: "editor" },
      ],
      admin: {
        description: "Admin gestiona usuarios y configuración. Editor edita contenido.",
      },
    },
  ],
};
