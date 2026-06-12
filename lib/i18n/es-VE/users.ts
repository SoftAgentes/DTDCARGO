/**
 * lib/i18n/es-VE/users.ts · Strings del módulo Usuarios & Roles (SDD-0024)
 * + flujo de invitación (InviteUserDrawer).
 */

export const users = {
  // ── Drawer header ────────────────────────────────────────
  "users.invite.title": "Invitar usuario",
  "users.invite.subtitle":
    "Vamos a generar un link de invitación que expira en 7 días",
  "users.invite.submit_idle": "Generar link",
  "users.invite.submit_loading": "Generando…",

  // ── Office picker ────────────────────────────────────────
  "users.office.label": "Oficina",
  "users.office.aria": "Oficina del invitado",
  "users.office.hint":
    "Determina el idioma del Studio, formato de fecha y moneda default. El invitado lo verá apenas acepte la invitación.",

  // ── Fields ───────────────────────────────────────────────
  "users.field.first_name": "Nombre",
  "users.field.first_name_ph": "María",
  "users.field.last_name": "Apellido",
  "users.field.last_name_ph": "Pérez",
  "users.field.email": "Email",
  "users.field.email_ph": "maria@dtdcargo.com",
  "users.field.role": "Rol",
  "users.field.team": "Equipo",

  // ── Roles ────────────────────────────────────────────────
  "users.role.admin": "Admin",
  "users.role.commercial": "Comercial",
  "users.role.operations": "Operaciones",
  "users.role.accounting": "Contabilidad",
  "users.role.warehouse": "Almacenista",
  "users.role.support": "Soporte",

  // ── Teams ────────────────────────────────────────────────
  "users.team.direccion": "Dirección",
  "users.team.ventas": "Ventas",
  "users.team.op_cn": "Op. CN",
  "users.team.op_ve": "Op. VE",
  "users.team.finanzas": "Finanzas",
  "users.team.cx": "CX",

  // ── Scope / almacenes ────────────────────────────────────
  "users.scope.assigned_label": "Almacén/es asignado/s",
  "users.scope.explainer":
    "Este usuario solo verá recepciones y embarques del/los hub/s seleccionados.",
  "users.scope.explainer_bold": "No podrá cambiar de almacén ni ver otros hubs.",
  "users.scope.cn_group": "🇨🇳 Almacenes China",
  "users.scope.ve_group": "🇻🇪 Almacenes Venezuela",
  "users.scope.permission_label": "Permiso dentro del almacén",
  "users.scope.badge_empty": "sin definir",
  "users.scope.badge_count": "{count} hub",
  "users.scope.badge_count_plural": "{count} hubs",

  // ── Permission options ───────────────────────────────────
  "users.permission.read": "Solo lectura",
  "users.permission.read_desc": "Ver recepciones · no editar",
  "users.permission.write": "Lectura + escritura",
  "users.permission.write_desc": "Crear y editar recepciones del hub",

  // ── 2FA ──────────────────────────────────────────────────
  "users.twofa.label": "Sugerir 2FA al primer login",
  "users.twofa.optional": "(opcional)",
  "users.twofa.desc":
    "El user verá un prompt para activar 2FA, pero podrá saltarlo. Nunca obligamos a configurar 2FA en testing.",

  // ── Summary card ─────────────────────────────────────────
  "users.summary.heading": "Este usuario podrá:",
  "users.summary.office": "Oficina:",
  "users.summary.role": "Rol:",
  "users.summary.team": "Equipo:",
  "users.summary.see_only": "Ver solo:",
  "users.summary.perm_write": "lectura + escritura",
  "users.summary.perm_read": "solo lectura",
  "users.summary.missing_warehouse": "⚠ Falta asignar al menos un almacén",
  "users.summary.global_access": "✓ Acceso global · sin restricción por almacén",
  "users.summary.twofa_suggested": "✓ Se le sugerirá activar 2FA (opcional)",

  // ── Disclaimer Fase C ────────────────────────────────────
  "users.disclaimer":
    "V1 persiste solo email + rol + oficina. Nombre, equipo, scope, permiso y 2FA viven en UI hasta que llegue Fase B del schema. Cuando el user acepte la invitación cargará su nombre.",

  // ── Success view ─────────────────────────────────────────
  "users.success.title": "Invitación creada",
  "users.success.body":
    "Copia el link y mándaselo a tu invitado por WhatsApp, email o como prefieras. Expira en 7 días. (Cuando Resend esté listo, el sistema lo manda automático.)",
  "users.success.link_label": "Link de invitación",
  "users.success.copy": "Copiar",
  "users.success.copied": "✓ Copiado",
  "users.success.copy_error": "Error",
  "users.success.close": "Cerrar",
} as const satisfies Record<string, string>;

export type UsersDict = Record<keyof typeof users, string>;
