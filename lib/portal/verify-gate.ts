/**
 * Gate de verificación de identidad del Portal (SDD-0169).
 *
 * El Norte (`_norte/portal/app.jsx` · `LOCKED_VIEWS` + `PortalVerifyGate`) cierra
 * cuatro módulos hasta que el cliente completa su registro. El portal ya sabía
 * si el perfil estaba completo (`getProfileCompleteness`) pero solo lo usaba
 * para una píldora informativa en la topbar: nada empujaba a verificar. Este
 * módulo pone la regla en un solo lugar, sin tocar la base de datos.
 *
 * Toda la lógica es PURA (recibe el `ProfileCompleteness` ya resuelto) para que
 * el gate se pueda testear sin Supabase. El cierre real lo aplica cada página
 * en el servidor — el candado del nav es señalización, no seguridad.
 */

/** Los cuatro módulos que el Norte cierra tras la verificación. */
export type LockedModule = "documentos" | "referidos" | "academia" | "soporte";

/**
 * Orden del Norte (`LOCKED_VIEWS`). Cambiar esta lista es el único punto para
 * abrir o cerrar un módulo.
 *
 * NOTA (founder): "soporte" queda cerrado por fidelidad al Norte, pero la
 * pantalla del gate SIEMPRE ofrece WhatsApp y teléfono directos — un cliente
 * con un problema nunca queda sin canal. Si algún día se decide que Soporte
 * debe estar siempre abierto, se saca de esta lista y no hay que tocar nada más.
 */
export const LOCKED_MODULES: readonly LockedModule[] = [
  "documentos",
  "referidos",
  "academia",
  "soporte",
] as const;

/** Etiqueta visible de cada módulo (la que ve el cliente en el nav). */
export const MODULE_LABELS: Record<LockedModule, string> = {
  documentos: "Documentos",
  referidos: "Referidos",
  academia: "Academia",
  soporte: "Soporte",
};

/**
 * Copy por módulo del Norte: qué se pierde el cliente mientras no verifica.
 * Castellano venezolano, tuteo (regla del founder).
 */
export const MODULE_GATE_COPY: Record<LockedModule, string> = {
  documentos:
    "Aquí ves y descargas los documentos de tus embarques: BL, packing list, facturas comerciales y POD. Quedan disponibles 7 años en archivo.",
  referidos:
    "Gana recompensas invitando a otros importadores con tu código de referido.",
  academia:
    "Cursos para aprender a importar de China sin perder plata: proveedores, medidas, aduana y costos reales.",
  soporte:
    "Abre casos y chatea directo con tu asesor DTD, con tu historial de envíos a la vista.",
};

/** Tooltip del candado en la barra lateral (Norte). */
export const LOCK_TOOLTIP =
  "Se activa al completar tu registro (foto de cédula o RIF)";

/** Lo que el gate necesita saber del perfil. Espeja `ProfileCompleteness`. */
export type VerifyProfile = {
  hasPhoto: boolean;
  hasAddress: boolean;
  complete: boolean;
};

/** Un paso del progreso de registro que pinta el gate (3 chips del Norte). */
export type VerifyStep = {
  label: string;
  done: boolean;
};

/** ¿Este módulo está cerrado para este perfil? */
export function isModuleLocked(
  module: LockedModule,
  profile: VerifyProfile | null,
): boolean {
  // Sin dato de perfil (la lectura falló) abrimos: un error de infraestructura
  // no puede dejar al cliente fuera de su propio portal. Mismo criterio
  // fail-open que ya usa la píldora de la topbar en `(app)/layout.tsx`.
  if (!profile) return false;
  if (!LOCKED_MODULES.includes(module)) return false;
  return !profile.complete;
}

/**
 * Los 3 chips de progreso del Norte. "Datos básicos" siempre está hecho: sin
 * ellos no existiría la cuenta con la que el cliente entró.
 */
export function buildVerifySteps(profile: VerifyProfile): VerifyStep[] {
  return [
    { label: "Datos básicos", done: true },
    { label: "Dirección de entrega", done: profile.hasAddress },
    { label: "Verificación de identidad", done: profile.hasPhoto },
  ];
}

/**
 * Frase del pie: los OTROS módulos que se abren con el mismo paso. Se arma con
 * coma y "y" final para que se lea en español natural.
 */
export function otherModulesSentence(module: LockedModule): string {
  const others = LOCKED_MODULES.filter((m) => m !== module).map(
    (m) => MODULE_LABELS[m],
  );
  if (others.length === 0) return "";
  if (others.length === 1) return others[0];
  return `${others.slice(0, -1).join(", ")} y ${others[others.length - 1]}`;
}

/**
 * Qué le falta al cliente, en una frase. Alimenta el subtítulo del gate para no
 * mandarlo a adivinar a `/portal/perfil`.
 */
export function missingSentence(profile: VerifyProfile): string {
  const missing: string[] = [];
  if (!profile.hasPhoto) missing.push("la foto de tu cédula o RIF");
  if (!profile.hasAddress) missing.push("tu dirección de entrega");
  if (missing.length === 0) return "";
  return missing.length === 2 ? `${missing[0]} y ${missing[1]}` : missing[0];
}
