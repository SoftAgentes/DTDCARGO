import type { GlobalConfig } from "payload";
import { revalidateGlobalAfterChange } from "../hooks/revalidate";

/**
 * SiteSettings — Configuración editorial del sitio.
 * Fuente original: lib/design-tokens.ts (HERO, STATS, STEPS, TIMELINE,
 * YIWU_ADVANTAGES, PHILOSOPHY, ORIGINS, DESTINATIONS, SERVICES_MATRIX).
 */
export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "Configuración general",
  admin: {
    description:
      "Hero, stats, filosofía, pasos, timeline, ventajas. Todo el copy editorial del home.",
    group: "Configuración del sitio",
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [
      revalidateGlobalAfterChange(
        ["/", "/servicios"],
        ["settings"]
      ),
    ],
  },
  fields: [
    {
      name: "general",
      type: "group",
      label: "General",
      fields: [
        {
          name: "whatsappNumber",
          type: "text",
          admin: {
            description:
              "WhatsApp Business público, formato internacional sin +. Ej: 584121668021. Override del env NEXT_PUBLIC_WHATSAPP_NUMBER.",
          },
        },
        {
          name: "whatsappDefaultMessage",
          type: "text",
          admin: {
            description:
              "Texto que se precarga al abrir wa.me. Ej: 'Hola, quisiera cotizar...'",
          },
        },
        {
          name: "contactEmail",
          type: "text",
          admin: {
            description: "Email principal mostrado en CTAs. Override del env.",
          },
        },
        {
          name: "siteUrl",
          type: "text",
          admin: {
            description: "Dominio canónico, sin barra final. Ej: https://dtdcargo.com",
          },
        },
      ],
    },
    {
      name: "hero",
      type: "group",
      label: "Hero del home",
      fields: [
        { name: "eyebrow", type: "text", required: true },
        {
          name: "headline",
          type: "array",
          required: true,
          minRows: 1,
          maxRows: 4,
          admin: {
            description:
              "Slogan principal dividido en líneas. Cada línea puede tener color de acento.",
          },
          fields: [
            { name: "text", type: "text", required: true },
            {
              name: "accent",
              type: "select",
              defaultValue: "ink",
              options: [
                { label: "Ink (navy default)", value: "ink" },
                { label: "Wine (vino tinto)", value: "wine" },
                { label: "Grey", value: "grey" },
              ],
            },
          ],
        },
        { name: "subtitle", type: "textarea", required: true },
        {
          name: "search",
          type: "group",
          label: "Cotizador inline",
          fields: [
            { name: "originPlaceholder", type: "text" },
            { name: "originDefault", type: "text" },
            { name: "destPlaceholder", type: "text" },
            { name: "destDefault", type: "text" },
            { name: "cta", type: "text" },
          ],
        },
        {
          name: "trustMarks",
          type: "array",
          maxRows: 6,
          fields: [{ name: "text", type: "text", required: true }],
        },
        {
          name: "badge",
          type: "group",
          fields: [
            { name: "main", type: "text" },
            { name: "sub", type: "text" },
          ],
        },
      ],
    },
    {
      name: "stats",
      type: "array",
      label: "Stats (banda navy)",
      minRows: 0,
      maxRows: 6,
      fields: [
        { name: "num", type: "text", required: true },
        { name: "suffix", type: "text" },
        { name: "label", type: "text", required: true },
      ],
    },
    {
      name: "steps",
      type: "array",
      label: "Cómo trabajamos (4 pasos)",
      maxRows: 6,
      fields: [
        { name: "n", type: "text", required: true, admin: { description: "Numero formateado, ej: '01'" } },
        { name: "title", type: "text", required: true },
        { name: "copy", type: "textarea", required: true },
      ],
    },
    {
      name: "timeline",
      type: "array",
      label: "Historia (timeline)",
      fields: [
        { name: "year", type: "text", required: true },
        { name: "title", type: "text", required: true },
        { name: "copy", type: "textarea", required: true },
      ],
    },
    {
      name: "yiwuAdvantages",
      type: "array",
      label: "Ventajas de Yiwu",
      fields: [
        { name: "title", type: "text", required: true },
        { name: "copy", type: "textarea", required: true },
        { name: "metric", type: "text" },
        { name: "metricLabel", type: "text" },
      ],
    },
    {
      name: "philosophy",
      type: "group",
      label: "Filosofía",
      fields: [
        { name: "headline", type: "textarea", required: true },
        { name: "body", type: "textarea", required: true },
        { name: "pull", type: "textarea" },
        { name: "cta", type: "text" },
      ],
    },
    {
      name: "origins",
      type: "array",
      label: "Cotizador · orígenes sugeridos",
      fields: [
        { name: "code", type: "text", required: true },
        { name: "label", type: "text", required: true },
        { name: "cjk", type: "text", admin: { description: "Caracteres chinos, ej: 义乌" } },
      ],
    },
    {
      name: "destinations",
      type: "array",
      label: "Cotizador · destinos sugeridos",
      fields: [
        { name: "code", type: "text", required: true },
        { name: "label", type: "text", required: true },
      ],
    },
    {
      name: "servicesMatrix",
      type: "array",
      label: "Matriz de servicios CN/VE",
      admin: {
        description:
          "Tabla cruzada de responsabilidad por sede (usada en /servicios).",
      },
      fields: [
        { name: "service", type: "text", required: true },
        { name: "cn", type: "text", required: true },
        { name: "ve", type: "text", required: true },
      ],
    },
    {
      name: "promoBanner",
      type: "group",
      label: "Banner promocional",
      admin: {
        description:
          "Banner global que se muestra arriba del nav cuando está activo.",
      },
      fields: [
        { name: "enabled", type: "checkbox", defaultValue: false },
        { name: "text", type: "text" },
        { name: "href", type: "text" },
        {
          name: "tone",
          type: "select",
          defaultValue: "info",
          options: [
            { label: "Informativo (navy)", value: "info" },
            { label: "Promo (wine)", value: "promo" },
            { label: "Atención (warning)", value: "warning" },
          ],
        },
      ],
    },
    {
      name: "tracking",
      type: "group",
      label: "Tracking / Analytics",
      admin: {
        description:
          "Códigos de tracking. Cambiar acá evita re-deploy del sitio.",
      },
      fields: [
        { name: "gaId", type: "text", admin: { description: "Google Analytics 4 measurement ID (G-XXXX)" } },
        { name: "metaPixelId", type: "text", admin: { description: "Meta Pixel ID" } },
      ],
    },
    {
      name: "seo",
      type: "group",
      label: "SEO default",
      fields: [
        { name: "defaultTitle", type: "text" },
        { name: "defaultDescription", type: "textarea" },
        { name: "defaultOgImage", type: "upload", relationTo: "media" },
        {
          name: "keywords",
          type: "array",
          fields: [{ name: "keyword", type: "text", required: true }],
        },
      ],
    },
  ],
};
