/**
 * La marca con la que se pinta UN documento (SDD-0255 · white-label documental).
 *
 * Un aliado revende el servicio de DTD bajo SU marca y atiende él a sus propios
 * clientes. Lo que le llega al cliente de un aliado no debe decir DTD Cargo.
 * ⚖️ No es cosmética: hay un caso legal vivo donde una nota de entrega con
 * membrete DoorTuDoor debilitó la defensa de "aliado independiente".
 *
 * ── POR QUÉ VIVE EN `lib/shared/` ───────────────────────────────────────────
 * Lo necesitan `app/portal/`, `app/p/[token]` y el futuro portal del aliado, y
 * la frontera del repo (ESLint, `no-restricted-imports`) les prohíbe importar
 * `@/lib/studio`, `@/lib/db` y `@supabase/*`.
 *
 * **Por eso este módulo NO busca nada: recibe la fila ya leída y devuelve el
 * contexto.** La lectura vive en `lib/studio/aliados/brand-resolve.ts`, que sí
 * puede tocar Supabase. Importar `@/lib/design-tokens` sí es legal: ese archivo
 * es constantes puras, sin un solo `import`.
 *
 * ── LA REGLA QUE NO SE ROMPE ────────────────────────────────────────────────
 * `resolveBrand(null)` devuelve DTD. Ése es el camino del 100% de los clientes
 * de hoy (445 de 445 con `aliado_id` NULL) y no se puede romper por agregar
 * aliados. Ningún campo se devuelve vacío: un hueco se cuela en el documento
 * como espacio en blanco o como DTD por defecto, y las dos cosas son el fallo.
 */

import { CONTACT, DTD } from "@/lib/design-tokens";

export type BrandKind = "dtd" | "aliado";

export type BrandContext = {
  /** Sirve para decidir ramas (tagline, pie legal) y para los tests. */
  kind: BrandKind;
  /** Nombre comercial visible. */
  name: string;
  /**
   * Nombre para la etiqueta y el mensaje al proveedor chino.
   * DTD trae el suyo; un aliado normalmente no, y entonces se compone
   * `${name} 国际货运`. NO se translitera el nombre a la brava.
   */
  nameCjk: string | null;
  /** Razón social del pie. Sólo DTD la tiene; un aliado, null. */
  legalName: string | null;
  /** Hex validado; basura o vacío cae al de DTD. */
  primary: string;
  /** Hex validado. */
  secondary: string;
  supportEmail: string;
  supportWhatsapp: string;
  /** null cuando el aliado no tiene web propia. */
  supportWebsite: string | null;
  /** `aliados.hide_dtd_brand`. Para DTD siempre false. */
  hideDtd: boolean;
};

/** La fila de `aliados` reducida a lo que la marca necesita. Sin tipos de Supabase. */
export type AliadoBrandRow = {
  trade_name: string;
  brand_name: string | null;
  brand_primary: string | null;
  brand_secondary: string | null;
  support_email: string | null;
  support_whatsapp: string | null;
  support_website: string | null;
  hide_dtd_brand: boolean;
};

/**
 * La marca de la casa. Es el fallback y el único camino que hoy corre en prod.
 *
 * ⚠️ `legalName` es `CONTACT.brandName`, NO `CONTACT.legalName`, y la distinción
 * se mantiene a propósito aunque hoy los dos valgan lo mismo.
 *
 * Por qué: hasta el 2026-08-19 `CONTACT.legalName` valía "DTD Cargo · DoorTuDoor
 * Services", y usarlo acá filtraba el sello heredado al pie del comprobante de
 * TODOS los clientes — el patrón exacto del caso Greaves, y ya activo sin
 * aliados de por medio. Ese string se limpió al retirar la marca vieja, así que
 * el síntoma concreto desapareció, pero el riesgo NO: `legalName` es el campo
 * que puede volver a cargarse con un sello, y este es el pie de un documento
 * que ve el cliente final. Se sigue leyendo `brandName`.
 *
 * La razón social real va sólo en el schema.org (`CONTACT.legal.legalName`),
 * nunca en texto visible.
 */
export const DTD_BRAND: BrandContext = {
  kind: "dtd",
  name: CONTACT.brandName,
  nameCjk: "DTD Cargo 国际货运",
  legalName: CONTACT.brandName,
  primary: DTD.wine,
  secondary: DTD.ink,
  supportEmail: CONTACT.emailGeneral,
  supportWhatsapp: CONTACT.ve.whatsapp,
  supportWebsite: CONTACT.web,
  hideDtd: false,
};

/**
 * `#RGB` o `#RRGGBB`, o el fallback. Las columnas de color son `text` sin CHECK
 * (migr 0362), así que lo que se cargue por la UI entra tal cual — y estos
 * valores terminan en un `style` inline.
 */
export function safeHex(raw: string | null | undefined, fallback: string): string {
  const v = (raw ?? "").trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v.toUpperCase() : fallback;
}

/**
 * PURA. `null` → la marca de DTD tal cual. Nunca lanza, nunca devuelve null,
 * nunca deja un campo vacío.
 */
export function resolveBrand(aliado: AliadoBrandRow | null | undefined): BrandContext {
  if (!aliado) return DTD_BRAND;

  const name = (aliado.brand_name ?? "").trim() || aliado.trade_name.trim() || DTD_BRAND.name;
  const website = (aliado.support_website ?? "").trim() || null;

  return {
    kind: "aliado",
    name,
    // Sin transliteración automática: en la etiqueta se compone `${name} 国际货运`.
    nameCjk: null,
    legalName: null,
    primary: safeHex(aliado.brand_primary, DTD_BRAND.primary),
    secondary: safeHex(aliado.brand_secondary, DTD_BRAND.secondary),
    supportEmail: (aliado.support_email ?? "").trim() || DTD_BRAND.supportEmail,
    supportWhatsapp: (aliado.support_whatsapp ?? "").trim() || DTD_BRAND.supportWhatsapp,
    supportWebsite: website,
    hideDtd: aliado.hide_dtd_brand,
  };
}

/**
 * El nombre en chino listo para imprimir. DTD trae el suyo; para un aliado se
 * compone con su nombre comercial + 国际货运 ("transporte internacional de carga").
 */
export function brandNameCjk(b: BrandContext): string {
  return b.nameCjk ?? `${b.name} 国际货运`;
}

/** Variables de marca que se inyectan en las plantillas de correo. */
export function brandMailVars(b: BrandContext): Record<string, string> {
  return {
    brand_name: b.name,
    brand_footer:
      b.kind === "dtd" ? "DTD Cargo · Con Confianza, de China a tu puerta." : b.name,
    support_email: b.supportEmail,
    support_whatsapp: b.supportWhatsapp,
    support_website: b.supportWebsite ?? "",
  };
}
