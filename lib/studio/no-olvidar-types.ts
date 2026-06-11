/**
 * Types, enums, validators y helpers de label/badge para el módulo
 * No-Olvidar interno DTD-CARGO (SDD-0025 Fase 1). Match con migración
 * 0017_no_olvidar.sql.
 *
 * NO incluye crypto types (esos viven en lib/studio/no-olvidar/crypto.ts
 * en Fase 2). Acá solo lo que es seguro mostrar al cliente: shapes de
 * entidades, enums, formatters.
 *
 * Convenciones del proyecto:
 *   - Sin Zod — validate*Input() propios.
 *   - LABELS en castellano-VE.
 *   - badgeTone helpers retornan los 6 tonos oficiales del sistema.
 */

// ─── Enums ───────────────────────────────────────────────────

export type NoOlvidarCategory = "login" | "note" | "card" | "totp";
export const NO_OLVIDAR_CATEGORIES: NoOlvidarCategory[] = ["login", "note", "card", "totp"];

export type NoOlvidarAuditAction =
  | "view"
  | "copy"
  | "edit"
  | "create"
  | "delete"
  | "unlock"
  | "recovery_requested"
  | "recovery_approved"
  | "recovery_executed"
  | "kek_rotated";

export const NO_OLVIDAR_AUDIT_ACTIONS: NoOlvidarAuditAction[] = [
  "view",
  "copy",
  "edit",
  "create",
  "delete",
  "unlock",
  "recovery_requested",
  "recovery_approved",
  "recovery_executed",
  "kek_rotated",
];

export type NoOlvidarRecoveryStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "completed";

export const NO_OLVIDAR_RECOVERY_STATUSES: NoOlvidarRecoveryStatus[] = [
  "pending",
  "approved",
  "rejected",
  "expired",
  "completed",
];

export type NoOlvidarUserRole = "member" | "admin";
export const NO_OLVIDAR_USER_ROLES: NoOlvidarUserRole[] = ["member", "admin"];

export type NoOlvidarKekStatus = "active" | "legacy" | "revoked";
export const NO_OLVIDAR_KEK_STATUSES: NoOlvidarKekStatus[] = ["active", "legacy", "revoked"];

export type NoOlvidarAlertSeverity = "info" | "warning" | "critical";

// ─── Entity types (match schema 0017) ────────────────────────

/**
 * NoOlvidarItem · row de no_olvidar_items. Los campos `ciphertext`, `nonce`,
 * `dek_encrypted`, `dek_nonce` llegan como Uint8Array desde Supabase
 * (bytea → base64 string en la wire, hay que castear). En el cliente
 * NUNCA exponer al render, solo pasar a crypto.ts.
 */
