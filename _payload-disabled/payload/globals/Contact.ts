import type { GlobalConfig } from "payload";
import { revalidateGlobalAfterChange } from "../hooks/revalidate";

/**
 * Contact — Direcciones, teléfonos y emails por sede.
 * Fuente original: lib/design-tokens.ts (CONTACT).
 */
export const Contact: GlobalConfig = {
  slug: "contact",
  label: "Contacto",
  admin: {
    description:
      "Direcciones, teléfonos y emails de cada sede. Cambiá aquí cuando se mude la oficina o cambien los números.",
    group: "Configuración del sitio",
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [
      revalidateGlobalAfterChange(
        ["/", "/contacto", "/cotizar", "/servicios", "/track"],
        ["contact", "settings"]
      ),
    ],
  },
  fields: [
    {
      name: "legalName",
      type: "text",
      required: true,
      defaultValue: "DTD CARGO · Doortudoor Services",
      admin: {
        description: "Nombre legal mostrado en footer y facturas.",
      },
    },
    {
      name: "web",
      type: "text",
      required: true,
      defaultValue: "www.dtdcargo.com",
    },
    {
      name: "instagram",
      type: "group",
      fields: [
        { name: "handle", type: "text", defaultValue: "@doortudoor_" },
        { name: "url", type: "text", defaultValue: "https://instagram.com/doortudoor_" },
      ],
    },
    {
      name: "emailGeneral",
      type: "text",
      required: true,
      defaultValue: "info@dtdcargo.com",
      admin: { description: "Email general (mostrado en footer)." },
    },
    {
      name: "venezuela",
      type: "group",
      label: "Sede Venezuela",
      fields: [
        { name: "label", type: "text", required: true, defaultValue: "Venezuela" },
        { name: "city", type: "text", required: true },
        { name: "address", type: "text", required: true },
        { name: "addressFull", type: "textarea", required: true },
        { name: "phone", type: "text", admin: { description: "Formato display, ej: +58 241 414 7886" } },
        { name: "phoneRaw", type: "text", admin: { description: "Solo dígitos para tel: link, ej: +582414147886" } },
        { name: "whatsapp", type: "text", admin: { description: "Formato display" } },
        { name: "whatsappRaw", type: "text", admin: { description: "Solo dígitos para wa.me, ej: 584121668021" } },
        { name: "email", type: "text", required: true },
        { name: "hours", type: "text", admin: { description: "Ej: 'Lun a Vie · 8:00 – 17:00 (GMT-4)'" } },
      ],
    },
    {
      name: "china",
      type: "group",
      label: "Sede China",
      fields: [
        { name: "label", type: "text", required: true, defaultValue: "China" },
        { name: "city", type: "text", required: true },
        { name: "address", type: "text", required: true },
        { name: "addressFull", type: "textarea", required: true },
        { name: "phone", type: "text" },
        { name: "phoneRaw", type: "text" },
        { name: "whatsapp", type: "text" },
        { name: "whatsappRaw", type: "text" },
        { name: "email", type: "text", required: true },
        { name: "hours", type: "text" },
      ],
    },
  ],
};
