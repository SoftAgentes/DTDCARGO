import type { GlobalConfig } from "payload";
import { revalidateGlobalAfterChange } from "../hooks/revalidate";

/**
 * Navigation — items del menú superior y del footer.
 * Fuente original: components/Nav.tsx (hardcoded `links` array).
 */
export const Navigation: GlobalConfig = {
  slug: "navigation",
  label: "Navegación",
  admin: {
    description:
      "Items del menú superior. El orden de aparición es el orden en que los pongas en la lista.",
    group: "Configuración del sitio",
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [
      revalidateGlobalAfterChange(["/"], ["navigation"]),
    ],
  },
  fields: [
    {
      name: "primary",
      type: "array",
      label: "Menú principal",
      minRows: 1,
      maxRows: 10,
      fields: [
        { name: "label", type: "text", required: true },
        {
          name: "href",
          type: "text",
          required: true,
          admin: {
            description:
              "Path relativo (ej: /servicios) o ancla (ej: /#how). Para externos usar URL completa y marcar 'externo'.",
          },
        },
        {
          name: "hasCaret",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Mostrar flecha ▾ (sugiere submenú futuro)." },
        },
        {
          name: "external",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Abrir en pestaña nueva (target='_blank')." },
        },
      ],
    },
    {
      name: "footer",
      type: "array",
      label: "Links del footer",
      admin: {
        description: "Opcional. Si está vacío, el footer usa solo info de Contact.",
      },
      fields: [
        { name: "label", type: "text", required: true },
        { name: "href", type: "text", required: true },
        { name: "external", type: "checkbox", defaultValue: false },
      ],
    },
  ],
};