export interface NoOlvidarItem {
  id: string;
  user_id: string;
  name: string;
  category: NoOlvidarCategory;
  url: string | null;
  username: string | null;
  ciphertext: string;            // bytea como base64 string
  nonce: string;                 // bytea como base64 string
  dek_encrypted: string;
  dek_nonce: string;
  key_version: number;
  notes_preview: string | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * NoOlvidarItem con su plaintext desencriptado. NUNCA persistir esta shape
 * server-side. Vive solo en memoria del request/component que la
 * desencriptó.
 */
export interface DecryptedNoOlvidarItem extends NoOlvidarItem {
  plaintext: NoOlvidarItemPlaintext;
}

/**
 * Shape del payload desencriptado. Varía por categoría — cada cat tiene
 * sus campos. login = {password, totp?, notes}. card = {number, cvc, expiry, holder, notes}. note = {body}. totp = {secret, label}.
 */
export type NoOlvidarItemPlaintext =
  | { kind: "login"; password: string; totp?: string; notes?: string }
  | { kind: "card"; number: string; cvc: string; expiry: string; holder: string; notes?: string }
  | { kind: "note"; body: string }
  | { kind: "totp"; secret: string; label: string };

/**
 * NoOlvidarUserKeys · 1 row por user. NUNCA enviar al cliente los campos
 * bytea (verifier, salts, ciphertexts, hash). El cliente solo debería
 * ver flags + role + last_unlock_at + setup_completed.
 */
export interface NoOlvidarUserKeys {
  user_id: string;
  has_master_password: boolean;
  master_password_verifier: string | null;
  master_password_salt: string | null;
  public_key: string | null;
  private_key_ciphertext: string | null;
  private_key_nonce: string | null;
  recovery_kit_hash: string | null;
  recovery_kit_salt: string | null;
  totp_secret_ciphertext: string;
  totp_secret_nonce: string;
  totp_enabled: boolean;
  setup_completed: boolean;
  role: NoOlvidarUserRole;
  last_unlock_at: string | null;
  failed_unlock_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Shape segura para mandar al cliente (sin bytea sensibles). El runtime
 * server-side debería retornar este shape en lugar de NoOlvidarUserKeys
 * completo cuando le pase data al browser.
 */
export interface NoOlvidarUserKeysPublic {
  user_id: string;
  has_master_password: boolean;
  totp_enabled: boolean;
  setup_completed: boolean;
  role: NoOlvidarUserRole;
  last_unlock_at: string | null;
  failed_unlock_attempts: number;
  locked_until: string | null;
}

export interface NoOlvidarAccessLog {
  id: string;
  user_id: string;
  item_id: string | null;
  action: NoOlvidarAuditAction;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NoOlvidarRecoveryApproval {
  approver_id: string;
  approved_at: string;
  ip?: string;
}

export interface NoOlvidarRecoveryRequest {
  id: string;
  requester_user_id: string;
  reason: string;
  status: NoOlvidarRecoveryStatus;
  approvals: NoOlvidarRecoveryApproval[];
  approvals_required: number;
  new_master_password_verifier: string | null;
  new_master_password_salt: string | null;
  expires_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoOlvidarKekVersion {
  version: number;
  kek_secret_name: string;
  status: NoOlvidarKekStatus;
  activated_at: string;
  deprecated_at: string | null;
  created_by: string | null;
  notes: string | null;
}

export interface NoOlvidarConfig {
  id: 1;
  recovery_approvals_required: number;
  session_timeout_minutes: number;
  failed_attempts_lockout: number;
  lockout_minutes: number;
  require_2fa: boolean;
  clipboard_clear_seconds: number;
  reveal_auto_hide_seconds: number;
  hold_to_reveal: boolean;
  blur_on_window_blur: boolean;
  forensic_watermark: boolean;
  block_copy_event: boolean;
  char_by_char_reveal: boolean;
  updated_at: string;
  updated_by: string | null;
}

// ─── KPIs (computed) ─────────────────────────────────────────

export interface NoOlvidarKpis {
  totalItems: number;
  itemsLast30d: number;
  recoveryPending: number;
  alerts24h: number;
}

// ─── Inputs + Action states ──────────────────────────────────

export interface CreateItemInput {
  name: string;
  category: NoOlvidarCategory;
  url?: string;
  username?: string;
  notes_preview?: string;
  favorite?: boolean;
  /** Plaintext que el cliente cifra antes de mandar al server. Server
   *  NUNCA recibe plaintext directo — solo ciphertext + nonces. */
  ciphertext: string;
  nonce: string;
  dek_encrypted: string;
  dek_nonce: string;
  key_version: number;
}

export interface UpdateItemInput {
  id: string;
  name?: string;
  category?: NoOlvidarCategory;
  url?: string;
  username?: string;
  notes_preview?: string;
  favorite?: boolean;
  /** Si se cambia el payload, viene re-cifrado entero. */
  ciphertext?: string;
  nonce?: string;
  dek_encrypted?: string;
  dek_nonce?: string;
  key_version?: number;
}

export interface MasterPasswordInput {
  password: string;
}

export interface RecoveryRequestInput {
  reason: string;
}

export type ActionFieldErrors = Partial<Record<string, string>>;

export interface NoOlvidarActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: ActionFieldErrors;
  itemId?: string;
  recoveryId?: string;
}

// ─── Validators (sin Zod) ────────────────────────────────────

const MIN_NAME = 2;
const MAX_NAME = 80;
const MIN_MASTER_PASSWORD = 12;
const MAX_REASON = 500;

export function validateCreateItemInput(
  partial: Partial<CreateItemInput>,
): { input?: CreateItemInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};

  if (!partial.name || partial.name.trim().length < MIN_NAME) {
    fieldErrors.name = `Nombre requerido (min ${MIN_NAME} caracteres)`;
  } else if (partial.name.length > MAX_NAME) {
    fieldErrors.name = `Nombre demasiado largo (max ${MAX_NAME})`;
  }
  if (!partial.category || !NO_OLVIDAR_CATEGORIES.includes(partial.category as NoOlvidarCategory)) {
    fieldErrors.category = "Categoría inválida";
  }
  if (!partial.ciphertext) fieldErrors.ciphertext = "Falta ciphertext (¿el cliente cifró bien?)";
  if (!partial.nonce) fieldErrors.nonce = "Falta nonce";
  if (!partial.dek_encrypted) fieldErrors.dek_encrypted = "Falta DEK envuelto";
  if (!partial.dek_nonce) fieldErrors.dek_nonce = "Falta DEK nonce";
  if (typeof partial.key_version !== "number" || partial.key_version < 1) {
    fieldErrors.key_version = "key_version inválida";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    input: {
      name: partial.name!.trim(),
      category: partial.category as NoOlvidarCategory,
      url: partial.url?.trim() || undefined,
      username: partial.username?.trim() || undefined,
      notes_preview: partial.notes_preview?.slice(0, 60) || undefined,
      favorite: partial.favorite ?? false,
      ciphertext: partial.ciphertext!,
      nonce: partial.nonce!,
      dek_encrypted: partial.dek_encrypted!,
      dek_nonce: partial.dek_nonce!,
      key_version: partial.key_version!,
    },
  };
}

export function validateUpdateItemInput(
  partial: Partial<UpdateItemInput>,
): { input?: UpdateItemInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};
  if (!partial.id) fieldErrors.id = "Falta id del item";
  if (partial.name !== undefined) {
    if (partial.name.trim().length < MIN_NAME) {
      fieldErrors.name = `Nombre min ${MIN_NAME} caracteres`;
    } else if (partial.name.length > MAX_NAME) {
      fieldErrors.name = `Nombre max ${MAX_NAME}`;
    }
  }
  if (
    partial.category !== undefined &&
    !NO_OLVIDAR_CATEGORIES.includes(partial.category as NoOlvidarCategory)
  ) {
    fieldErrors.category = "Categoría inválida";
  }
  // Re-encrypt all-or-none: si alguno de los 4 cifrados viene, todos deben venir
  const hasCipher = partial.ciphertext || partial.nonce || partial.dek_encrypted || partial.dek_nonce;
  const allCipher = partial.ciphertext && partial.nonce && partial.dek_encrypted && partial.dek_nonce;
  if (hasCipher && !allCipher) {
    fieldErrors.ciphertext =
      "Si re-cifras, manda los 4 campos (ciphertext+nonce+dek_encrypted+dek_nonce) juntos";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { input: partial as UpdateItemInput };
}

export function validateMasterPasswordInput(
  partial: Partial<MasterPasswordInput>,
): { input?: MasterPasswordInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};
  const pw = partial.password ?? "";
  if (pw.length < MIN_MASTER_PASSWORD) {
    fieldErrors.password = `Mínimo ${MIN_MASTER_PASSWORD} caracteres`;
  }
  // Complejidad razonable: al menos 3 de 4 (mayúscula, minúscula, número, símbolo)
  if (pw.length >= MIN_MASTER_PASSWORD) {
    const classes = [
      /[a-z]/.test(pw),
      /[A-Z]/.test(pw),
      /\d/.test(pw),
      /[^a-zA-Z0-9]/.test(pw),
    ].filter(Boolean).length;
    if (classes < 3) {
      fieldErrors.password =
        "Combiná al menos 3 de: mayúsculas, minúsculas, números, símbolos.";
    }
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { input: { password: pw } };
}

export function validateRecoveryRequestInput(
  partial: Partial<RecoveryRequestInput>,
): { input?: RecoveryRequestInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};
  const reason = (partial.reason ?? "").trim();
  if (reason.length < 20) {
    fieldErrors.reason =
      "Explicá el motivo del recovery con al menos 20 caracteres (los admins necesitan contexto para aprobar).";
  } else if (reason.length > MAX_REASON) {
    fieldErrors.reason = `Máximo ${MAX_REASON} caracteres`;
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { input: { reason } };
}

// ─── Label helpers (castellano-VE) ───────────────────────────

export const CATEGORY_LABELS: Record<NoOlvidarCategory, string> = {
  login: "Login",
  note: "Nota segura",
  card: "Tarjeta",
  totp: "Código 2FA",
};

export function categoryLabel(c: NoOlvidarCategory): string {
  return CATEGORY_LABELS[c];
}

/**
 * Mapper de categoría a nombre de icono del set del Studio (icons.tsx).
 * Si el icono no existe se usa "lock" como fallback (lo manejan los
 * componentes que consumen este helper).
 */
export const CATEGORY_ICONS: Record<NoOlvidarCategory, string> = {
  login: "users",
  note: "doc",
  card: "invoice",
  totp: "shield",
};

export function categoryIcon(c: NoOlvidarCategory): string {
  return CATEGORY_ICONS[c];
}

export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

export function categoryBadgeTone(c: NoOlvidarCategory): BadgeTone {
  if (c === "login") return "info";
  if (c === "card") return "wine";
  if (c === "totp") return "warning";
  return "neutral";
}

export const AUDIT_ACTION_LABELS: Record<NoOlvidarAuditAction, string> = {
  view: "Visto",
  copy: "Copiado",
  edit: "Editado",
  create: "Creado",
  delete: "Eliminado",
  unlock: "Desbloqueado",
  recovery_requested: "Recovery solicitado",
  recovery_approved: "Recovery aprobado",
  recovery_executed: "Recovery ejecutado",
  kek_rotated: "KEK rotada",
};

export function actionLabel(a: NoOlvidarAuditAction): string {
  return AUDIT_ACTION_LABELS[a];
}

export function actionBadgeTone(a: NoOlvidarAuditAction): BadgeTone {
  if (a === "delete") return "danger";
  if (a === "kek_rotated" || a === "recovery_executed") return "wine";
  if (a === "recovery_requested" || a === "recovery_approved") return "warning";
  if (a === "create" || a === "unlock") return "success";
  if (a === "edit") return "info";
  return "neutral";
}

export const RECOVERY_STATUS_LABELS: Record<NoOlvidarRecoveryStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  expired: "Expirada",
  completed: "Completada",
};

export function recoveryStatusLabel(s: NoOlvidarRecoveryStatus): string {
  return RECOVERY_STATUS_LABELS[s];
}

export function recoveryStatusBadgeTone(s: NoOlvidarRecoveryStatus): BadgeTone {
  if (s === "completed") return "success";
  if (s === "approved") return "info";
  if (s === "pending") return "warning";
  if (s === "rejected" || s === "expired") return "danger";
  return "neutral";
}

export const USER_ROLE_LABELS: Record<NoOlvidarUserRole, string> = {
  member: "Miembro",
  admin: "Admin",
};

export function roleLabel(r: NoOlvidarUserRole): string {
  return USER_ROLE_LABELS[r];
}

export function roleBadgeTone(r: NoOlvidarUserRole): BadgeTone {
  return r === "admin" ? "wine" : "neutral";
}

export const KEK_STATUS_LABELS: Record<NoOlvidarKekStatus, string> = {
  active: "Activa",
  legacy: "Legacy",
  revoked: "Revocada",
};

export function kekStatusBadgeTone(s: NoOlvidarKekStatus): BadgeTone {
  if (s === "active") return "success";
  if (s === "legacy") return "warning";
  return "danger";
}

// ─── Formatters / helpers ────────────────────────────────────

export function formatLastAccess(iso: string | null): string {
  if (!iso) return "Nunca";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  return date.toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Calcula si la session del No-Olvidar expiró (now() - last_unlock > timeout).
 * Usado por NoOlvidarClient watchdog cada 60s para forzar redirect a 2FA.
 */
export function isSessionExpired(
  lastUnlockAt: string | null,
  timeoutMinutes: number,
): boolean {
  if (!lastUnlockAt) return true;
  const last = new Date(lastUnlockAt).getTime();
  const elapsedMin = (Date.now() - last) / 60_000;
  return elapsedMin >= timeoutMinutes;
}

/**
 * Campos default por categoría — usado por AddItemDrawer para mostrar
 * los inputs correctos según el tipo de item.
 */
export interface CategoryFieldDef {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "totp";
  required?: boolean;
}

export const CATEGORY_DEFAULT_FIELDS: Record<NoOlvidarCategory, CategoryFieldDef[]> = {
  login: [
    { key: "url", label: "URL del sitio", type: "text" },
    { key: "username", label: "Usuario / email", type: "text" },
    { key: "password", label: "Contraseña", type: "password", required: true },
    { key: "totp", label: "Código 2FA (opcional)", type: "totp" },
    { key: "notes", label: "Notas", type: "textarea" },
  ],
  card: [
    { key: "holder", label: "Titular", type: "text", required: true },
    { key: "number", label: "Número de tarjeta", type: "text", required: true },
    { key: "expiry", label: "Vencimiento (MM/AA)", type: "text", required: true },
    { key: "cvc", label: "CVC", type: "password", required: true },
    { key: "notes", label: "Notas", type: "textarea" },
  ],
  note: [
    { key: "body", label: "Contenido", type: "textarea", required: true },
  ],
  totp: [
    { key: "label", label: "Etiqueta (ej: GitHub)", type: "text", required: true },
    { key: "secret", label: "Secret (base32)", type: "password", required: true },
  ],
};

export function categoryDefaultFields(c: NoOlvidarCategory): CategoryFieldDef[] {
  return CATEGORY_DEFAULT_FIELDS[c];
}

/** Severity → BadgeTone (para banner de anomalías). */
export function alertSeverityBadgeTone(s: NoOlvidarAlertSeverity): BadgeTone {
  if (s === "critical") return "danger";
  if (s === "warning") return "warning";
  return "info";
}
